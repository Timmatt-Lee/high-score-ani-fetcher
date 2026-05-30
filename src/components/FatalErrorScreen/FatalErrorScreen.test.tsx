import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { FatalErrorScreen } from "./FatalErrorScreen";
import {
  ScraperHttpError,
  ScraperParseError,
  ScraperErrorSource,
  ScraperUnknownError,
} from "../../errors";

describe("FatalErrorScreen", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders fatal error screen, allows copying error details, and allows dismissal", async () => {
    const writeTextSpy = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", {
      clipboard: {
        writeText: writeTextSpy,
      },
    });

    const fatalErr = new ScraperHttpError(
      "https://ani.gamer.com.tw/error",
      "Bad Request",
      400,
    );
    const onDismissSpy = vi.fn();

    render(<FatalErrorScreen fatalError={fatalErr} onDismiss={onDismissSpy} />);

    expect(screen.getByTestId("fatal-error-screen")).toBeDefined();
    expect(screen.getByText("ScraperHttpError")).toBeDefined();
    expect(
      screen.getAllByText(/HTTP request failed with status 400/).length,
    ).toBeGreaterThan(0);

    // Verify copy button copies details
    vi.useFakeTimers();
    const copyBtn = screen.getByTestId("copy-error-btn");
    await act(async () => {
      fireEvent.click(copyBtn);
    });
    expect(writeTextSpy).toHaveBeenCalled();
    const copiedText = writeTextSpy.mock.calls[0][0];
    expect(copiedText).toContain("Error Name: ScraperHttpError");
    expect(copiedText).toContain("Status Code: 400");
    expect(copiedText).toContain("URL: https://ani.gamer.com.tw/error");

    expect(screen.getByText("Copied! ✓")).toBeDefined();

    // Fast-forward timers to run setTimeout callback
    await act(async () => {
      vi.advanceTimersByTime(2000);
    });
    expect(screen.queryByText("Copied! ✓")).toBeNull();

    // Verify dismiss button calls onDismiss
    const dismissBtn = screen.getByTestId("dismiss-error-btn");
    await act(async () => {
      fireEvent.click(dismissBtn);
    });
    expect(onDismissSpy).toHaveBeenCalled();
  });

  it("handles copy failure gracefully when navigator.clipboard throws", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal("navigator", {
      clipboard: {
        writeText: vi.fn().mockRejectedValue(new Error("clipboard blocked")),
      },
    });

    const fatalErr = new ScraperHttpError(
      "https://ani.gamer.com.tw/error",
      "Bad Request",
      400,
    );
    render(<FatalErrorScreen fatalError={fatalErr} onDismiss={vi.fn()} />);

    const copyBtn = screen.getByTestId("copy-error-btn");
    await act(async () => {
      fireEvent.click(copyBtn);
    });
    expect(consoleSpy).toHaveBeenCalledWith(
      "Failed to copy error details",
      expect.any(Error),
    );
    consoleSpy.mockRestore();
  });

  it("displays source component in formatted error details when fatal error is ScraperParseError", () => {
    const fatalErr = new ScraperParseError(
      ScraperErrorSource.TITLE,
      "https://ani.gamer.com.tw/error",
      "Bad HTML",
      "Title element missing",
    );
    render(<FatalErrorScreen fatalError={fatalErr} onDismiss={vi.fn()} />);

    const textarea = screen.getByTestId(
      "error-details-textarea",
    ) as HTMLTextAreaElement;
    expect(textarea.value).toContain(
      `Source Component: ${ScraperErrorSource.TITLE}`,
    );
  });

  it("displays formatted error details when fatal error does not have a stack trace", () => {
    const fatalErr = new ScraperUnknownError(new Error("no stack error"));
    Object.defineProperty(fatalErr, "stack", {
      value: undefined,
      configurable: true,
    });
    render(<FatalErrorScreen fatalError={fatalErr} onDismiss={vi.fn()} />);

    const textarea = screen.getByTestId(
      "error-details-textarea",
    ) as HTMLTextAreaElement;
    expect(textarea.value).not.toContain("Stack Trace:");
  });
});
