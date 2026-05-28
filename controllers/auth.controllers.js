import prisma from "../database/postgres.js";
import bcrypt from "bcrypt";
import { JWT_SECRET, JWT_EXPIRES_IN, REFRESH_TOKEN_EXPIRES_IN, REFRESH_TOKEN_SECRET } from "../config/env.js";
import jwt from "jsonwebtoken";
import { sendResetCodeEmail } from "../config/mailer.js";


const generateAuthTokens = (user) => {
    //The short-lived Access Token
    const accessToken = jwt.sign(
        { id: user.id, role: user.role },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN }
    );

    //The long-lived Refresh Token 
    // Notice we only put the ID in this one. If their role changes, 
    // the refresh endpoint will catch it when it looks them up!
    const refreshToken = jwt.sign(
        { id: user.id },
        REFRESH_TOKEN_SECRET,
        { expiresIn: REFRESH_TOKEN_EXPIRES_IN }
    );

    return { accessToken, refreshToken };
};


export const signUp = async (req, res) => {
    const { email, password, firstName, lastName, phoneNumber } = req.body;

    //Validate input (basic check)
    if (!email || !password || !firstName || !lastName) {
        return res.status(400).json({ error: "Email, password, and full name are required." });
    }

    //Check if user already exists
    const existingUser = await prisma.user.findUnique({
        where: { email }
    });

    if (existingUser) {
        return res.status(400).json({ error: "Email is already registered." });
    }

    //Securely hash the password
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    //Create the user
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

    //GENERATE BOTH TOKENS using your helper function
    const tokens = generateAuthTokens(newUser);

    // Send the tokens and user data back to the frontend
    res.status(201).json({
        message: "User registered successfully.",
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        user: newUser
    });
};

export const signIn = async (req, res) => {
    const { email, password } = req.body;

    //Validate inputs exist
    if (!email || !password) {
        return res.status(400).json({ error: "Email and password are required." });
    }

    //Find the user in the database
    const user = await prisma.user.findUnique({
        where: { email }
    });

    //Security best practice: Do not tell the attacker WHICH part was wrong
    if (!user) {
        return res.status(401).json({ error: "Invalid email or password." });
    }

    //Check if the account is active (the Soft Deletion check)
    if (!user.isActive) {
        return res.status(403).json({
            error: "This account has been deactivated. Please contact an administrator."
        });
    }

    //Compare the provided password with the hashed password in the DB
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

    if (!isPasswordValid) {
        return res.status(401).json({ error: "Invalid email or password." });
    }

    //GENERATE BOTH TOKENS using your helper function
    const tokens = generateAuthTokens(user);

    // Send the successful response
    res.status(200).json({
        message: "Login successful.",
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        user: {
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            role: user.role
        }
    });
};


export const getMe = async (req, res) => {
    // Since this route is protected, your verifyToken middleware 
    // will have already grabbed the ID from the token and attached it to req.user
    const userId = req.user.id;

    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phoneNumber: true,
            role: true,
            isActive: true,
            createdAt: true
            // Notice we specifically DO NOT include passwordHash here!
        }
    });

    if (!user) {
        return res.status(404).json({ error: "User profile not found." });
    }

    // Send the clean profile data back to the frontend
    res.status(200).json(user);
};


export const refreshToken = async (req, res) => {
    const { refreshToken } = req.body;

    if (!refreshToken) {
        return res.status(401).json({ error: "Refresh token is required." });
    }

    try {
        // Verify the token signature and expiration
        const decoded = jwt.verify(refreshToken, REFRESH_TOKEN_SECRET);

        // Security Check: Ensure the user still exists and is active in the database
        const user = await prisma.user.findUnique({
            where: { id: decoded.id }
        });

        if (!user || !user.isActive) {
            return res.status(403).json({ error: "Account deactivated or user not found." });
        }

        // Issue a brand new short-lived access token
        const newAccessToken = jwt.sign(
            { id: user.id, role: user.role },
            JWT_SECRET,
            { expiresIn: JWT_EXPIRES_IN }
        );

        res.status(200).json({
            message: "Token refreshed successfully.",
            token: newAccessToken
        });

    } catch (error) {
        return res.status(403).json({ error: "Invalid or expired refresh token. Please sign in again." });
    }
};


export const forgotPassword = async (req, res) => {
    const { email } = req.body;

    if (!email) {
        return res.status(400).json({ error: "Email is required." });
    }

    try {
        // 1. Look up the user — but don't reveal if the email exists or not
        const user = await prisma.user.findUnique({
            where: { email }
        });

        if (!user) {
            // Security: Return the same success message to prevent email enumeration
            return res.status(200).json({
                message: "If an account with that email exists, a reset code has been sent."
            });
        }

        // 2. Delete any existing unused reset tokens for this user (prevent stacking)
        await prisma.passwordReset.deleteMany({
            where: {
                userId: user.id,
                used: false
            }
        });

        // 3. Generate a random 6-digit code
        const resetCode = Math.floor(100000 + Math.random() * 900000).toString();

        // 4. Hash the code before storing (same approach as passwords)
        const tokenHash = await bcrypt.hash(resetCode, 10);

        // 5. Store in the database with a 15-minute expiry
        await prisma.passwordReset.create({
            data: {
                userId: user.id,
                tokenHash,
                expiresAt: new Date(Date.now() + 15 * 60 * 1000) // 15 minutes
            }
        });

        // 6. Send the code via email
        await sendResetCodeEmail(email, resetCode, user.firstName);

        res.status(200).json({
            message: "If an account with that email exists, a reset code has been sent."
        });

    } catch (error) {
        console.error("Forgot password error:", error);
        res.status(500).json({ error: "Failed to process password reset request." });
    }
};


export const resetPassword = async (req, res) => {
    const { email, code, newPassword } = req.body;

    // 1. Validate inputs
    if (!email || !code || !newPassword) {
        return res.status(400).json({ error: "Email, reset code, and new password are required." });
    }

    if (newPassword.length < 6) {
        return res.status(400).json({ error: "New password must be at least 6 characters." });
    }

    try {
        // 2. Look up the user
        const user = await prisma.user.findUnique({
            where: { email }
        });

        if (!user) {
            return res.status(400).json({ error: "Invalid email or reset code." });
        }

        // 3. Find the most recent, unused, non-expired reset token for this user
        const resetRecord = await prisma.passwordReset.findFirst({
            where: {
                userId: user.id,
                used: false,
                expiresAt: { gt: new Date() } // Must not be expired
            },
            orderBy: { createdAt: 'desc' }
        });

        if (!resetRecord) {
            return res.status(400).json({ error: "Reset code is invalid or has expired. Please request a new one." });
        }

        // 4. Compare the provided code against the stored hash
        const isCodeValid = await bcrypt.compare(code, resetRecord.tokenHash);

        if (!isCodeValid) {
            return res.status(400).json({ error: "Invalid email or reset code." });
        }

        // 5. Hash the new password and update the user
        const newPasswordHash = await bcrypt.hash(newPassword, 10);

        await prisma.$transaction([
            // Update the user's password
            prisma.user.update({
                where: { id: user.id },
                data: { passwordHash: newPasswordHash }
            }),
            // Mark the token as used so it can't be reused
            prisma.passwordReset.update({
                where: { id: resetRecord.id },
                data: { used: true }
            })
        ]);

        res.status(200).json({ message: "Password reset successfully. You can now sign in with your new password." });

    } catch (error) {
        console.error("Reset password error:", error);
        res.status(500).json({ error: "Failed to reset password." });
    }
};
