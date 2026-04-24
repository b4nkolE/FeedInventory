// routes/inventoryRoutes.js
import express from 'express';
import { recordTransaction, getAllFeeds, getFeedById, createFeedItem, updateFeedItem, getAllTransactions } from '../controllers/inventory.controller.js';
import { verifyToken, authorizeRoles } from '../middlewares/auth.middlewares.js';

const inventoryRouter = express.Router();

// Protected Route: Must be logged in to record a transaction
inventoryRouter.post('/transaction', verifyToken, recordTransaction);
inventoryRouter.get('/transactions', verifyToken, authorizeRoles('MANAGER', 'ADMIN'), getAllTransactions);
inventoryRouter.get('/feeds', verifyToken, getAllFeeds);
inventoryRouter.get('/feeds/:id', verifyToken, getFeedById);
inventoryRouter.post('/feeds', verifyToken, createFeedItem);
inventoryRouter.put('/feeds/:id', verifyToken, updateFeedItem);
//inventoryRouter.get('feeds/:feedItemId/transactions', verifyToken, authorizeRoles('MANAGER', 'ADMIN'), getTransactionsByFeedId);
export default inventoryRouter;