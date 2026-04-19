import prisma from "../database/postgres.js";
import bcrypt from "bcrypt";
import { JWT_SECRET, JWT_EXPIRES_IN } from "../config/env.js";
import jwt from "jsonwebtoken";


export const signUp = async (req, res) => {
    // 1. Explicitly destructure ONLY the fields you want to allow
    const { email, password, firstName, lastName, phoneNumber } = req.body;

    // 2. Validate input (basic check)
    if (!email || !password || !firstName ||!lastName ) {
        return res.status(400).json({ error: "Email, password, and full name are required." });
    }

    // 3. Check if user already exists
    const existingUser = await prisma.user.findUnique({
        where: { email }
    });

    if (existingUser) {
        return res.status(400).json({ error: "Email is already registered." });
    }

    // 4. Securely hash the password
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // 5. Create the user
    const newUser = await prisma.user.create({
        data: {
            email,
            passwordHash,
            firstName,
            lastName, 
            phoneNumber,
            // Prisma will automatically apply the @default(STAFF) from your schema.
        },
        // Select only safe fields to return to the frontend
        select: {
            id: true,
            email: true,
            firstName: true, 
            lastName: true, 
            role: true, 
            createdAt: true
        }
    });

    // 6. Generate the JWT so the user is immediately logged in
    const token = jwt.sign(
        { 
            id: newUser.id, 
            role: newUser.role 
        },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN  }
    );

    // 7. Send the token and user data back to the frontend
    res.status(201).json({
        message: "User registered successfully.",
        token, 
        user: newUser
    });
};

export const signIn = async (req, res) => {
    const { email, password } = req.body;

    // 1. Validate inputs exist
    if (!email || !password) {
        return res.status(400).json({ error: "Email and password are required." });
    }

    // 2. Find the user in the database
    const user = await prisma.user.findUnique({
        where: { email }
    });

    // 3. Security best practice: Do not tell the attacker WHICH part was wrong
    if (!user) {
        return res.status(401).json({ error: "Invalid email or password." });
    }

    // 4. Check if the account is active (the Soft Deletion check)
    if (!user.isActive) {
        return res.status(403).json({ 
            error: "This account has been deactivated. Please contact an administrator." 
        });
    }

    // 5. Compare the provided password with the hashed password in the DB
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    
    if (!isPasswordValid) {
        return res.status(401).json({ error: "Invalid email or password." });
    }

    // 6. Generate the JWT
    const token = jwt.sign(
        { 
            id: user.id, 
            role: user.role 
        },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN }
    );

    // 7. Send the successful response
    res.status(200).json({
        message: "Login successful.",
        token,
        user: {
            id: user.id,
            email: user.email,
            fullName: user.fullName,
            role: user.role
        }
    });
};




