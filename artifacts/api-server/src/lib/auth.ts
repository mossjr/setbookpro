import jwt from "jsonwebtoken";
import { type Request, type Response, type NextFunction } from "express";

const JWT_SECRET = process.env.SESSION_SECRET ?? "songbook-secret";
const APP_PASSWORD = process.env.APP_PASSWORD ?? "";

export function signToken(): string {
  return jwt.sign({ auth: true }, JWT_SECRET, { expiresIn: "30d" });
}

export function verifyPassword(password: string): boolean {
  return password === APP_PASSWORD;
}

export function verifyToken(token: string): boolean {
  try {
    jwt.verify(token, JWT_SECRET);
    return true;
  } catch {
    return false;
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const token = authHeader.slice(7);
  if (!verifyToken(token)) {
    res.status(401).json({ error: "Invalid token" });
    return;
  }
  next();
}

/**
 * Like requireAuth, but also accepts the token via a `?token=` query param.
 * Needed for media elements (e.g. <audio src>) that cannot attach an
 * Authorization header when fetching private uploaded files.
 */
export function requireAuthAllowQuery(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const authHeader = req.headers.authorization;
  let token: string | undefined;
  if (authHeader?.startsWith("Bearer ")) {
    token = authHeader.slice(7);
  } else if (typeof req.query.token === "string") {
    token = req.query.token;
  }
  if (!token || !verifyToken(token)) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
}
