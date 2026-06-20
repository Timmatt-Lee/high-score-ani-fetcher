import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { ErrorCard } from "./ErrorCard";
import {
  AnimeScanError,
  AnimeScanHttpError,
  AnimeScanParseError,
  AnimeScanStep,
} from "../../services/animeScanner";

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

  it("renders HTTP error with title correctly and handles copy", async () => {
    const error = new AnimeScanHttpError(
      2,
      AnimeScanStep.GET_TOTAL_PAGES,
      "https://ani.gamer.com.tw/animeList.php?page=2",
      "HTTP 500",
      500,
      "葬送的芙莉蓮",
    );
    writeTextMock.mockResolvedValue(undefined);

    render(<ErrorCard error={error} />);

    expect(screen.getByTestId("error-card-title").textContent).toBe(
      "葬送的芙莉蓮",
    );
    expect(screen.getByTestId("error-card-subtitle").textContent).toBe(
      "Page: 2, Status Code: 500, When doing: fetching total pages",
    );
    expect(screen.getByTestId("error-card-message").textContent).toBe(
      error.message,
    );

    const copyBtn = screen.getByTestId("error-card-copy-btn");
    await act(async () => {
      fireEvent.click(copyBtn);
    });
    expect(copyBtn.textContent).toBe("Copied! ✓");
  });

  it("renders HTTP error without title correctly", () => {
    const error = new AnimeScanHttpError(
      3,
      AnimeScanStep.GET_TOTAL_PAGES,
      "https://ani.gamer.com.tw/animeList.php?page=3",
      "HTTP 502",
      502,
      undefined,
    );

    render(<ErrorCard error={error} />);

    expect(screen.getByTestId("error-card-title").textContent).toBe("Page: 3");
    expect(screen.getByTestId("error-card-subtitle").textContent).toBe(
      "Status Code: 502, When doing: fetching total pages",
    );
  });

  it("renders Parser error with title correctly", () => {
    const error = new AnimeScanParseError(
      5,
      AnimeScanStep.PARSE_ANIME_INFO,
      "https://ani.gamer.com.tw/animeList.php?page=5",
      "bad html",
      "Parse failed",
      "鬼滅之刃",
    );

    render(<ErrorCard error={error} />);

    expect(screen.getByTestId("error-card-title").textContent).toBe("鬼滅之刃");
    expect(screen.getByTestId("error-card-subtitle").textContent).toBe(
      "Page: 5, When doing: parsing anime info",
    );
  });

  it("renders Parser error without title or page correctly", () => {
    const error = new AnimeScanParseError(
      0,
      AnimeScanStep.PARSE_ANIME_DETAIL,
      "https://ani.gamer.com.tw/anime.php",
      "bad html",
      "Parse failed",
    );

    render(<ErrorCard error={error} />);

    expect(screen.getByTestId("error-card-title").textContent).toBe(
      "Parser Error",
    );
    expect(screen.getByTestId("error-card-subtitle").textContent).toBe(
      "When doing: parsing anime detail",
    );
  });

  it("renders Parser error with various other AnimeScanStep values", () => {
    const sources = [
      {
        source: AnimeScanStep.GET_TOTAL_PAGES,
        expected: "When doing: fetching total pages",
      },
      {
        source: AnimeScanStep.SCRAPE_LIST_PAGE,
        expected: "When doing: scraping list page",
      },
      {
        source: AnimeScanStep.PARSE_ANIME_INFO,
        expected: "When doing: parsing anime info",
      },
      {
        source: AnimeScanStep.PARSE_ANIME_DETAIL,
        expected: "When doing: parsing anime detail",
      },
    ];

    for (const { source, expected } of sources) {
      const error = new AnimeScanParseError(
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

  it("throws error when getScanStepLabel encounters an unhandled step value", () => {
    const error = new AnimeScanParseError(
      0,
      999 as unknown as AnimeScanStep,
      "https://ani.gamer.com.tw/anime.php",
      "bad html",
      "Parse failed",
    );
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<ErrorCard error={error} />)).toThrow(
      "Unhandled AnimeScanStep: 999",
    );
    consoleSpy.mockRestore();
  });

  it("renders Unknown/Fatal error and handles copy click", async () => {
    vi.useFakeTimers();
    const error = new Error("Fatal System Error");
    writeTextMock.mockResolvedValue(undefined);

    render(<ErrorCard error={error} />);

    expect(screen.getByTestId("error-card-title").textContent).toBe("Error");

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

  it("renders fallbackTitle using error.name when page, title, and other properties are missing", async () => {
    class CustomError extends AnimeScanError {
      constructor() {
        super("Custom msg", 0, AnimeScanStep.GET_TOTAL_PAGES, "unknown");
        this.name = "TestCustomError";
      }
    }
    const error = new CustomError();
    const { unmount } = render(<ErrorCard error={error} />);
    expect(screen.getByTestId("error-card-title").textContent).toBe(
      "TestCustomError",
    );
    unmount();

    const errorWithNoName = new Error("Fatal System Error");
    Object.defineProperty(errorWithNoName, "name", { value: "" });
    const { unmount: unmount2 } = render(<ErrorCard error={errorWithNoName} />);
    expect(screen.getByTestId("error-card-title").textContent).toBe("Error");

    // Trigger copy click on non-AnimeScanError to cover isCopied branch in early return
    const copyBtn = screen.getByTestId("error-card-copy-btn");
    await act(async () => {
      fireEvent.click(copyBtn);
    });
    expect(copyBtn.textContent).toBe("Copied! ✓");
    unmount2();

    class CustomErrorNoName extends AnimeScanError {
      constructor() {
        super("No name msg", 0, AnimeScanStep.GET_TOTAL_PAGES, "unknown");
        this.name = "";
      }
    }
    const errorNoName = new CustomErrorNoName();
    const { unmount: unmount3 } = render(<ErrorCard error={errorNoName} />);
    expect(screen.getByTestId("error-card-title").textContent).toBe(
      "Unexpected Error",
    );
    unmount3();
  });

  it("handles copy failure gracefully", async () => {
    const error = new AnimeScanHttpError(
      1,
      AnimeScanStep.GET_TOTAL_PAGES,
      "https://ani.gamer.com.tw/animeList.php?page=1",
      "HTTP 404",
      404,
      undefined,
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

  it("shows and hides the stack trace when details toggle is clicked", async () => {
    const error = new AnimeScanHttpError(
      1,
      AnimeScanStep.GET_TOTAL_PAGES,
      "https://ani.gamer.com.tw/animeList.php?page=1",
      "HTTP 500",
      500,
      undefined,
    );

    render(<ErrorCard error={error} />);

    const toggle = screen.getByTestId("error-card-details-toggle");
    expect(toggle.textContent).toBe("Show Details ▼");
    expect(screen.queryByTestId("error-card-stack-trace")).toBeNull();

    await act(async () => {
      fireEvent.click(toggle);
    });

    expect(toggle.textContent).toBe("Hide Details ▲");
    expect(screen.getByTestId("error-card-stack-trace")).toBeDefined();

    await act(async () => {
      fireEvent.click(toggle);
    });

    expect(toggle.textContent).toBe("Show Details ▼");
    expect(screen.queryByTestId("error-card-stack-trace")).toBeNull();
  });

  it("does not render details toggle when error has no stack trace", () => {
    const error = new Error("No stack");
    Object.defineProperty(error, "stack", { value: undefined });

    render(<ErrorCard error={error} />);

    expect(screen.queryByTestId("error-card-details-toggle")).toBeNull();
  });
});
