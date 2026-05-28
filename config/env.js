import dotenv from 'dotenv'
const {config} = dotenv

config();

export const {
    DATABASE_URL,
    DIRECT_URL,
    PORT,
    JWT_SECRET,
    JWT_EXPIRES_IN,
    REFRESH_TOKEN_SECRET,
    REFRESH_TOKEN_EXPIRES_IN,
    SMTP_HOST,
    SMTP_PORT,
    SMTP_USER,
    SMTP_PASS,
    FRONTEND_URL
} = process.env