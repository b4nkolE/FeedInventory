import dotenv from 'dotenv'
const {config} = dotenv

config();

export const {
    DATABASE_URL,
    DIRECT_URL,
    PORT,
    JWT_SECRET,
    JWT_EXPIRES_IN
} = process.env