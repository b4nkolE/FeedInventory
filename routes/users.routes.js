import express from "express"
import {getAllUsers, updateUserProfile, deleteUser} from '../controllers/users.controller.js'
import { authorizeRoles, verifyToken } from "../middlewares/auth.middlewares.js";







const userRouter = express.Router();

userRouter.get('/', verifyToken, authorizeRoles('MANAGER', 'ADMIN'), getAllUsers);
userRouter.put('/profile', verifyToken, updateUserProfile);
userRouter.delete('/:id', verifyToken, authorizeRoles('MANAGER', 'ADMIN'), deleteUser);


export default userRouter
