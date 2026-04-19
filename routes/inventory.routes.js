// routes/inventoryRoutes.js
import express from 'express';
import { recordTransaction, getAllFeeds, getFeedById, createFeedItem, updateFeedItem } from '../controllers/inventory.controller.js';
import { verifyToken } from '../middlewares/auth.middlewares.js'; 

const inventoryRouter = express.Router();

// Protected Route: Must be logged in to record a transaction
inventoryRouter.post('/transaction', verifyToken, recordTransaction);
inventoryRouter.get('/feeds', verifyToken, getAllFeeds);
inventoryRouter.get('/feeds/:id', verifyToken, getFeedById);
inventoryRouter.post('/feeds', verifyToken, createFeedItem);
inventoryRouter.put('/feeds/:id', verifyToken, updateFeedItem)
export default inventoryRouter;