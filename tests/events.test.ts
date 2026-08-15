import { afterAll, afterEach, beforeAll, describe, expect, test } from "vitest";
import {
  createUser,
  errorCode,
  execute,
  resetDb,
  startTestDb,
  stopTestDb,
} from "./helpers.js";
import { EventRegistration } from "../src/models/EventRegistration.js";

beforeAll(startTestDb);
afterEach(resetDb);
afterAll(stopTestDb);

describe("event registration uniqueness", () => {
  test("given a user is already registered, a second register is rejected", async () => {
    const admin = await createUser({
      email: "event.admin@alumnisphere.ug",
      role: "admin",
    });
    const attendee = await createUser({ email: "event.user@alumnisphere.ug" });

    const created = await execute<{ createEvent: { id: string } }>(
      `mutation CreateEvent($input: CreateEventInput!) {
        createEvent(input: $input) { id }
      }`,
      {
        input: {
          title: "Alumni mixer",
          description: "An evening for classmates and mentors to meet in Accra.",
          location: "Accra",
          startsAt: "2026-11-12",
          capacity: 80,
        },
      },
      admin
    );
    const eventId = created.data?.createEvent.id;
    expect(eventId).toBeTruthy();

    const published = await execute(
      `mutation Publish($id: ID!) { publishEvent(id: $id) { status } }`,
      { id: eventId },
      admin
    );
    expect(published.errors).toBeFalsy();

    const first = await execute(
      `mutation Register($eventId: ID!) { registerForEvent(eventId: $eventId) { id } }`,
      { eventId },
      attendee
    );
    expect(first.errors).toBeFalsy();

    const second = await execute(
      `mutation Register($eventId: ID!) { registerForEvent(eventId: $eventId) { id } }`,
      { eventId },
      attendee
    );
    expect(errorCode(second.errors)).toBe("BAD_USER_INPUT");
    expect(second.errors?.[0].message).toContain("already registered");
    expect(
      await EventRegistration.countDocuments({ eventId, userId: attendee._id })
    ).toBe(1);
  });
});
