import dotenv from 'dotenv'
const {config} = dotenv

config();

export const {
    DATABASE_URL,
    PORT
} = process.env