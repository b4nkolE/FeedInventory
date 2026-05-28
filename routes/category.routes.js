import express from "express"
import {createCategory, getAllCategories, updateCategory, deleteCategory, getCategoryById} from "../controllers/category.controllers.js";
import { verifyToken, authorizeRoles } from "../middlewares/auth.middlewares.js";

const categoryRouter = express.Router();

categoryRouter.post('/createCategories', verifyToken, authorizeRoles('MANAGER', 'ADMIN'), createCategory);
categoryRouter.get('/getCategories', verifyToken, getAllCategories);
categoryRouter.get('/getCategories/:id', verifyToken, getCategoryById);
categoryRouter.put('/updateCategories/:id', verifyToken, authorizeRoles('MANAGER', 'ADMIN'), updateCategory);
categoryRouter.delete('/deleteCategories/:id', verifyToken, authorizeRoles('MANAGER', 'ADMIN'), deleteCategory);


export default categoryRouter;

