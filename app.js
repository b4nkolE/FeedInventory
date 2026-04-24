import express from "express"
import {PORT} from "./config/env.js"
import { connectDb, disconnectDB } from "./database/postgres.js";
import authRouter from "./routes/auth.routes.js";
import inventoryRouter from "./routes/inventory.routes.js"
import analyticsRouter from "./routes/analytics.routes.js"
import userRouter from "./routes/users.routes.js"




const app = express();
app.use(express.json())


app.use("/api/v1/users", authRouter);
app.use("/api/v1/inventory", inventoryRouter);
app.use('/api/v1/analytics', analyticsRouter);
app.use('/api/v1/users', userRouter)



app.use((err, req, res, next) => {
    console.log(err),
    res.status(500).json({message: "Something went wrong", err: err.message});
});


const httpServer = app.listen(PORT, () => {
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