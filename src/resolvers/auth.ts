import { User, UserRole } from "../models/User.js";
import type { MyContext } from "../types/context.js";
import {
  hashPassword,
  normalizeRole,
  requireAuth,
  signAuthToken,
  validatePasswordStrength,
  verifyPassword,
} from "../utils/auth.js";
import { badUserInput, forbidden, internalError } from "../utils/errors.js";

interface RegisterInput {
  name: string;
  email: string;
  password: string;
  role?: UserRole;
}

interface LoginInput {
  email: string;
  password: string;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const authResolvers = {
  Query: {
    me: async (_: unknown, __: unknown, context: MyContext) => {
      return context.user;
    },
  },

  Mutation: {
    register: async (_: unknown, { input }: { input: RegisterInput }) => {
      const name = input.name?.trim();
      const email = input.email?.trim().toLowerCase();
      const requestedRole = input.role ?? "alumni";

      if (!name || name.length < 2) {
        badUserInput("Full name must be at least 2 characters.");
      }
      if (!email || !EMAIL_PATTERN.test(email)) {
        badUserInput("A valid email address is required.");
      }

      const passwordError = validatePasswordStrength(input.password);
      if (passwordError) {
        badUserInput(passwordError);
      }

      if (requestedRole === "admin") {
        forbidden("Administrator accounts cannot be self-registered.");
      }
      if (requestedRole !== "alumni" && requestedRole !== "student") {
        badUserInput("Role must be alumni or student.");
      }

      try {
        const existing = await User.findOne({ email });
        if (existing) {
          badUserInput("An account with this email already exists.");
        }

        const user = await User.create({
          name,
          email,
          passwordHash: await hashPassword(input.password),
          role: requestedRole,
          accountStatus: "active",
          verificationStatus: requestedRole === "alumni" ? "unverified" : "unverified",
        });

        return {
          token: signAuthToken(user),
          user,
        };
      } catch (error) {
        if ((error as { extensions?: { code?: string } }).extensions?.code) {
          throw error;
        }
        internalError("Failed to create account.", error);
      }
    },

    login: async (_: unknown, { input }: { input: LoginInput }) => {
      const email = input.email?.trim().toLowerCase();
      if (!email || !input.password) {
        badUserInput("Email and password are required.");
      }

      try {
        const user = await User.findOne({ email }).select("+passwordHash");
        if (!user?.passwordHash) {
          badUserInput("Incorrect email or password.");
        }

        const matches = await verifyPassword(input.password, user.passwordHash);
        if (!matches) {
          badUserInput("Incorrect email or password.");
        }

        if (user.accountStatus === "suspended") {
          forbidden("This account has been suspended. Contact an administrator.");
        }

        user.role = normalizeRole(user.role);
        return {
          token: signAuthToken(user),
          user,
        };
      } catch (error) {
        if ((error as { extensions?: { code?: string } }).extensions?.code) {
          throw error;
        }
        internalError("Failed to sign in.", error);
      }
    },

    logout: async (_: unknown, __: unknown, context: MyContext) => {
      requireAuth(context);
      return true;
    },
  },

  AuthPayload: {
    user: (parent: { user: { __selfVisible?: boolean } }) => {
      parent.user.__selfVisible = true;
      return parent.user;
    },
  },
};
