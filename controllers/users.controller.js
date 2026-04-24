import prisma from "../database/postgres.js";


export const getAllUsers = async (req, res) => {
    const users = await prisma.user.findMany({
        select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            role: true,
            isActive: true,
            createdAt: true
        },
        orderBy: { role: 'asc' } // Groups Admins, then Managers, then Staff
    });

    res.status(200).json(users);
};

// Allow a user to update their own profile
export const updateUserProfile = async (req, res) => {
    const userId = req.user.id; // Get the ID from their own token
    const { firstName, lastName, phoneNumber } = req.body;

    const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: {
            ...(firstName && { firstName }),
            ...(lastName && { lastName }),
            ...(phoneNumber && { phoneNumber })
        },
        select: { id: true, firstName: true, lastName: true, email: true } // Return clean data
    });

    res.status(200).json({ message: "Profile updated successfully.", user: updatedUser });
};


export const deleteUser = async (req, res) => {
    const targetUserId = req.params.id;
    const requestingUser = req.user; // The person making the request

    // First, find the user they are trying to delete to check their role
    const targetUser = await prisma.user.findUnique({
        where: { id: targetUserId }
    });

    if (!targetUser) {
        return res.status(404).json({ error: "User not found." });
    }

    // HOW IT WORKS:
    // Rule A: Managers can ONLY delete Staff.
    if (requestingUser.role === 'MANAGER' && targetUser.role !== 'STAFF') {
        return res.status(403).json({ 
            error: "Permission denied. Managers can only delete Staff profiles." 
        });
    }

    // Rule B: Admins can delete Managers and Staff, but we should protect Admins from deleting themselves or other Admins accidentally.
    if (requestingUser.role === 'ADMIN' && targetUser.role === 'ADMIN') {
        return res.status(403).json({ 
            error: "Action blocked. Admins cannot delete Admin profiles." 
        });
    }

    // If they pass the checks, execute the deletion
    await prisma.user.delete({
        where: { id: targetUserId }
    });

    res.status(200).json({ message: `User ${targetUser.firstName} deleted successfully.` });
};