import { describe, expect, test } from "vitest";
import { parsePurpose, validateUploadFile } from "../src/utils/storage.js";

describe("storage validation", () => {
  test("given an unknown purpose, parsePurpose throws BAD_USER_INPUT", () => {
    expect(() => parsePurpose("invoice")).toThrow(/purpose/i);
  });

  test("given a PDF resume under the size limit, validation passes", () => {
    expect(() =>
      validateUploadFile("resume", {
        mimetype: "application/pdf",
        size: 120_000,
        originalname: "cv.pdf",
      })
    ).not.toThrow();
  });

  test("given a video as an avatar, validation fails", () => {
    expect(() =>
      validateUploadFile("avatar", {
        mimetype: "video/mp4",
        size: 1000,
        originalname: "clip.mp4",
      })
    ).toThrow(/not allowed/i);
  });
});
