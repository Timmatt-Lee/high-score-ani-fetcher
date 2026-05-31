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

    expect(screen.getByTestId("error-card-title").textContent).toContain(
      "葬送的芙莉蓮 (Page: 2)(Status: 500)",
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

    expect(screen.getByTestId("error-card-title").textContent).toContain(
      "Page: 3 (Status: 502)",
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

    expect(screen.getByTestId("error-card-title").textContent).toContain(
      "鬼滅之刃 (Page: 5)",
    );
    expect(screen.getByText("Component:")).toBeDefined();
  });

  it("renders Parser error without title or page correctly", () => {
    const error = new ScraperParseError(
      ScraperErrorSource.DESCRIPTION,
      "https://ani.gamer.com.tw/anime.php",
      "bad html",
      "Parse failed",
    );

    render(<ErrorCard error={error} />);

    expect(screen.getByTestId("error-card-title").textContent).toContain(
      "Parser Error (7)",
    );
  });

  it("renders Unknown/Fatal error, handles dismiss and copy click", async () => {
    const error = new ScraperUnknownError(new Error("Fatal System Error"));
    error.stack = "fatal stack trace";
    const onDismissSpy = vi.fn();
    writeTextMock.mockResolvedValue(undefined);

    render(<ErrorCard error={error} onDismiss={onDismissSpy} />);

    expect(screen.getByTestId("error-card-title").textContent).toContain(
      "ScraperUnknownError",
    );

    const dismissBtn = screen.getByTestId("error-card-dismiss-btn");
    fireEvent.click(dismissBtn);
    expect(onDismissSpy).toHaveBeenCalled();

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

    // Click button under act to ensure updates are processed
    await act(async () => {
      fireEvent.click(copyBtn);
    });

    // Wait for async promises to flush inside act
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

    // Trigger fake timer to cover the setTimeout callback
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
    expect(screen.getByTestId("error-card-title").textContent).toContain(
      "(Status: 403)",
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
    expect(screen.getByTestId("error-card-title").textContent).toContain(
      "鬼滅之刃",
    );
    expect(screen.getByTestId("error-card-title").textContent).not.toContain(
      "Page",
    );
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
