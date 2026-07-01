import { describe, it, expect, vi } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { ErrorCard } from "./ErrorCard";
import {
  AnimeScanError,
  AnimeScanHttpError,
  AnimeScanParseError,
  AnimeScanStep,
} from "../../services/animeScanner";

describe("ErrorCard", () => {
  it("renders HTTP error with title correctly", () => {
    const error = new AnimeScanHttpError(
      2,
      AnimeScanStep.GET_TOTAL_PAGES,
      "https://ani.gamer.com.tw/animeList.php?page=2",
      "HTTP 500",
      500,
      "葬送的芙莉蓮",
    );

    render(<ErrorCard error={error} onDismiss={vi.fn()} />);

    expect(screen.getByTestId("error-card-title").textContent).toBe(
      "葬送的芙莉蓮",
    );
    expect(screen.getByTestId("error-card-subtitle").textContent).toBe(
      "Page: 2, Status Code: 500, When doing: fetching total pages",
    );
    expect(screen.getByTestId("error-card-message").textContent).toBe(
      error.message,
    );
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

    render(<ErrorCard error={error} onDismiss={vi.fn()} />);

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

    render(<ErrorCard error={error} onDismiss={vi.fn()} />);

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

    render(<ErrorCard error={error} onDismiss={vi.fn()} />);

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
        source: AnimeScanStep.SCAN_LIST_PAGE,
        expected: "When doing: scanning list page",
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
      const { unmount } = render(
        <ErrorCard error={error} onDismiss={vi.fn()} />,
      );
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
    expect(() =>
      render(<ErrorCard error={error} onDismiss={vi.fn()} />),
    ).toThrow("Unhandled AnimeScanStep: 999");
    consoleSpy.mockRestore();
  });

  it("renders Unknown/Fatal error correctly", () => {
    const error = new Error("Fatal System Error");

    render(<ErrorCard error={error} onDismiss={vi.fn()} />);

    expect(screen.getByTestId("error-card-title").textContent).toBe("Error");
  });

  it("renders fallbackTitle using error.name when page, title, and other properties are missing", () => {
    class CustomError extends AnimeScanError {
      constructor() {
        super("Custom msg", 0, AnimeScanStep.GET_TOTAL_PAGES, "unknown");
        this.name = "TestCustomError";
      }
    }
    const error = new CustomError();
    const { unmount } = render(<ErrorCard error={error} onDismiss={vi.fn()} />);
    expect(screen.getByTestId("error-card-title").textContent).toBe(
      "TestCustomError",
    );
    unmount();

    const errorWithNoName = new Error("Fatal System Error");
    Object.defineProperty(errorWithNoName, "name", { value: "" });
    const { unmount: unmount2 } = render(
      <ErrorCard error={errorWithNoName} onDismiss={vi.fn()} />,
    );
    expect(screen.getByTestId("error-card-title").textContent).toBe("Error");
    unmount2();

    class CustomErrorNoName extends AnimeScanError {
      constructor() {
        super("No name msg", 0, AnimeScanStep.GET_TOTAL_PAGES, "unknown");
        this.name = "";
      }
    }
    const errorNoName = new CustomErrorNoName();
    const { unmount: unmount3 } = render(
      <ErrorCard error={errorNoName} onDismiss={vi.fn()} />,
    );
    expect(screen.getByTestId("error-card-title").textContent).toBe(
      "Unexpected Error",
    );
    unmount3();
  });

  it("calls onDismiss when dismiss button is clicked", () => {
    const error = new Error("Test error");
    const onDismiss = vi.fn();
    render(<ErrorCard error={error} onDismiss={onDismiss} />);

    const dismissBtn = screen.getByTestId("error-card-dismiss-btn");
    expect(dismissBtn).toBeDefined();

    dismissBtn.click();
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("copies details without trace when copy button is clicked and resets after timeout", () => {
    vi.useFakeTimers();
    const error = new AnimeScanHttpError(
      1,
      AnimeScanStep.GET_TOTAL_PAGES,
      "https://example.com",
      "Forbidden",
      403,
      "My Anime",
    );

    const writeTextMock = vi.fn();
    Object.defineProperty(navigator, "clipboard", {
      value: {
        writeText: writeTextMock,
      },
      writable: true,
      configurable: true,
    });

    render(<ErrorCard error={error} onDismiss={vi.fn()} />);
    const copyBtn = screen.getByTestId("error-card-copy-btn");

    act(() => {
      copyBtn.click();
    });

    expect(writeTextMock).toHaveBeenCalledWith(
      "My Anime\nHTTP request failed with status 403 (URL: https://example.com)\nURL: https://example.com\nStatus: 403\nHTML/Body Snippet:\nForbidden",
    );

    // Verify button has .copied class
    expect(copyBtn.className).toContain("copied");

    // Fast forward timer
    act(() => {
      vi.advanceTimersByTime(2000);
    });

    // Verify .copied class is removed
    expect(copyBtn.className).not.toContain("copied");
    vi.useRealTimers();
  });

  it("copies details without subtitle when copy button is clicked", () => {
    const error = new Error("System is down");

    const writeTextMock = vi.fn();
    Object.defineProperty(navigator, "clipboard", {
      value: {
        writeText: writeTextMock,
      },
      writable: true,
      configurable: true,
    });

    render(<ErrorCard error={error} onDismiss={vi.fn()} />);
    const copyBtn = screen.getByTestId("error-card-copy-btn");

    act(() => {
      copyBtn.click();
    });

    expect(writeTextMock).toHaveBeenCalledWith("Error\nSystem is down");
  });

  it("copies details with HTML/Body Snippet for AnimeScanParseError", () => {
    const error = new AnimeScanParseError(
      1,
      AnimeScanStep.PARSE_ANIME_INFO,
      "https://example.com",
      "<div>Bad HTML</div>",
      "Parse error",
      "Some Anime",
    );

    const writeTextMock = vi.fn();
    Object.defineProperty(navigator, "clipboard", {
      value: {
        writeText: writeTextMock,
      },
      writable: true,
      configurable: true,
    });

    render(<ErrorCard error={error} onDismiss={vi.fn()} />);
    const copyBtn = screen.getByTestId("error-card-copy-btn");

    act(() => {
      copyBtn.click();
    });

    expect(writeTextMock).toHaveBeenCalledWith(
      "Some Anime\nParse error\nURL: https://example.com\nHTML/Body Snippet:\n<div>Bad HTML</div>",
    );
  });

  it("copies details when AnimeScanHttpError has no html snippet", () => {
    const error = new AnimeScanHttpError(
      1,
      AnimeScanStep.GET_TOTAL_PAGES,
      "https://example.com",
      "",
      500,
      "Some Anime",
    );

    const writeTextMock = vi.fn();
    Object.defineProperty(navigator, "clipboard", {
      value: {
        writeText: writeTextMock,
      },
      writable: true,
      configurable: true,
    });

    render(<ErrorCard error={error} onDismiss={vi.fn()} />);
    const copyBtn = screen.getByTestId("error-card-copy-btn");

    act(() => {
      copyBtn.click();
    });

    expect(writeTextMock).toHaveBeenCalledWith(
      "Some Anime\nHTTP request failed with status 500 (URL: https://example.com)\nURL: https://example.com\nStatus: 500",
    );
  });

  it("copies details when AnimeScanParseError has no html snippet", () => {
    const error = new AnimeScanParseError(
      1,
      AnimeScanStep.PARSE_ANIME_INFO,
      "https://example.com",
      "",
      "Parse error",
      "Some Anime",
    );

    const writeTextMock = vi.fn();
    Object.defineProperty(navigator, "clipboard", {
      value: {
        writeText: writeTextMock,
      },
      writable: true,
      configurable: true,
    });

    render(<ErrorCard error={error} onDismiss={vi.fn()} />);
    const copyBtn = screen.getByTestId("error-card-copy-btn");

    act(() => {
      copyBtn.click();
    });

    expect(writeTextMock).toHaveBeenCalledWith(
      "Some Anime\nParse error\nURL: https://example.com",
    );
  });

  it("copies details when error is a custom AnimeScanError", () => {
    class CustomError extends AnimeScanError {
      constructor() {
        super(
          "Custom msg",
          1,
          AnimeScanStep.GET_TOTAL_PAGES,
          "https://example.com",
          "Some Anime",
        );
        this.name = "TestCustomError";
      }
    }
    const error = new CustomError();

    const writeTextMock = vi.fn();
    Object.defineProperty(navigator, "clipboard", {
      value: {
        writeText: writeTextMock,
      },
      writable: true,
      configurable: true,
    });

    render(<ErrorCard error={error} onDismiss={vi.fn()} />);
    const copyBtn = screen.getByTestId("error-card-copy-btn");

    act(() => {
      copyBtn.click();
    });

    expect(writeTextMock).toHaveBeenCalledWith(
      "Some Anime\nCustom msg\nURL: https://example.com",
    );
  });
});
