import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ErrorPanel } from "./ErrorPanel";
import {
  AnimeScanHttpError,
  AnimeScanParseError,
  AnimeScanStep,
} from "../../services/animeScanner";

describe("ErrorPanel", () => {
  const sampleErrors = [
    new AnimeScanHttpError(
      2,
      AnimeScanStep.GET_TOTAL_PAGES,
      "https://ani.gamer.com.tw/animeList.php?page=2",
      "Error html",
      502,
      "測試動畫",
    ),
  ];

  it("renders collapsed by default", () => {
    render(
      <ErrorPanel
        title="HTTP Network Errors"
        testIdPrefix="http-errors"
        emptyMessage="No network errors."
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
        title="HTTP Network Errors"
        testIdPrefix="http-errors"
        emptyMessage="No network errors."
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
        title="HTTP Network Errors"
        testIdPrefix="http-errors"
        emptyMessage="No network errors."
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
        title="HTTP Network Errors"
        testIdPrefix="http-errors"
        emptyMessage="No network errors."
        errors={[]}
        isExpandedByDefault={true}
      />,
    );

    expect(screen.getByText("No network errors.")).toBeDefined();
  });

  it("renders document parser errors with proper titles and empty message", () => {
    const parseErr = new AnimeScanParseError(
      3,
      AnimeScanStep.PARSE_ANIME_INFO,
      "https://ani.gamer.com.tw/animeList.php?page=3",
      "Bad html",
      "Parsing failed",
    );

    const { rerender } = render(
      <ErrorPanel
        title="Document Parser Errors"
        testIdPrefix="parse-errors"
        emptyMessage="No parser errors."
        errors={[parseErr]}
        isExpandedByDefault={true}
      />,
    );

    expect(screen.getByText("Document Parser Errors (1)")).toBeDefined();

    rerender(
      <ErrorPanel
        title="Document Parser Errors"
        testIdPrefix="parse-errors"
        emptyMessage="No parser errors."
        errors={[]}
        isExpandedByDefault={true}
      />,
    );

    expect(screen.getByText("No parser errors.")).toBeDefined();
  });
});
