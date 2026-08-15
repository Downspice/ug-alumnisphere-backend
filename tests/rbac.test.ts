import { afterAll, afterEach, beforeAll, describe, expect, test } from "vitest";
import { createUser, errorCode, execute, resetDb, startTestDb, stopTestDb } from "./helpers.js";

beforeAll(startTestDb);
afterEach(resetDb);
afterAll(stopTestDb);

describe("RBAC", () => {
  test("given no session, jobs query is unauthenticated", async () => {
    const { errors } = await execute(`query { jobs { id } }`);
    expect(errorCode(errors)).toBe("UNAUTHENTICATED");
  });

  test("given a student, createJob is forbidden", async () => {
    const student = await createUser({
      email: "student.rbac@alumnisphere.ug",
      role: "student",
    });
    const { errors } = await execute(
      `mutation CreateJob($input: CreateJobInput!) {
        createJob(input: $input) { id }
      }`,
      {
        input: {
          title: "Intern role",
          company: "UG",
          location: "Accra",
          type: "internship",
          description: "A student should not be able to publish this listing at all.",
        },
      },
      student
    );
    expect(errorCode(errors)).toBe("FORBIDDEN");
  });

  test("given an alumni, createEvent is forbidden", async () => {
    const alumni = await createUser({ email: "alumni.rbac@alumnisphere.ug", role: "alumni" });
    const { errors } = await execute(
      `mutation CreateEvent($input: CreateEventInput!) {
        createEvent(input: $input) { id }
      }`,
      {
        input: {
          title: "Unauthorized mixer",
          description: "Alumni cannot create events from the public app.",
          location: "Accra",
          startsAt: "2026-11-01",
        },
      },
      alumni
    );
    expect(errorCode(errors)).toBe("FORBIDDEN");
  });

  test("given an admin, createEvent succeeds as a draft", async () => {
    const admin = await createUser({ email: "admin.rbac@alumnisphere.ug", role: "admin" });
    const { data, errors } = await execute<{ createEvent: { status: string } }>(
      `mutation CreateEvent($input: CreateEventInput!) {
        createEvent(input: $input) { status title }
      }`,
      {
        input: {
          title: "Admin mixer",
          description: "Administrators can create draft events for later publish.",
          location: "Accra",
          startsAt: "2026-11-01",
        },
      },
      admin
    );
    expect(errors).toBeFalsy();
    expect(data?.createEvent.status).toBe("draft");
  });

  test("given a non-admin, users list is forbidden", async () => {
    const alumni = await createUser({ email: "alumni.users@alumnisphere.ug" });
    const { errors } = await execute(`query { users { id } }`, {}, alumni);
    expect(errorCode(errors)).toBe("FORBIDDEN");
  });
});
