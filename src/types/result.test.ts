import { describe, it, expect } from "vitest";
import { isSuccess, isFailure, type Result } from "./result";

describe("Result helpers", () => {
  it("correctly identifies success results", () => {
    const res: Result<number, string> = {
      isSuccess: true,
      items: 123,
      error: null,
    };
    expect(isSuccess(res)).toBe(true);
    expect(isFailure(res)).toBe(false);
  });

  it("correctly identifies failure results", () => {
    const res: Result<number, string> = {
      isSuccess: false,
      items: null,
      error: "error",
    };
    expect(isSuccess(res)).toBe(false);
    expect(isFailure(res)).toBe(true);
  });
});
