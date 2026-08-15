import type { IUser, UserRole } from "../models/User.js";

export interface MyContext {
  token?: string;
  user: IUser | null;
}

export type AuthenticatedContext = MyContext & { user: IUser };

export function isRole(role: string, allowed: UserRole[]): boolean {
  return allowed.includes(role as UserRole);
}
