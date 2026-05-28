import { signUp, signIn, getMe, refreshToken } from "../controllers/auth.controllers.js";
import {Router} from "express";
import {verifyToken} from "../middlewares/auth.middlewares.js"


const authRouter = Router();

authRouter.post("/signup", signUp);
authRouter.post("/signin", signIn);
authRouter.get('/me', verifyToken, getMe);
authRouter.post('/refresh-token', refreshToken);

export default authRouter;


