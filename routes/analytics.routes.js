// routes/analytics.routes.js
import express from 'express';
import { getAnalyticsSummary, getTopSellingFeeds, getManagerActions} from '../controllers/analytics.controllers.js';
import { verifyToken, authorizeRoles } from '../middlewares/auth.middlewares.js';

const analyticsRouter = express.Router();


analyticsRouter.get('/summary', verifyToken, authorizeRoles('MANAGER', 'ADMIN'), getAnalyticsSummary);
analyticsRouter.get('/top-selling', verifyToken, authorizeRoles('MANAGER', 'ADMIN'), getTopSellingFeeds);
analyticsRouter.get('/admin/manager-actions', verifyToken, authorizeRoles('ADMIN'), getManagerActions);



export default analyticsRouter;