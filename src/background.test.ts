import { describe, it, expect, vi } from "vitest";

describe("background", () => {
  it("initializes without error", async () => {
    const logSpy = vi.spyOn(console, "log");
    await import("./background");
    expect(logSpy).toHaveBeenCalledWith("Service worker initialized.");
  });
});
