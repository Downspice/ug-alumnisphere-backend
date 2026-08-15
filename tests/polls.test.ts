import { afterAll, afterEach, beforeAll, describe, expect, test } from "vitest";
import { createUser, errorCode, execute, resetDb, startTestDb, stopTestDb } from "./helpers.js";
import { PollVote } from "../src/models/PollVote.js";

beforeAll(startTestDb);
afterEach(resetDb);
afterAll(stopTestDb);

describe("poll uniqueness", () => {
  test("given a user already voted, a second vote is rejected and only one vote exists", async () => {
    const author = await createUser({ email: "poll.author@alumnisphere.ug" });
    const voter = await createUser({ email: "poll.voter@alumnisphere.ug" });

    const created = await execute<{ createPost: { id: string } }>(
      `mutation CreatePost($input: CreatePostInput!) {
        createPost(input: $input) { id }
      }`,
      {
        input: {
          type: "poll",
          pollQuestion: "Which clinic first?",
          pollOptions: ["Mentorship", "Jobs"],
        },
      },
      author
    );
    expect(created.errors).toBeFalsy();
    const postId = created.data?.createPost.id;
    expect(postId).toBeTruthy();

    const first = await execute(
      `mutation Vote($postId: ID!, $optionIndex: Int!) {
        votePoll(postId: $postId, optionIndex: $optionIndex) { pollTotalVotes }
      }`,
      { postId, optionIndex: 0 },
      voter
    );
    expect(first.errors).toBeFalsy();

    const second = await execute(
      `mutation Vote($postId: ID!, $optionIndex: Int!) {
        votePoll(postId: $postId, optionIndex: $optionIndex) { pollTotalVotes }
      }`,
      { postId, optionIndex: 1 },
      voter
    );
    expect(errorCode(second.errors)).toBe("BAD_USER_INPUT");
    expect(second.errors?.[0].message).toContain("already voted");

    expect(await PollVote.countDocuments({ postId, userId: voter._id })).toBe(1);
  });
});
