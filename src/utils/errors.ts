import { GraphQLError } from "graphql";

export function badUserInput(message: string, details?: string): never {
  throw new GraphQLError(message, {
    extensions: {
      code: "BAD_USER_INPUT",
      ...(details ? { details } : {}),
    },
  });
}

export function notFound(message: string): never {
  throw new GraphQLError(message, {
    extensions: { code: "NOT_FOUND" },
  });
}

export function unauthenticated(message = "Authentication is required."): never {
  throw new GraphQLError(message, {
    extensions: { code: "UNAUTHENTICATED" },
  });
}

export function forbidden(message = "You do not have permission to perform this action."): never {
  throw new GraphQLError(message, {
    extensions: { code: "FORBIDDEN" },
  });
}

export function internalError(message: string, originalError?: unknown): never {
  throw new GraphQLError(message, {
    extensions: {
      code: "INTERNAL_SERVER_ERROR",
      originalError:
        originalError instanceof Error ? originalError.message : originalError
          ? String(originalError)
          : undefined,
    },
  });
}

export function assertValidObjectId(
  id: string,
  label = "ID",
  mongoose: { Types: { ObjectId: { isValid: (id: string) => boolean } } }
): void {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    badUserInput(`Invalid ${label} format: '${id}'`);
  }
}
