import prisma from "../database/postgres.js";

export const getReceipt = async (req, res) => {
    try {
        const { id } = req.params;

        const sale = await prisma.sale.findUnique({
            where: { id },
            include: {
                items: {
                    include: {
                        feedItem: {
                            select: {
                                name: true,
                                category: {
                                    select: { name: true }
                                }
                            }
                        }
                    }
                },
                transactions: {
                    select: {
                        reference: true
                    }
                },
                user: {
                    select: {
                        firstName: true,
                        lastName: true
                    }
                }
            }
        });

        if (!sale) {
            return res.status(404).json({ error: "Receipt not found." });
        }

        const reference = sale.transactions.find(t => t.reference)?.reference || null;
        const items = sale.items.map(item => ({
            id: item.id,
            feedItemId: item.feedItemId,
            name: item.feedItem.name,
            category: item.feedItem.category?.name || "N/A",
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            totalPrice: item.totalPrice
        }));

        const receipt = {
            id: sale.id,
            receiptNumber: sale.receiptNumber,
            date: sale.date,
            items,
            totalPrice: sale.totalPrice,
            buyerName: sale.buyerName,
            soldBy: `${sale.user.firstName} ${sale.user.lastName}`,
            reference,
            notes: sale.notes
        };

        res.status(200).json({ receipt });
    } catch (error) {
        console.error("Error fetching receipt:", error);
        res.status(500).json({ error: "Failed to fetch receipt details." });
    }
};

export const getAllReceipts = async (req, res) => {
    try {
        const {
            page = 1,
            limit = 20,
            feedItemId,
            startDate,
            endDate
        } = req.query;

        const pageNumber = parseInt(page, 10) || 1;
        const pageSize = parseInt(limit, 10) || 20;
        const skip = (pageNumber - 1) * pageSize;

        let queryFilter = {};

        if (feedItemId) {
            queryFilter.items = {
                some: {
                    feedItemId: feedItemId
                }
            };
        }

        if (startDate || endDate) {
            queryFilter.date = {};
            if (startDate) queryFilter.date.gte = new Date(startDate);
            if (endDate) queryFilter.date.lte = new Date(endDate);
        }

        const [totalCount, sales] = await prisma.$transaction([
            prisma.sale.count({ where: queryFilter }),
            prisma.sale.findMany({
                where: queryFilter,
                orderBy: { date: 'desc' },
                skip: skip,
                take: pageSize,
                include: {
                    items: {
                        include: {
                            feedItem: {
                                select: { name: true }
                            }
                        }
                    },
                    user: {
                        select: { firstName: true, lastName: true }
                    }
                }
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
            data: sales
        });

    } catch (error) {
        console.error("Error fetching receipts:", error);
        res.status(500).json({ error: "Failed to fetch receipts." });
    }
};
