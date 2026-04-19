import { signUp, signIn, getMe } from "../controllers/auth.controllers.js";
import {Router} from "express";
import {verifyToken} from "../middlewares/auth.middlewares.js"


const authRouter = Router();

authRouter.post("/signup", signUp);
authRouter.post("/signin", signIn);
authRouter.get('/me', verifyToken, getMe);

export default authRouter;


