import { Router } from "express";

const authRouter = Router();

authRouter.post("/sign-up", (re, res) => res.send({ title: "Sign up" }));

authRouter.post("/sign-in", (re, res) => res.send({ title: "Sign in" }));

authRouter.post("/sign-out", (re, res) => res.send({ title: "Sign out" }));

export default authRouter;
