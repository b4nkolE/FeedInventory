import { signUp, signIn } from "../controllers/auth.controllers.js";
import {Router} from "express";


const authRouter = Router();

authRouter.post("/signup", signUp);
authRouter.post("/signin", signIn);

export default authRouter;


