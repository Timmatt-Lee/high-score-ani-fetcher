import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ScanErrors } from "./ScanErrors";
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

describe("ScanErrors", () => {
  it("renders nothing when no errors exist", () => {
    const onRetrySpy = vi.fn();
    const { container } = render(
      <ScanErrors
        httpErrors={[]}
        parseErrors={[]}
        failedDetails={[]}
        isScanning={false}
        onRetry={onRetrySpy}
      />,
    );

    expect(container.firstChild).toBeNull();
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
      <ScanErrors
        httpErrors={[httpErr]}
        parseErrors={[parseErr]}
        failedDetails={[]}
        isScanning={false}
        onRetry={onRetrySpy}
        defaultHttpOpen={true}
        defaultParseOpen={true}
      />,
    );

    expect(screen.getByText("2 errors occurred")).toBeDefined();
    expect(screen.getByText("Page: 2")).toBeDefined();
    expect(screen.getByText("Status: 502")).toBeDefined();
    expect(screen.getByText("Page: 3")).toBeDefined();
    expect(screen.getByText("Parsing failed")).toBeDefined();

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
      <ScanErrors
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

    expect(onRetrySpy).toHaveBeenCalled();
  });

  it("renders null when isScanning is true", () => {
    const onRetrySpy = vi.fn();
    const httpErr = new ScraperHttpError(
      "https://ani.gamer.com.tw/animeList.php?page=5",
      "Error html",
      500,
    );

    const { container } = render(
      <ScanErrors
        httpErrors={[httpErr]}
        parseErrors={[]}
        failedDetails={[]}
        isScanning={true}
        onRetry={onRetrySpy}
      />,
    );

    expect(container.firstChild).toBeNull();
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
      <ScanErrors
        httpErrors={[httpErrNoPage]}
        parseErrors={[parseErrLongHtml, parseErrNoHtml]}
        failedDetails={[]}
        isScanning={false}
        onRetry={onRetrySpy}
      />,
    );

    expect(screen.getByText("3 errors occurred")).toBeDefined();
  });

  it("renders anime title in error cards when available", () => {
    const httpErr = new ScraperHttpError(
      "https://ani.gamer.com.tw/anime.php?sn=123",
      "Error html",
      500,
      "葬送的芙莉蓮",
    );

    const parseErr = new ScraperParseError(
      ScraperErrorSource.TITLE,
      "https://ani.gamer.com.tw/anime.php?sn=124",
      "Bad html",
      "Parsing failed",
      "鬼滅之刃",
    );

    render(
      <ScanErrors
        httpErrors={[httpErr]}
        parseErrors={[parseErr]}
        failedDetails={[]}
        isScanning={false}
        onRetry={vi.fn()}
      />,
    );

    expect(screen.getByText("葬送的芙莉蓮")).toBeDefined();
    expect(screen.getByText("Status: 500")).toBeDefined();
    expect(screen.getByText("鬼滅之刃")).toBeDefined();
  });

  it("renders empty HTTP errors group when only parser errors are present", () => {
    const parseErr = new ScraperParseError(
      ScraperErrorSource.TITLE,
      "https://ani.gamer.com.tw/animeList.php?page=3",
      "Bad html",
      "Parsing failed",
    );

    render(
      <ScanErrors
        httpErrors={[]}
        parseErrors={[parseErr]}
        failedDetails={[]}
        isScanning={false}
        onRetry={vi.fn()}
      />,
    );

    expect(screen.getByText("No network errors.")).toBeDefined();
    expect(screen.getByText("Parsing failed")).toBeDefined();
  });

  it("renders summary only when only failed details are present", () => {
    const failedDetail = makeAnime("Failed Detail Sn");

    render(
      <ScanErrors
        httpErrors={[]}
        parseErrors={[]}
        failedDetails={[failedDetail]}
        isScanning={false}
        onRetry={vi.fn()}
      />,
    );

    expect(screen.getByText("1 error occurred")).toBeDefined();
    // The lists inside accordion will show empty messages since HTTP and Parse lists are empty
    expect(screen.getByText("No network errors.")).toBeDefined();
    expect(screen.getByText("No parser errors.")).toBeDefined();
  });
});
