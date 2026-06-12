import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ErrorPanel } from "./ErrorPanel";
import {
  AnimeScanHttpError,
  AnimeScanParseError,
  AnimeScanError,
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
        errorClass={AnimeScanHttpError}
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
        errorClass={AnimeScanHttpError}
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
        errorClass={AnimeScanHttpError}
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
        errorClass={AnimeScanHttpError}
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
        errorClass={AnimeScanParseError}
        errors={[parseErr]}
        isExpandedByDefault={true}
      />,
    );

    expect(screen.getByText("Document Parser Errors (1)")).toBeDefined();

    rerender(
      <ErrorPanel
        errorClass={AnimeScanParseError}
        errors={[]}
        isExpandedByDefault={true}
      />,
    );

    expect(screen.getByText("No parser errors.")).toBeDefined();
  });

  it("renders generic/unknown errors with default title and empty message", () => {
    class CustomAnimeScanError extends AnimeScanError {
      constructor() {
        super("Fatal", 1, AnimeScanStep.GET_TOTAL_PAGES, "unknown");
        this.name = "CustomAnimeScanError";
      }
    }
    const error = new CustomAnimeScanError();
    const { rerender } = render(
      <ErrorPanel
        errorClass={CustomAnimeScanError}
        errors={[error]}
        isExpandedByDefault={true}
      />,
    );

    expect(screen.getByText("Errors (1)")).toBeDefined();

    rerender(
      <ErrorPanel
        errorClass={CustomAnimeScanError}
        errors={[]}
        isExpandedByDefault={true}
      />,
    );

    expect(screen.getByText("No errors found.")).toBeDefined();
  });
});
