import express from "express"
import {createCategory, getAllCategories, updateCategory, deleteCategory} from "../controllers/category.controllers.js";
import { verifyToken, authorizeRoles } from "../middlewares/auth.middlewares.js";

const categoryRouter = express.Router();

categoryRouter.post('/createCategories', verifyToken, authorizeRoles('MANAGER', 'ADMIN'), createCategory);
categoryRouter.get('/getCategories', verifyToken, getAllCategories);
categoryRouter.put('/updateCategories/:id', verifyToken, authorizeRoles('MANAGER', 'ADMIN'), updateCategory);
categoryRouter.delete('/updateCategories/:id', verifyToken, authorizeRoles('MANAGER', 'ADMIN'), deleteCategory);


export default categoryRouter;

