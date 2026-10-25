import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { resolveJwtSecret } from "../lib/jwtSecret.js";

// Resolved by server/lib/jwtSecret.ts, which refuses to produce a value in
// production unless JWT_SECRET is set. There is deliberately no fallback
// constant here: the one that used to live on this line was committed, and so
// was usable by anyone who could read the repository.
const JWT_SECRET = resolveJwtSecret();

export interface AuthPayload {
  userId: string;
  email: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthPayload;
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  // Accept token from cookie (primary) OR Authorization: Bearer header (fallback).
  // The Bearer fallback covers environments where cookies are stripped by a proxy
  // or blocked by the browser (e.g. certain Railway / CDN configurations).
  const cookieToken = req.cookies?.token as string | undefined;
  const bearerToken = (() => {
    const auth = req.headers.authorization;
    if (auth && auth.startsWith("Bearer ")) return auth.slice(7);
    return undefined;
  })();
  const token = cookieToken ?? bearerToken;

  if (!token) {
    console.warn(`[auth] No token found for ${req.method} ${req.path}. cookie=${!!cookieToken} bearer=${!!bearerToken}`);
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET) as AuthPayload;
    req.user = payload;
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired session" });
  }
}

export function signToken(payload: AuthPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "30d" });
}
