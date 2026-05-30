import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ErrorsPanel } from "./ErrorsPanel";
import { ScraperHttpError, ScraperParseError } from "../../errors";
import { ScraperErrorSource } from "../../errors/scraper-error-source";
import { type AnimeItem } from "../../types/anime";

const makeAnime = (title: string): AnimeItem => ({
  link: `http://${title}`,
  title,
  watchCount: 100,
  episodeCount: 12,
  uploadDate: new Date("2024-01-01"),
  score: 8.5,
  ratingCount: 50,
  description: "Desc",
});

describe("ErrorsPanel", () => {
  it("renders empty state for both groups when no errors exist", () => {
    const onRetrySpy = vi.fn();
    render(
      <ErrorsPanel
        httpErrors={[]}
        parseErrors={[]}
        failedDetails={[]}
        isScanning={false}
        onRetry={onRetrySpy}
      />,
    );

    expect(screen.getByText("0 errors encountered")).toBeDefined();
    expect(screen.getByText("No network errors.")).toBeDefined();
    expect(screen.getByText("No parser errors.")).toBeDefined();

    const retryBtn = screen.getByTestId("retry-errors-btn");
    expect(retryBtn).toBeDisabled();
  });

  it("renders HTTP and parse errors and permits toggling accordion headers", () => {
    const onRetrySpy = vi.fn();
    const httpErr = new ScraperHttpError(
      "https://ani.gamer.com.tw/animeList.php?page=2",
      "Error html",
      502,
    );
    const parseErr = new ScraperParseError(
      ScraperErrorSource.TITLE,
      "https://ani.gamer.com.tw/animeList.php?page=3",
      "Bad html",
      "Parsing failed",
    );

    render(
      <ErrorsPanel
        httpErrors={[httpErr]}
        parseErrors={[parseErr]}
        failedDetails={[]}
        isScanning={false}
        onRetry={onRetrySpy}
      />,
    );

    expect(
      screen.getByText("2 errors encountered (Failed Pages: 2, 3)"),
    ).toBeDefined();
    expect(screen.getByText("Status:")).toBeDefined();
    expect(screen.getByText("502")).toBeDefined();
    expect(screen.getByText("Component:")).toBeDefined();
    expect(screen.getByText("Parsing failed (Bad html)")).toBeDefined();

    // Toggle HTTP Accordion
    const httpHeader = screen.getByTestId("http-errors-header");
    fireEvent.click(httpHeader);
    const httpGroup = screen.getByTestId("http-errors-group");
    expect(httpGroup.className).not.toContain("open");

    // Toggle Parse Accordion
    const parseHeader = screen.getByTestId("parse-errors-header");
    fireEvent.click(parseHeader);
    const parseGroup = screen.getByTestId("parse-errors-group");
    expect(parseGroup.className).not.toContain("open");
  });

  it("handles retry click correctly", () => {
    const onRetrySpy = vi.fn();
    const httpErr = new ScraperHttpError(
      "https://ani.gamer.com.tw/animeList.php?page=4",
      "Error html",
      500,
    );
    const failedDetail = makeAnime("Failed Detail");

    render(
      <ErrorsPanel
        httpErrors={[httpErr]}
        parseErrors={[]}
        failedDetails={[failedDetail]}
        isScanning={false}
        onRetry={onRetrySpy}
      />,
    );

    const retryBtn = screen.getByTestId("retry-errors-btn");
    expect(retryBtn).not.toBeDisabled();
    fireEvent.click(retryBtn);

    expect(onRetrySpy).toHaveBeenCalledWith({
      failedPages: [4],
      failedDetails: [failedDetail],
    });
  });

  it("shows retrying text and disables button when isScanning is true", () => {
    const onRetrySpy = vi.fn();
    const httpErr = new ScraperHttpError(
      "https://ani.gamer.com.tw/animeList.php?page=5",
      "Error html",
      500,
    );

    render(
      <ErrorsPanel
        httpErrors={[httpErr]}
        parseErrors={[]}
        failedDetails={[]}
        isScanning={true}
        onRetry={onRetrySpy}
      />,
    );

    const retryBtn = screen.getByTestId("retry-errors-btn");
    expect(retryBtn).toBeDisabled();
    expect(screen.getByText("Retrying...")).toBeDefined();
  });

  it("handles branch edge cases (empty url, missing page param, long html length)", () => {
    const onRetrySpy = vi.fn();
    const httpErrNoPage = new ScraperHttpError(
      "https://ani.gamer.com.tw/animeList.php",
      "",
      500,
    );
    const parseErrLongHtml = new ScraperParseError(
      ScraperErrorSource.TITLE,
      "https://ani.gamer.com.tw/animeList.php?page=1",
      "A".repeat(150),
      "Parse failed long",
    );
    const parseErrNoHtml = new ScraperParseError(
      ScraperErrorSource.DESCRIPTION,
      "https://ani.gamer.com.tw/anime.php?sn=1",
      "",
      "Parse failed no html",
    );

    render(
      <ErrorsPanel
        httpErrors={[httpErrNoPage]}
        parseErrors={[parseErrLongHtml, parseErrNoHtml]}
        failedDetails={[]}
        isScanning={false}
        onRetry={onRetrySpy}
      />,
    );

    expect(screen.getByText(/Failed Pages: 1/)).toBeDefined();
    // Verify long HTML snippet is truncated
    expect(screen.getByText(new RegExp("A{100}\\.\\.\\."))).toBeDefined();
    // Verify empty HTML doesn't crash it
    expect(screen.getByText(/Parse failed no html \(\)/)).toBeDefined();
  });
});
