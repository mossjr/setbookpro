import { Router, type IRouter } from "express";
import { signToken, verifyPassword, verifyToken } from "../lib/auth";
import { LoginBody } from "@workspace/api-zod";

const router: IRouter = Router();

router.post("/auth/login", async (req, res): Promise<void> => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Missing password" });
    return;
  }
  if (!verifyPassword(parsed.data.password)) {
    res.status(401).json({ error: "Invalid password" });
    return;
  }
  const token = signToken();
  res.json({ authenticated: true, token });
});

router.post("/auth/logout", (_req, res): void => {
  res.json({ success: true });
});

router.get("/auth/me", (req, res): void => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ authenticated: false, token: null });
    return;
  }
  const token = authHeader.slice(7);
  if (!verifyToken(token)) {
    res.status(401).json({ authenticated: false, token: null });
    return;
  }
  res.json({ authenticated: true, token: null });
});

export default router;
