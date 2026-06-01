import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { ErrorCard } from "./ErrorCard";
import {
  ScraperError,
  ScraperHttpError,
  ScraperParseError,
  ScraperUnknownError,
} from "../../errors";
import { ScraperScanStep } from "../../errors/scraper-scan-step";

describe("ErrorCard", () => {
  const writeTextMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("navigator", {
      clipboard: {
        writeText: writeTextMock,
      },
    });
    writeTextMock.mockReset();
    vi.useRealTimers();
  });

  it("renders HTTP error with title correctly", () => {
    const error = new ScraperHttpError(
      2,
      "https://ani.gamer.com.tw/animeList.php?page=2",
      "HTTP 500",
      500,
      "葬送的芙莉蓮",
    );

    render(<ErrorCard error={error} />);

    expect(screen.getByTestId("error-card-title").textContent).toBe(
      "葬送的芙莉蓮",
    );
    expect(screen.getByTestId("error-card-subtitle").textContent).toBe(
      "Page: 2, Status: 500",
    );
    expect(screen.getByTestId("error-card-message").textContent).toBe(
      error.message,
    );
  });

  it("renders HTTP error without title correctly", () => {
    const error = new ScraperHttpError(
      3,
      "https://ani.gamer.com.tw/animeList.php?page=3",
      "HTTP 502",
      502,
    );

    render(<ErrorCard error={error} />);

    expect(screen.getByTestId("error-card-title").textContent).toBe("Page: 3");
    expect(screen.getByTestId("error-card-subtitle").textContent).toBe(
      "Status: 502",
    );
  });

  it("renders Parser error with title correctly", () => {
    const error = new ScraperParseError(
      5,
      ScraperScanStep.TITLE,
      "https://ani.gamer.com.tw/animeList.php?page=5",
      "bad html",
      "Parse failed",
      "鬼滅之刃",
    );

    render(<ErrorCard error={error} />);

    expect(screen.getByTestId("error-card-title").textContent).toBe("鬼滅之刃");
    expect(screen.getByTestId("error-card-subtitle").textContent).toBe(
      "Page: 5, When doing: parsing Title",
    );
  });

  it("renders Parser error without title or page correctly", () => {
    const error = new ScraperParseError(
      0,
      ScraperScanStep.DESCRIPTION,
      "https://ani.gamer.com.tw/anime.php",
      "bad html",
      "Parse failed",
    );

    render(<ErrorCard error={error} />);

    expect(screen.getByTestId("error-card-title").textContent).toBe(
      "Parser Error",
    );
    expect(screen.getByTestId("error-card-subtitle").textContent).toBe(
      "When doing: parsing Description",
    );
  });

  it("renders Parser error with various other ScraperScanStep values", () => {
    const sources = [
      {
        source: ScraperScanStep.PAGINATION,
        expected: "When doing: parsing Pagination",
      },
      {
        source: ScraperScanStep.WATCH_COUNT,
        expected: "When doing: parsing Watch Count",
      },
      {
        source: ScraperScanStep.EPISODE_COUNT,
        expected: "When doing: parsing Episode Count",
      },
      {
        source: ScraperScanStep.UPLOAD_DATE,
        expected: "When doing: parsing Upload Date",
      },
      {
        source: ScraperScanStep.SCORE,
        expected: "When doing: parsing Score",
      },
      {
        source: ScraperScanStep.RATING_COUNT,
        expected: "When doing: parsing Rating Count",
      },
      { source: 999 as ScraperScanStep, expected: "When doing: parsing" },
    ];

    for (const { source, expected } of sources) {
      const error = new ScraperParseError(
        0,
        source,
        "https://ani.gamer.com.tw/anime.php",
        "bad html",
        "Parse failed",
      );
      const { unmount } = render(<ErrorCard error={error} />);
      expect(screen.getByTestId("error-card-subtitle").textContent).toBe(
        expected,
      );
      unmount();
    }
  });

  it("renders Unknown/Fatal error and handles copy click", async () => {
    vi.useFakeTimers();
    const error = new ScraperUnknownError(new Error("Fatal System Error"));
    writeTextMock.mockResolvedValue(undefined);

    render(<ErrorCard error={error} />);

    expect(screen.getByTestId("error-card-title").textContent).toBe(
      "ScraperUnknownError",
    );

    const copyBtn = screen.getByTestId("error-card-copy-btn");
    expect(copyBtn.textContent).toBe("Copy");

    await act(async () => {
      fireEvent.click(copyBtn);
    });

    expect(writeTextMock).toHaveBeenCalled();
    const copiedText = writeTextMock.mock.calls[0][0];
    expect(copiedText).toBe(error.toString());

    expect(copyBtn.textContent).toBe("Copied! ✓");

    // Advance timers by 2 seconds to cover setTimeout callback
    await act(async () => {
      vi.advanceTimersByTime(2000);
    });
    expect(copyBtn.textContent).toBe("Copy");
  });

  it("renders fallbackTitle using error.name when page, title, and other properties are missing", () => {
    class CustomError extends ScraperError {
      constructor() {
        super("Custom msg", 0, ScraperScanStep.SYSTEM, "unknown");
        this.name = "TestCustomError";
      }
    }
    const error = new CustomError();
    render(<ErrorCard error={error} />);
    expect(screen.getByTestId("error-card-title").textContent).toBe(
      "TestCustomError",
    );
  });

  it("handles copy failure gracefully", async () => {
    const error = new ScraperHttpError(
      1,
      "https://ani.gamer.com.tw/animeList.php?page=1",
      "HTTP 404",
      404,
    );
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    writeTextMock.mockRejectedValue(new Error("Clipboard block"));

    render(<ErrorCard error={error} />);

    const copyBtn = screen.getByTestId("error-card-copy-btn");
    await act(async () => {
      fireEvent.click(copyBtn);
    });

    expect(writeTextMock).toHaveBeenCalled();
    expect(consoleSpy).toHaveBeenCalledWith(
      "Failed to copy error details",
      expect.any(Error),
    );
    consoleSpy.mockRestore();
  });
});
