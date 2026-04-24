// controllers/analytics.controllers.js
import prisma from "../database/postgres.js";

export const getAnalyticsSummary = async (req, res) => {
    // 1. Calculate Total Bags in Warehouse
    // Prisma's aggregate function is highly optimized for math
    const totalBags = await prisma.feedItem.aggregate({
        _sum: {
            currentStock: true
        }
    });

    // 2. Calculate Total Bags Sold (OUT) Today
    // First, we need to define "Today" in JavaScript (Midnight to 11:59 PM)
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    const todaySales = await prisma.transaction.aggregate({
        _sum: {
            quantity: true
        },
        where: {
            type: 'OUT',
            // Remember, your schema uses 'date' for timestamps!
            date: {
                gte: startOfDay,
                lte: endOfDay
            }
        }
    });

    // 3. Find Low Stock Items (Threshold: < 10)
    const lowStockItems = await prisma.feedItem.findMany({
        where: {
            currentStock: {
                lt: 10 // "lt" means Less Than
            }
        },
        select: {
            id: true,
            name: true,
            category: true,
            currentStock: true
        },
        orderBy: {
            currentStock: 'asc' // Show the most critically low items first
        }
    });

    // 4. Package it all up into one clean JSON object
    res.status(200).json({
        // The || 0 ensures that if the database is completely empty, it returns 0 instead of null
        totalBagsInWarehouse: totalBags._sum.currentStock || 0,
        totalBagsSoldToday: todaySales._sum.quantity || 0,
        lowStockItems: lowStockItems
    });
};


export const getTopSellingFeeds = async (req, res) => {
    // 1. Let the frontend decide how many to fetch, but default to 5
    const limit = parseInt(req.query.limit) || 5;

    // 2. Ask Prisma to group all 'OUT' transactions by the Feed ID, 
    // sum up the quantities, and sort them from highest to lowest.
    const topSales = await prisma.transaction.groupBy({
        by: ['feedItemId'],
        _sum: {
            quantity: true
        },
        where: {
            type: 'OUT' // We only care about things leaving the farm!
        },
        orderBy: {
            _sum: {
                quantity: 'desc'
            }
        },
        take: limit
    });

    // 3. The groupBy query is fast, but it only gives us the feedItemId.
    // We need to grab the actual names so the frontend doesn't just display a random UUID.
    const feedIds = topSales.map(sale => sale.feedItemId);

    const feeds = await prisma.feedItem.findMany({
        where: {
            id: { in: feedIds } // Grab all matching feeds in one single query
        },
        select: {
            id: true,
            name: true,
            category: true,
            currentStock: true
        }
    });

    // 4. Stitch the sales math and the feed details together into a beautiful object
    const leaderboard = topSales.map(sale => {
        // Find the matching feed details for this specific sale
        const feedInfo = feeds.find(f => f.id === sale.feedItemId);
        
        return {
            ...feedInfo,
            totalSold: sale._sum.quantity // Add the grand total to the object
        };
    });

    // 5. Send the leaderboard back
    res.status(200).json(leaderboard);
};


export const getManagerActions = async (req, res) => {
    // Fetch all transactions where the user who made them has the 'MANAGER' role
    const managerTransactions = await prisma.transaction.findMany({
        where: {
            user: {
                role: 'MANAGER' // Prisma's relation filters are amazing for this
            }
        },
        orderBy: {
            date: 'desc'
        },
        include: {
            // We want to know exactly WHO did it, and WHAT feed they touched
            user: {
                select: { firstName: true, lastName: true, email: true }
            },
            feedItem: {
                select: { name: true }
            }
        }
    });

    res.status(200).json({
        totalManagerActions: managerTransactions.length,
        actions: managerTransactions
    });
};