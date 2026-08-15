import jwt from "jsonwebtoken";
import { hash, compare } from "bcryptjs";
import { User, IUser, UserRole, PRODUCT_ROLES } from "../models/User.js";
import type { MyContext, AuthenticatedContext } from "../types/context.js";
import { forbidden, unauthenticated } from "./errors.js";

const JWT_EXPIRES_IN = "7d";
const BCRYPT_ROUNDS = 12;

export interface AuthTokenPayload {
  sub: string;
  role: UserRole;
}

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error(
      "JWT_SECRET is missing or shorter than 16 characters. Set it in backend/.env."
    );
  }
  return secret;
}

export async function hashPassword(password: string): Promise<string> {
  return hash(password, BCRYPT_ROUNDS);
}

export async function verifyPassword(
  password: string,
  passwordHash: string
): Promise<boolean> {
  return compare(password, passwordHash);
}

export function signAuthToken(user: IUser): string {
  const payload: AuthTokenPayload = {
    sub: user._id.toString(),
    role: normalizeRole(user.role),
  };
  return jwt.sign(payload, getJwtSecret(), { expiresIn: JWT_EXPIRES_IN });
}

export function verifyAuthToken(token: string): AuthTokenPayload {
  const decoded = jwt.verify(token, getJwtSecret());
  if (typeof decoded === "string" || !decoded.sub) {
    throw new Error("Invalid token payload");
  }
  return {
    sub: String(decoded.sub),
    role: normalizeRole(String(decoded.role)),
  };
}

export function extractBearerToken(header?: string): string | null {
  if (!header) return null;
  const [scheme, value] = header.split(" ");
  if (!value) return header.startsWith("Bearer") ? null : header;
  if (scheme.toLowerCase() !== "bearer") return null;
  return value.trim() || null;
}

export function normalizeRole(role: string): UserRole {
  if (role === "instructor") return "alumni";
  if (PRODUCT_ROLES.includes(role as UserRole)) return role as UserRole;
  return "alumni";
}

export async function resolveUserFromToken(header?: string): Promise<IUser | null> {
  const token = extractBearerToken(header);
  if (!token) return null;

  try {
    const payload = verifyAuthToken(token);
    const user = await User.findById(payload.sub);
    if (!user) return null;
    if (user.accountStatus === "suspended") return null;
    return user;
  } catch {
    return null;
  }
}

export function requireAuth(context: MyContext): AuthenticatedContext {
  if (!context.user) {
    unauthenticated("Sign in to continue.");
  }
  if (context.user.accountStatus === "suspended") {
    forbidden("This account has been suspended.");
  }
  return context as AuthenticatedContext;
}

export function requireRole(context: MyContext, roles: UserRole[]): AuthenticatedContext {
  const auth = requireAuth(context);
  const role = normalizeRole(auth.user.role);
  if (!roles.includes(role)) {
    forbidden("You do not have permission to perform this action.");
  }
  return auth;
}

export function requireAdmin(context: MyContext): AuthenticatedContext {
  return requireRole(context, ["admin"]);
}

export function validatePasswordStrength(password: string): string | null {
  if (password.length < 8) {
    return "Password must be at least 8 characters.";
  }
  if (password.length > 72) {
    return "Password must be 72 characters or fewer.";
  }
  if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
    return "Password must include at least one letter and one number.";
  }
  return null;
}

export function isSelfOrAdmin(context: MyContext, userId: string): boolean {
  if (!context.user) return false;
  const role = normalizeRole(context.user.role);
  return role === "admin" || context.user._id.toString() === userId;
}
