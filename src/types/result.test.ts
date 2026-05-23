import { describe, it, expect } from "vitest";
import { isSuccess, isFailure, type Result } from "./result";

describe("Result helpers", () => {
  it("correctly identifies success results", () => {
    const res: Result<number, string> = {
      isSuccess: true,
      value: 123,
      error: undefined,
    };
    expect(isSuccess(res)).toBe(true);
    expect(isFailure(res)).toBe(false);
  });

  it("correctly identifies failure results", () => {
    const res: Result<number, string> = {
      isSuccess: false,
      value: undefined,
      error: "error",
    };
    expect(isSuccess(res)).toBe(false);
    expect(isFailure(res)).toBe(true);
  });
});
