// routes/inventoryRoutes.js
import express from 'express';
import { recordTransaction } from '../controllers/inventory.controller.js';
import { verifyToken } from '../middlewares/auth.middlewares.js'; 

const inventoryRouter = express.Router();

// Protected Route: Must be logged in to record a transaction
inventoryRouter.post('/transaction', verifyToken, recordTransaction);

export default inventoryRouter;