import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const recordTransaction = async (req, res) => {
    // 1. Get the data from the request body
    const { feedItemId, type, quantity, reference, notes } = req.body;

    // 2. Validate the inputs
    if (!feedItemId || !type || quantity === undefined) {
        return res.status(400).json({ error: "feedItemId, type (IN/OUT), and quantity are required." });
    }

    if (quantity <= 0) {
        return res.status(400).json({ error: "Quantity must be greater than zero." });
    }

    if (type !== 'IN' && type !== 'OUT') {
        return res.status(400).json({ error: "Transaction type must be 'IN' or 'OUT'." });
    }

    // 3. Look up the specific feed item
    const feedItem = await prisma.feedItem.findUnique({
        where: { id: feedItemId }
    });

    if (!feedItem) {
        return res.status(404).json({ error: "Feed item not found." });
    }

    // 4. Calculate what the new stock level should be
    let newStock = feedItem.currentStock;
    
    if (type === 'IN') {
        newStock += quantity;
    } else if (type === 'OUT') {
        // Prevent staff from selling more than you actually have!
        if (feedItem.currentStock < quantity) {
            return res.status(400).json({ 
                error: `Insufficient stock. You only have ${feedItem.currentStock} units of this feed available.` 
            });
        }
        newStock -= quantity;
    }

    // 5. Execute the Prisma Transaction
    // Both of these commands execute together atomically
    const [newTransaction, updatedFeedItem] = await prisma.$transaction([
        // Action A: Record the transaction history
        prisma.transaction.create({
            data: {
                feedItemId,
                userId: req.user.id, // We get this from your verifyToken middleware!
                type,
                quantity,
                reference,
                notes
            }
        }),
        // Action B: Update the actual stock number on the feed item
        prisma.feedItem.update({
            where: { id: feedItemId },
            data: { currentStock: newStock }
        })
    ]);

    // 6. Send the success response
    res.status(201).json({
        message: `Successfully recorded ${quantity} units ${type}.`,
        transaction: newTransaction,
        currentStock: updatedFeedItem.currentStock
    });
};