import prisma from "../database/postgres.js";


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

export const getAllFeeds = async (req, res) => {
    const feeds = await prisma.feedItem.findMany({
        orderBy: [
            { category: 'asc' }, // Group them by category first
            { name: 'asc' }      // Then sort alphabetically within that category
        ]
    });

    // Send the full, sorted inventory list back
    res.status(200).json(feeds);
};


export const getFeedById = async (req, res) => {
    // 1. Extract the ID directly from the URL parameters
    const { id } = req.params;

    // 2. Query the database for that exact UUID
    const feed = await prisma.feedItem.findUnique({
        where: { id: id }
    });

    // 3. Handle the 404 case if someone types a fake ID into the URL
    if (!feed) {
        return res.status(404).json({ error: "Feed item not found." });
    }

    // 4. Send the specific feed details back
    res.status(200).json(feed);
};


export const createFeedItem = async (req, res) => {
    const { name, category } = req.body;

    // 1. Basic validation
    if (!name || !category) {
        return res.status(400).json({ error: "Feed name and category are required." });
    }

    // 2. Check for duplicates to prevent database errors
    const existingFeed = await prisma.feedItem.findUnique({
        where: { name }
    });

    if (existingFeed) {
        return res.status(400).json({ 
            error: `A feed item named '${name}' already exists in the catalog.` 
        });
    }

    // 3. Create the new feed item
    // Notice we do not pass currentStock here. Your database schema 
    // already has @default(0), so it will automatically start empty!
    const newFeed = await prisma.feedItem.create({
        data: {
            name,
            category
        }
    });

    // 4. Return success
    res.status(201).json({
        message: "New feed product added to the catalog successfully.",
        feed: newFeed
    });
};


export const updateFeedItem = async (req, res) => {
    const { id } = req.params;
    const { name, category } = req.body;

    // 1. Ensure they actually sent something to update
    if (!name && !category) {
        return res.status(400).json({ error: "Please provide a name or category to update." });
    }

    // 2. Check if the feed item actually exists first
    const existingFeed = await prisma.feedItem.findUnique({
        where: { id: id }
    });

    if (!existingFeed) {
        return res.status(404).json({ error: "Feed item not found." });
    }

    // 3. If they are changing the name, ensure the NEW name isn't already taken
    if (name && name !== existingFeed.name) {
        const nameCheck = await prisma.feedItem.findUnique({
            where: { name: name }
        });

        if (nameCheck) {
            return res.status(400).json({ 
                error: `A feed item named '${name}' already exists.` 
            });
        }
    }

    // 4. Perform the update
    // We use the spread operator or pass the specific fields so we only 
    // update what was actually provided in the request body.
    const updatedFeed = await prisma.feedItem.update({
        where: { id: id },
        data: {
            ...(name && { name }),
            ...(category && { category })
        }
    });

    // 5. Send back the updated item
    res.status(200).json({
        message: "Feed item updated successfully.",
        feed: updatedFeed
    });
};

// controllers/inventoryController.js

export const getAllTransactions = async (req, res) => {
    // 1. Grab the optional query parameters from the URL
    // e.g., ?type=IN&startDate=2026-04-01
    const { type, startDate, endDate, feedItemId } = req.query;

    // 2. Build a dynamic filter object
    let queryFilter = {};

    if (type) {
        queryFilter.type = type.toUpperCase(); // Ensure it matches 'IN' or 'OUT'
    }
    
    if (feedItemId) {
        queryFilter.feedItemId = feedItemId;
    }

    // 3. Handle date ranges if the frontend provided them
    if (startDate || endDate) {
        queryFilter.date = {};
        if (startDate) queryFilter.date.gte = new Date(startDate); // Greater than or equal to
        if (endDate) queryFilter.date.lte = new Date(endDate);     // Less than or equal to
    }

    // 4. Fetch the ledger from the database
    const transactions = await prisma.transaction.findMany({
        where: queryFilter,
        orderBy: {
            date: 'desc' // Always show the newest transactions at the top!
        },
        include: {
            // Automatically fetch the related feed name and category
            feedItem: {
                select: { name: true, category: true }
            },
            // Automatically fetch the staff member's name
            user: {
                select: { firstName: true, lastName: true }
            }
        }
    });

    // 5. Return the heavily detailed list
    res.status(200).json(transactions);
};

// controllers/inventoryController.js

// export const getTransactionsByFeedId = async (req, res) => {
//     // 1. Grab the Feed ID from the URL path
//     const { feedItemId } = req.params;
    
//     // 2. Grab optional filters from the query string (?type=IN)
//     const { type, startDate, endDate } = req.query;

//     // 3. Verify the feed item actually exists first
//     const feed = await prisma.feedItem.findUnique({
//         where: { id: feedItemId },
//         select: { name: true, currentStock: true } // We only need basic info
//     });

//     if (!feed) {
//         return res.status(404).json({ error: "Feed item not found." });
//     }

//     // 4. Build the query filter, locking it to THIS specific feed
//     let queryFilter = {
//         feedItemId: feedItemId 
//     };

//     if (type) {
//         queryFilter.type = type.toUpperCase();
//     }

//     if (startDate || endDate) {
//         queryFilter.date = {}; // Using 'date' just like we fixed earlier!
//         if (startDate) queryFilter.date.gte = new Date(startDate);
//         if (endDate) queryFilter.date.lte = new Date(endDate);
//     }

//     // 5. Fetch the targeted history
//     const transactions = await prisma.transaction.findMany({
//         where: queryFilter,
//         orderBy: {
//             date: 'desc'
//         },
//         include: {
//             // We don't need to include the feedItem details here because we already know what feed it is!
//             // We only need to know WHICH staff member did it.
//             user: {
//                 select: { firstName: true, lastName: true }
//             }
//         }
//     });

//     // 6. Return a beautifully structured response
//     res.status(200).json({
//         feedName: feed.name,
//         currentStock: feed.currentStock,
//         totalTransactions: transactions.length,
//         history: transactions
//     });
// };