import { afterAll, afterEach, beforeAll, describe, expect, test } from "vitest";
import { createUser, errorCode, execute, resetDb, startTestDb, stopTestDb } from "./helpers.js";

beforeAll(startTestDb);
afterEach(resetDb);
afterAll(stopTestDb);

describe("ObjectId and ownership", () => {
  test("given an invalid job id, the API returns BAD_USER_INPUT", async () => {
    const user = await createUser({ email: "ids@alumnisphere.ug" });
    const { errors } = await execute(`query Job($id: ID!) { job(id: $id) { id } }`, { id: "not-an-id" }, user);
    expect(errorCode(errors)).toBe("BAD_USER_INPUT");
    expect(errors?.[0].message).toContain("Invalid Job ID");
  });

  test("given a missing job id, the API returns NOT_FOUND", async () => {
    const user = await createUser({ email: "missing@alumnisphere.ug" });
    const { errors } = await execute(
      `query Job($id: ID!) { job(id: $id) { id } }`,
      { id: "64f000000000000000000001" },
      user
    );
    expect(errorCode(errors)).toBe("NOT_FOUND");
  });

  test("given another person's application, withdraw is forbidden", async () => {
    const poster = await createUser({ email: "poster@alumnisphere.ug" });
    const applicant = await createUser({ email: "applicant@alumnisphere.ug", role: "student" });
    const stranger = await createUser({ email: "stranger@alumnisphere.ug" });

    const job = await execute<{ createJob: { id: string } }>(
      `mutation CreateJob($input: CreateJobInput!) { createJob(input: $input) { id } }`,
      {
        input: {
          title: "Owned listing",
          company: "UG",
          location: "Accra",
          type: "full_time",
          description: "Used to prove applicants cannot withdraw each other's records.",
        },
      },
      poster
    );
    const jobId = job.data?.createJob.id;

    const application = await execute<{ applyToJob: { id: string } }>(
      `mutation Apply($jobId: ID!, $coverNote: String!) {
        applyToJob(jobId: $jobId, coverNote: $coverNote) { id }
      }`,
      { jobId, coverNote: "I would like to join this team and contribute to the product." },
      applicant
    );
    expect(application.errors).toBeFalsy();

    const { errors } = await execute(
      `mutation Withdraw($id: ID!) { withdrawApplication(id: $id) { id } }`,
      { id: application.data?.applyToJob.id },
      stranger
    );
    expect(errorCode(errors)).toBe("FORBIDDEN");
  });
});
