import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
} from "@testing-library/react";
import { ErrorCard } from "./ErrorCard";
import {
  ScraperHttpError,
  ScraperParseError,
  ScraperUnknownError,
} from "../../errors";
import { ScraperErrorSource } from "../../errors/scraper-error-source";

describe("ErrorCard", () => {
  const writeTextMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("navigator", {
      clipboard: {
        writeText: writeTextMock,
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    writeTextMock.mockReset();
    vi.useRealTimers();
  });

  it("renders HTTP error with title correctly", () => {
    const error = Object.assign(
      new ScraperHttpError(
        "https://ani.gamer.com.tw/animeList.php?page=2",
        "HTTP 500",
        500,
      ),
      { title: "葬送的芙莉蓮" },
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
    const error = Object.assign(
      new ScraperParseError(
        ScraperErrorSource.TITLE,
        "https://ani.gamer.com.tw/animeList.php?page=5",
        "bad html",
        "Parse failed",
      ),
      { title: "鬼滅之刃" },
    );

    render(<ErrorCard error={error} />);

    expect(screen.getByTestId("error-card-title").textContent).toBe("鬼滅之刃");
    expect(screen.getByTestId("error-card-subtitle").textContent).toBe(
      "Page: 5",
    );
  });

  it("renders Parser error without title or page correctly", () => {
    const error = new ScraperParseError(
      ScraperErrorSource.DESCRIPTION,
      "https://ani.gamer.com.tw/anime.php",
      "bad html",
      "Parse failed",
    );

    render(<ErrorCard error={error} />);

    expect(screen.getByTestId("error-card-title").textContent).toBe(
      "Parser Error",
    );
  });

  it("renders Unknown/Fatal error and handles copy click", async () => {
    const error = new ScraperUnknownError(new Error("Fatal System Error"));
    delete error.stack;
    writeTextMock.mockResolvedValue(undefined);

    render(<ErrorCard error={error} />);

    expect(screen.getByTestId("error-card-title").textContent).toBe(
      "ScraperUnknownError",
    );

    const copyBtn = screen.getByTestId("error-card-copy-btn");
    await act(async () => {
      fireEvent.click(copyBtn);
    });

    expect(writeTextMock).toHaveBeenCalled();
    const copiedText = writeTextMock.mock.calls[0][0];
    expect(copiedText).toContain("Error Type: ScraperUnknownError");
    expect(copiedText).not.toContain("URL:");
    expect(copiedText).not.toContain("Status Code:");
    expect(copiedText).not.toContain("Source Component:");
    expect(copiedText).not.toContain("Stack Trace:");
  });

  it("handles copy full details on click and displays feedback state", async () => {
    vi.useFakeTimers();
    const error = new ScraperHttpError(
      "https://ani.gamer.com.tw/animeList.php?page=1",
      "HTTP 404",
      404,
    );
    error.stack = "mock stack trace";
    writeTextMock.mockResolvedValue(undefined);

    render(<ErrorCard error={error} />);

    const copyBtn = screen.getByTestId("error-card-copy-btn");

    await act(async () => {
      fireEvent.click(copyBtn);
    });

    await act(async () => {
      await vi.runAllTicks();
    });

    expect(writeTextMock).toHaveBeenCalled();
    expect(writeTextMock.mock.calls[0][0]).toContain(
      "Error Type: ScraperHttpError",
    );
    expect(writeTextMock.mock.calls[0][0]).toContain("Status Code: 404");
    expect(writeTextMock.mock.calls[0][0]).toContain(
      "Stack Trace:\nmock stack trace",
    );

    expect(screen.getByText("Copied! ✓")).toBeDefined();

    await act(async () => {
      vi.advanceTimersByTime(2000);
    });
    expect(screen.queryByText("Copied! ✓")).toBeNull();
  });

  it("handles copy failure gracefully", async () => {
    const error = new ScraperHttpError(
      "https://ani.gamer.com.tw/animeList.php?page=1",
      "HTTP 404",
      404,
    );
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    writeTextMock.mockRejectedValue(new Error("Clipboard block"));

    render(<ErrorCard error={error} />);

    const copyBtn = screen.getByTestId("error-card-copy-btn");
    fireEvent.click(copyBtn);

    await waitFor(() => {
      expect(writeTextMock).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith(
        "Failed to copy error details",
        expect.any(Error),
      );
    });
    consoleSpy.mockRestore();
  });

  it("renders HTTP error without title and without page correctly", () => {
    const error = new ScraperHttpError(
      "https://ani.gamer.com.tw/anime.php",
      "HTTP 403",
      403,
    );
    render(<ErrorCard error={error} />);
    expect(screen.getByTestId("error-card-title").textContent).toBe(
      "HTTP Error",
    );
    expect(screen.getByTestId("error-card-subtitle").textContent).toBe(
      "Status: 403",
    );
  });

  it("renders Parser error with title but without page correctly", () => {
    const error = Object.assign(
      new ScraperParseError(
        ScraperErrorSource.TITLE,
        "https://ani.gamer.com.tw/anime.php",
        "bad html",
        "Parse failed",
      ),
      { title: "鬼滅之刃" },
    );
    render(<ErrorCard error={error} />);
    expect(screen.queryByTestId("error-card-subtitle")).toBeNull();
  });

  it("handles copy of Parser error with source property", async () => {
    const error = new ScraperParseError(
      ScraperErrorSource.EPISODE_COUNT,
      "https://ani.gamer.com.tw/anime.php",
      "bad html",
      "Parse failed",
    );
    writeTextMock.mockResolvedValue(undefined);
    render(<ErrorCard error={error} />);

    const copyBtn = screen.getByTestId("error-card-copy-btn");
    await act(async () => {
      fireEvent.click(copyBtn);
    });

    expect(writeTextMock).toHaveBeenCalled();
    expect(writeTextMock.mock.calls[0][0]).toContain("Source Component: 3");
  });
});
