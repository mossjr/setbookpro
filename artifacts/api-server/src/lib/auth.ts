import jwt from "jsonwebtoken";
import { type Request, type Response, type NextFunction } from "express";

function requireEnv(name: string, why: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required: ${why}`);
  }
  return value;
}

// Fail fast rather than fall back to a public default — a guessable JWT secret
// makes both REST and Socket.io auth forgeable.
const JWT_SECRET = requireEnv(
  "SESSION_SECRET",
  "without it JWTs are forgeable and socket/REST auth can be bypassed",
);
const APP_PASSWORD = requireEnv(
  "APP_PASSWORD",
  "it is the single password gating login for the whole app",
);

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
