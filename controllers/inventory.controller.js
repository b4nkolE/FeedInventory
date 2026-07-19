import prisma from "../database/postgres.js";


export const recordTransaction = async (req, res) => {
    try {
        const { feedItemId, type, quantity, reference, notes, buyerName, items } = req.body;

        if (!type || (type !== 'IN' && type !== 'OUT')) {
            return res.status(400).json({ error: "Transaction type must be 'IN' or 'OUT'." });
        }

        // ── Handle INBOUND (Stock Addition) ──────────────────────────
        if (type === 'IN') {
            if (!feedItemId || quantity === undefined) {
                return res.status(400).json({ error: "feedItemId and quantity are required for IN transactions." });
            }

            if (quantity <= 0) {
                return res.status(400).json({ error: "Quantity must be greater than zero." });
            }

            const feedItem = await prisma.feedItem.findUnique({
                where: { id: feedItemId }
            });

            if (!feedItem) {
                return res.status(404).json({ error: "Feed item not found." });
            }

            const newStock = feedItem.currentStock + quantity;

            const [newTransaction, updatedFeedItem] = await prisma.$transaction([
                prisma.transaction.create({
                    data: {
                        feedItemId,
                        userId: req.user.id,
                        type: 'IN',
                        quantity,
                        reference,
                        notes
                    }
                }),
                prisma.feedItem.update({
                    where: { id: feedItemId },
                    data: { currentStock: newStock }
                })
            ]);

            return res.status(201).json({
                message: `Successfully recorded ${quantity} units IN.`,
                transaction: newTransaction,
                currentStock: updatedFeedItem.currentStock
            });
        }

        // ── Handle OUTBOUND (Sale - Single or Multi-Item) ────────────
        if (type === 'OUT') {
            // Normalize line items: accept array `items` or single `feedItemId` + `quantity`
            let lineItems = [];
            if (Array.isArray(items) && items.length > 0) {
                lineItems = items;
            } else if (feedItemId && quantity !== undefined) {
                lineItems = [{ feedItemId, quantity }];
            } else {
                return res.status(400).json({
                    error: "For OUT transactions, provide an 'items' array or single 'feedItemId' and 'quantity'."
                });
            }

            // Validate each line item structure
            for (let i = 0; i < lineItems.length; i++) {
                const item = lineItems[i];
                if (!item.feedItemId || item.quantity === undefined) {
                    return res.status(400).json({
                        error: `Line item at index ${i} is missing feedItemId or quantity.`
                    });
                }
                if (item.quantity <= 0) {
                    return res.status(400).json({
                        error: `Quantity for line item at index ${i} must be greater than zero.`
                    });
                }
            }

            // Perform atomic validation, sale creation, and stock updates inside interactive $transaction
            const result = await prisma.$transaction(async (tx) => {
                // 1. Fetch all feed items involved
                const feedIds = [...new Set(lineItems.map(item => item.feedItemId))];
                const feedItems = await tx.feedItem.findMany({
                    where: { id: { in: feedIds } }
                });

                const feedMap = new Map(feedItems.map(item => [item.id, item]));

                // 2. Validate existence, pricing, and stock levels
                // Track cumulative requested quantity per feed item to prevent overselling same item specified multiple times
                const requestedQuantities = new Map();

                for (const item of lineItems) {
                    const feed = feedMap.get(item.feedItemId);
                    if (!feed) {
                        throw new Error(`FEED_NOT_FOUND:${item.feedItemId}`);
                    }
                    if (!feed.pricePerUnit) {
                        throw new Error(`MISSING_PRICE:${feed.name}`);
                    }

                    const currentReq = requestedQuantities.get(item.feedItemId) || 0;
                    const newReq = currentReq + item.quantity;
                    requestedQuantities.set(item.feedItemId, newReq);

                    if (feed.currentStock < newReq) {
                        throw new Error(`INSUFFICIENT_STOCK:${feed.name}:${feed.currentStock}:${newReq}`);
                    }
                }

                // 3. Generate receipt number: GGS-YYYY-XXXX
                const year = new Date().getFullYear();
                const salesCount = await tx.sale.count({
                    where: { receiptNumber: { startsWith: `GGS-${year}-` } }
                });
                const sequence = String(salesCount + 1).padStart(4, '0');
                const receiptNumber = `GGS-${year}-${sequence}`;

                // 4. Build SaleItem data and calculate totals
                let grandTotal = 0;
                const saleItemsData = lineItems.map(item => {
                    const feed = feedMap.get(item.feedItemId);
                    const unitPrice = Number(feed.pricePerUnit);
                    const lineTotal = unitPrice * item.quantity;
                    grandTotal += lineTotal;

                    return {
                        feedItemId: item.feedItemId,
                        quantity: item.quantity,
                        unitPrice: feed.pricePerUnit,
                        totalPrice: lineTotal
                    };
                });

                // 5. Create Sale record with nested SaleItem entries
                const sale = await tx.sale.create({
                    data: {
                        receiptNumber,
                        totalPrice: grandTotal,
                        buyerName,
                        notes,
                        userId: req.user.id,
                        items: {
                            create: saleItemsData
                        }
                    },
                    include: {
                        items: {
                            include: {
                                feedItem: {
                                    select: { name: true }
                                }
                            }
                        }
                    }
                });

                // 6. Deduct stock and create Transaction entries for each line item
                const createdTransactions = [];
                for (const item of lineItems) {
                    await tx.feedItem.update({
                        where: { id: item.feedItemId },
                        data: {
                            currentStock: {
                                decrement: item.quantity
                            }
                        }
                    });

                    const transaction = await tx.transaction.create({
                        data: {
                            feedItemId: item.feedItemId,
                            userId: req.user.id,
                            type: 'OUT',
                            quantity: item.quantity,
                            reference,
                            notes,
                            saleId: sale.id
                        }
                    });
                    createdTransactions.push(transaction);
                }

                return { sale, transactions: createdTransactions };
            });

            return res.status(201).json({
                message: `Successfully processed sale (${result.sale.items.length} item(s)).`,
                sale: result.sale,
                transactions: result.transactions
            });
        }
    } catch (error) {
        // Handle domain error messages thrown inside $transaction
        if (error.message.startsWith('FEED_NOT_FOUND:')) {
            const id = error.message.split(':')[1];
            return res.status(404).json({ error: `Feed item not found: ${id}` });
        }
        if (error.message.startsWith('MISSING_PRICE:')) {
            const name = error.message.split(':')[1];
            return res.status(400).json({ error: `Cannot sell feed '${name}' without a set price per unit.` });
        }
        if (error.message.startsWith('INSUFFICIENT_STOCK:')) {
            const [, name, available, requested] = error.message.split(':');
            return res.status(400).json({
                error: `Insufficient stock for '${name}'. Available: ${available}, Requested: ${requested}`
            });
        }

        console.error("Error recording transaction:", error);
        return res.status(500).json({ error: "Failed to record transaction." });
    }
};

