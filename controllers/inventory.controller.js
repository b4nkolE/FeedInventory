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
        // CHANGE: Ask Prisma to fetch the related category data!
        include: {
            category: {
                select: {
                    name: true // Just grab the name of the category
                }
            }
        },
        orderBy: {
            name: 'asc'
        }
    });

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
    const { categoryId, name } = req.body;

    // 1. Basic validation
    if (!name || !categoryId) {
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

    // 3. Verify the category actually exists
    const categoryExists = await prisma.category.findUnique({
        where: { id: categoryId }
    });
    if (!categoryExists) {
        return res.status(400).json({ error: "The specified category does not exist." });
    }

    // 4. Create the new feed item
    // Notice we do not pass currentStock here. Your database schema 
    // already has @default(0), so it will automatically start empty!
    const newFeed = await prisma.feedItem.create({
        data: {
            name,
            categoryId
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
    const { categoryId, name } = req.body;

    // 1. Ensure they actually sent something to update
    if (!name && !categoryId) {
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

    // 4. If they are changing the category, ensure the new category exists
    if (categoryId) {
        const categoryExists = await prisma.category.findUnique({
            where: { id: categoryId }
        });
        if (!categoryExists) {
            return res.status(400).json({ error: "The specified category does not exist." });
        }
    }

    // 5. Perform the update
    // We use the spread operator or pass the specific fields so we only 
    // update what was actually provided in the request body.
    const updatedFeed = await prisma.feedItem.update({
        where: { id: id },
        data: {
            ...(name && { name }),
            ...(categoryId && { categoryId })
        }
    });

    // 5. Send back the updated item
    res.status(200).json({
        message: "Feed item updated successfully.",
        feed: updatedFeed
    });
};


export const getAllTransactions = async (req, res) => {
    // 1. Grab filters AND pagination params from the URL
    // We set default values: page 1, 20 items per page
    const {
        type,
        startDate,
        endDate,
        feedItemId,
        page = 1,     // NEW: Pagination param
        limit = 20    // NEW: Pagination param
    } = req.query;

    // Convert string inputs to integers for Prisma calculations
    const pageNumber = parseInt(page, 10) || 1;
    const pageSize = parseInt(limit, 10) || 20;

    // Calculate how many records to "skip" in the database
    const skip = (pageNumber - 1) * pageSize;

    // 2. Build the dynamic filter object (Your existing logic)
    let queryFilter = {};

    if (type) {
        queryFilter.type = type.toUpperCase();
    }

    if (feedItemId) {
        queryFilter.feedItemId = feedItemId;
    }

    if (startDate || endDate) {
        queryFilter.date = {};
        if (startDate) queryFilter.date.gte = new Date(startDate);
        if (endDate) queryFilter.date.lte = new Date(endDate);
    }

    try {
        // 3. Execute both the Count and the Fetch simultaneously!
        const [totalCount, transactions] = await prisma.$transaction([
            // Query A: Count the total number of rows matching the filter
            prisma.transaction.count({ where: queryFilter }),

            // Query B: Fetch the specific page of data
            prisma.transaction.findMany({
                where: queryFilter,
                orderBy: { date: 'desc' },
                skip: skip,       // Skip previous pages
                take: pageSize,   // Take only this page's limit
                include: {
                    feedItem: {
                        select: {
                            name: true,
                            category: { select: { name: true } }
                        }
                    },
                    user: {
                        select: { firstName: true, lastName: true }
                    }
                }
            })
        ]);

        // 4. Calculate total pages
        const totalPages = Math.ceil(totalCount / pageSize);

        // 5. Send back a structured "Paginated Payload"
        res.status(200).json({
            metadata: {
                totalRecords: totalCount,
                currentPage: pageNumber,
                totalPages: totalPages,
                pageSize: pageSize,
                hasNextPage: pageNumber < totalPages,
                hasPrevPage: pageNumber > 1
            },
            data: transactions // The actual array of ledger items
        });

    } catch (error) {
        console.error("Error fetching transactions:", error);
        res.status(500).json({ error: "Failed to fetch transaction ledger." });
    }
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


// controllers/inventory.controller.js

export const getAllCategories = async (req, res) => {
    try {
        // Grab everything from the new Category table
        const categories = await prisma.category.findMany({
            orderBy: {
                name: 'asc' // Keeps their dropdown alphabetical!
            },
            select: {
                id: true,
                name: true
            }
        });

        // Send the raw array of objects to the frontend
        // Example output: [{ id: "uuid-1", name: "FISH_FEED" }, { id: "uuid-2", name: "PULLET_RATION" }]
        res.status(200).json(categories);

    } catch (error) {
        res.status(500).json({ error: "Failed to fetch categories" });
    }
};

