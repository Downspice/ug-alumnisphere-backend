import { afterAll, afterEach, beforeAll, describe, expect, test } from "vitest";
import { createUser, errorCode, execute, resetDb, startTestDb, stopTestDb } from "./helpers.js";

beforeAll(startTestDb);
afterEach(resetDb);
afterAll(stopTestDb);

describe("auth", () => {
  test("given valid register input, it creates an alumni account and returns a token", async () => {
    const { data, errors } = await execute<{
      register: { token: string; user: { email: string; role: string } };
    }>(
      `mutation Register($input: RegisterInput!) {
        register(input: $input) { token user { email role } }
      }`,
      {
        input: {
          name: "Ama Test",
          email: "ama.test@alumnisphere.ug",
          password: "AlumniSphere#2026",
          role: "alumni",
        },
      }
    );

    expect(errors).toBeFalsy();
    expect(data?.register.token).toBeTruthy();
    expect(data?.register.user).toMatchObject({
      email: "ama.test@alumnisphere.ug",
      role: "alumni",
    });
  });

  test("given register is called with role admin, it is forbidden", async () => {
    const { errors } = await execute(
      `mutation Register($input: RegisterInput!) {
        register(input: $input) { token }
      }`,
      {
        input: {
          name: "Admin Attempt",
          email: "admin.attempt@alumnisphere.ug",
          password: "AlumniSphere#2026",
          role: "admin",
        },
      }
    );

    expect(errorCode(errors)).toBe("FORBIDDEN");
    expect(errors?.[0].message).toContain("cannot be self-registered");
  });

  test("given an existing account, login returns a token", async () => {
    await createUser({ email: "login@alumnisphere.ug", name: "Login User" });
    const { data, errors } = await execute<{
      login: { token: string; user: { email: string } };
    }>(
      `mutation Login($input: LoginInput!) {
        login(input: $input) { token user { email } }
      }`,
      { input: { email: "login@alumnisphere.ug", password: "AlumniSphere#2026" } }
    );

    expect(errors).toBeFalsy();
    expect(data?.login.token).toBeTruthy();
    expect(data?.login.user.email).toBe("login@alumnisphere.ug");
  });

  test("given a wrong password, login returns BAD_USER_INPUT", async () => {
    await createUser({ email: "wrong@alumnisphere.ug" });
    const { errors } = await execute(
      `mutation Login($input: LoginInput!) {
        login(input: $input) { token }
      }`,
      { input: { email: "wrong@alumnisphere.ug", password: "not-the-password1" } }
    );

    expect(errorCode(errors)).toBe("BAD_USER_INPUT");
  });

  test("given no auth context, me returns null", async () => {
    const { data, errors } = await execute<{ me: null }>(`query { me { id } }`);
    expect(errors).toBeFalsy();
    expect(data?.me).toBeNull();
  });

  test("given an authenticated user, me returns that user", async () => {
    const user = await createUser({ email: "me@alumnisphere.ug", name: "Me User" });
    const { data, errors } = await execute<{ me: { email: string } }>(`query { me { email } }`, {}, user);
    expect(errors).toBeFalsy();
    expect(data?.me.email).toBe("me@alumnisphere.ug");
  });
});
