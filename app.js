import express from "express"
import {PORT} from "./config/env.js"
import { connectDb, disconnectDB } from "./database/postgres.js";





const app = express();


app.listen(PORT, () => {
    console.log("server is running");
    connectDb();
});


process.on("unhandledRejection", (err) => {
    console.error("unhandled Rejection:",err);
    httpServer.close(async () => {
        await disconnectDB();
        process.exit(1);
    });
});

process.on("uncaughtException", (err) => {
    console.error("uncaught Exception:",err);
    httpServer.close(async () => {
        await disconnectDB();
        process.exit(1);
    });
});

process.on("SIGTERM", () => {
    console.error("SIGTERM received, shutting down gracefully");
    httpServer.close(async () => {
        await disconnectDB();
        process.exit(0);
    });
});