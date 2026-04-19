import jwt from "jsonwebtoken";
import prisma from "../database/postgres.js";
import { JWT_SECRET } from "../config/env.js";

export const verifyToken = async (req, res, next) => {
    try {
        //Check Authorization header
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return res.status(401).json({
                message: "Not authorized, no token provided",
            });
        }

        //Extract token
        const token = authHeader.split(" ")[1];

        if (!token) {
            return res.status(401).json({
                message: "Not authorized, token missing",
            });
        }

        //Verify token
        const decoded = jwt.verify(token, JWT_SECRET);

        // Fetch user from database
        const user = await prisma.user.findUnique({
            where: { id: decoded.id },
            select: {
                id: true,
                role: true,
                email: true,
                firstName: true,
                lastName: true,
            },
        });

        if (!user) {
            return res.status(401).json({
                message: "User belonging to this token no longer exists",
            });
        }

        //Attach user to request
        req.user = user;

        next();
    } catch (error) {
        console.error("Auth error:", error);

        return res.status(401).json({
            message: "Not authorized, token failed",
        });
    }
};
