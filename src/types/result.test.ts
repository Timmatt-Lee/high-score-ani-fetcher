import { describe, it, expect } from "vitest";
import { isSuccess, isError, type Result } from "./result";

describe("Result helpers", () => {
  it("correctly identifies success results", () => {
    const res: Result<number, Error> = 123;
    expect(isSuccess(res)).toBe(true);
    expect(isError(res)).toBe(false);
  });

  it("correctly identifies failure results", () => {
    const res: Result<number, Error> = new Error("error");
    expect(isSuccess(res)).toBe(false);
    expect(isError(res)).toBe(true);
  });
});
