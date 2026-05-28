import prisma from "../database/postgres.js";


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


export const createCategory = async (req, res) => {
    const { name } = req.body;

    if (!name) {
        return res.status(400).json({ error: "Category name is required." });
    }

    try {
        const newCategory = await prisma.category.create({
            data: { name: name.toUpperCase() } // Force uppercase for consistency
        });

        res.status(201).json({
            message: "Category created successfully.",
            category: newCategory
        });
    } catch (error) {
        // P2002 is Prisma's code for a Unique Constraint Violation
        if (error.code === 'P2002') {
            return res.status(400).json({ error: `The category '${name}' already exists.` });
        }
        res.status(500).json({ error: "Failed to create category." });
    }
};

export const updateCategory = async (req, res) => {
    const { id } = req.params;
    const { name } = req.body;

    if (!name) {
        return res.status(400).json({ error: "New category name is required." });
    }

    try {
        const updatedCategory = await prisma.category.update({
            where: { id: id },
            data: { name: name.toUpperCase() }
        });

        res.status(200).json({
            message: "Category updated successfully.",
            category: updatedCategory
        });
    } catch (error) {
        if (error.code === 'P2025') {
            return res.status(404).json({ error: "Category not found." });
        }
        if (error.code === 'P2002') {
            return res.status(400).json({ error: "A category with that name already exists." });
        }
        res.status(500).json({ error: "Failed to update category." });
    }
};

export const getCategoryById = async (req, res) => {
    const { id } = req.params;

    try {
        const category = await prisma.category.findUnique({
            where: { id: id },
            include: {
                // Return all the feeds inside this category!
                feedItems: {
                    select: {
                        id: true,
                        name: true,
                        currentStock: true
                    },
                    orderBy: {
                        name: 'asc'
                    }
                }
            }
        });

        if (!category) {
            return res.status(404).json({ error: "Category not found." });
        }

        res.status(200).json(category);
        
    } catch (error) {
        // Prisma throws a specific error (P2023) if the ID string isn't a valid UUID
        if (error.code === 'P2023') {
            return res.status(400).json({ error: "Invalid category ID format." });
        }
        res.status(500).json({ error: "Failed to fetch category details." });
    }
};


export const deleteCategory = async (req, res) => {
    const { id } = req.params;

    try {
        await prisma.category.delete({
            where: { id: id }
        });

        res.status(200).json({ message: "Category deleted successfully." });
    } catch (error) {
        // P2025 means the ID wasn't found in the database
        if (error.code === 'P2025') {
            return res.status(404).json({ error: "Category not found." });
        }
        
        // P2003 is the magic code! It means Foreign Key Constraint Failed (The "Restrict" rule)
        if (error.code === 'P2003') {
            return res.status(403).json({ 
                error: "Action blocked. You cannot delete this category because there are feed items currently using it. Please move those items to another category first." 
            });
        }

        res.status(500).json({ error: "Failed to delete category." });
    }
};