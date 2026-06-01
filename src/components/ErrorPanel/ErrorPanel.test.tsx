import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ErrorPanel } from "./ErrorPanel";
import {
  ScraperHttpError,
  ScraperParseError,
  ScraperUnknownError,
} from "../../errors";
import { ScraperErrorSource } from "../../errors/scraper-error-source";

describe("ErrorPanel", () => {
  const sampleErrors = [
    new ScraperHttpError(
      2,
      "https://ani.gamer.com.tw/animeList.php?page=2",
      "Error html",
      502,
      "測試動畫",
    ),
  ];

  it("renders collapsed by default", () => {
    render(
      <ErrorPanel
        errorClass={ScraperHttpError}
        errors={sampleErrors}
        isExpandedByDefault={false}
      />,
    );

    const group = screen.getByTestId("http-errors-group");
    expect(group.className).not.toContain("open");
    expect(screen.getByText("HTTP Network Errors (1)")).toBeDefined();
  });

  it("renders open when isExpandedByDefault is true", () => {
    render(
      <ErrorPanel
        errorClass={ScraperHttpError}
        errors={sampleErrors}
        isExpandedByDefault={true}
      />,
    );

    const group = screen.getByTestId("http-errors-group");
    expect(group.className).toContain("open");
  });

  it("toggles open state when header is clicked", () => {
    render(
      <ErrorPanel
        errorClass={ScraperHttpError}
        errors={sampleErrors}
        isExpandedByDefault={false}
      />,
    );

    const header = screen.getByTestId("http-errors-header");
    const group = screen.getByTestId("http-errors-group");

    expect(group.className).not.toContain("open");

    fireEvent.click(header);
    expect(group.className).toContain("open");

    fireEvent.click(header);
    expect(group.className).not.toContain("open");
  });

  it("displays empty message when errors list is empty", () => {
    render(
      <ErrorPanel
        errorClass={ScraperHttpError}
        errors={[]}
        isExpandedByDefault={true}
      />,
    );

    expect(screen.getByText("No network errors.")).toBeDefined();
  });

  it("renders document parser errors with proper titles and empty message", () => {
    const parseErr = new ScraperParseError(
      3,
      ScraperErrorSource.TITLE,
      "https://ani.gamer.com.tw/animeList.php?page=3",
      "Bad html",
      "Parsing failed",
    );

    const { rerender } = render(
      <ErrorPanel
        errorClass={ScraperParseError}
        errors={[parseErr]}
        isExpandedByDefault={true}
      />,
    );

    expect(screen.getByText("Document Parser Errors (1)")).toBeDefined();

    rerender(
      <ErrorPanel
        errorClass={ScraperParseError}
        errors={[]}
        isExpandedByDefault={true}
      />,
    );

    expect(screen.getByText("No parser errors.")).toBeDefined();
  });

  it("renders generic/unknown errors with default title and empty message", () => {
    const error = new ScraperUnknownError(new Error("Fatal"));
    const { rerender } = render(
      <ErrorPanel
        errorClass={ScraperUnknownError}
        errors={[error]}
        isExpandedByDefault={true}
      />,
    );

    expect(screen.getByText("Errors (1)")).toBeDefined();

    rerender(
      <ErrorPanel
        errorClass={ScraperUnknownError}
        errors={[]}
        isExpandedByDefault={true}
      />,
    );

    expect(screen.getByText("No errors found.")).toBeDefined();
  });
});
