import express from "express"
import {PORT} from "./config/env.js"
import { connectDb, disconnectDB } from "./database/postgres.js";
import authRouter from "./routes/auth.routes.js";
import inventoryRouter from "./routes/inventory.routes.js"
import analyticsRouter from "./routes/analytics.routes.js"
import userRouter from "./routes/users.routes.js"
import categoryRouter from "./routes/category.routes.js";
import swaggerUi from 'swagger-ui-express';
import YAML from 'yamljs';
import cors from "cors";




const app = express();
app.use(express.json())

const swaggerDocument = YAML.load('./swagger.yaml');

app.use(cors({
    origin: ["http://localhost:8000", "https://gbenro-global-synergy.vercel.app", 'http://localhost:3000', "http://localhost:3001","http://localhost:3002","https://gbenroglobalsynergyltd.onrender.com"],
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    credentials: true,
    allowedHeaders: ["Content-type", "Authorization"],
    exposedHeaders: ["Content-Disposition"]
}));

app.use("/api/v1/users", authRouter);
app.use("/api/v1/inventory", inventoryRouter);
app.use('/api/v1/analytics', analyticsRouter);
app.use('/api/v1/users', userRouter)
app.use("/api/v1/category", categoryRouter);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));



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