export const getAllFeeds = async (req, res) => {
    const {
        page = 1,
        limit = 20,
        search,
        categoryId
    } = req.query;

    const pageNumber = parseInt(page, 10) || 1;
    const pageSize = parseInt(limit, 10) || 20;
    const skip = (pageNumber - 1) * pageSize;

    // Build dynamic filter
    let queryFilter = {};

    if (search) {
        queryFilter.name = {
            contains: search,
            mode: 'insensitive'
        };
    }

    if (categoryId) {
        queryFilter.categoryId = categoryId;
    }

    try {
        // Execute both count and fetch simultaneously
        const [totalCount, feeds] = await prisma.$transaction([
            prisma.feedItem.count({ where: queryFilter }),
            prisma.feedItem.findMany({
                where: queryFilter,
                include: {
                    category: {
                        select: {
                            name: true
                        }
                    }
                },
                orderBy: {
                    name: 'asc'
                },
                skip: skip,
                take: pageSize
            })
        ]);

        const totalPages = Math.ceil(totalCount / pageSize);

        res.status(200).json({
            metadata: {
                totalRecords: totalCount,
                currentPage: pageNumber,
                totalPages: totalPages,
                pageSize: pageSize,
                hasNextPage: pageNumber < totalPages,
                hasPrevPage: pageNumber > 1
            },
            data: feeds
        });

    } catch (error) {
        console.error("Error fetching feeds:", error);
        res.status(500).json({ error: "Failed to fetch feed catalog." });
    }
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
    const { categoryId, name, pricePerUnit } = req.body;

    // 1. Basic validation
    if (!name || !categoryId || pricePerUnit === undefined) {
        return res.status(400).json({ error: "Feed name, category, and price per unit are required." });
    }

    if (pricePerUnit <= 0) {
        return res.status(400).json({ error: "Price per unit must be greater than zero." });
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
            categoryId,
            pricePerUnit
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
    const { categoryId, name, pricePerUnit } = req.body;

    // 1. Ensure they actually sent something to update
    if (!name && !categoryId && pricePerUnit === undefined) {
        return res.status(400).json({ error: "Please provide a name, category, or price per unit to update." });
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
            ...(categoryId && { categoryId }),
            ...(pricePerUnit !== undefined && { pricePerUnit })
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

