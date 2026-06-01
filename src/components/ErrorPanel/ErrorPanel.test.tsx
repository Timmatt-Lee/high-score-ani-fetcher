import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ErrorPanel } from "./ErrorPanel";
import { ScraperHttpError } from "../../errors";

describe("ErrorPanel", () => {
  const sampleErrors = [
    new ScraperHttpError(
      "https://ani.gamer.com.tw/animeList.php?page=2",
      "Error html",
      502,
      "測試動畫",
    ),
  ];

  it("renders collapsed by default", () => {
    render(
      <ErrorPanel
        title="HTTP Errors"
        errors={sampleErrors}
        emptyMessage="No errors."
        defaultOpen={false}
        testIdPrefix="http-errors"
      />,
    );

    const group = screen.getByTestId("http-errors-group");
    expect(group.className).not.toContain("open");
    expect(screen.getByText("HTTP Errors (1)")).toBeDefined();
  });

  it("renders open when defaultOpen is true", () => {
    render(
      <ErrorPanel
        title="HTTP Errors"
        errors={sampleErrors}
        emptyMessage="No errors."
        defaultOpen={true}
        testIdPrefix="http-errors"
      />,
    );

    const group = screen.getByTestId("http-errors-group");
    expect(group.className).toContain("open");
  });

  it("toggles open state when header is clicked", () => {
    render(
      <ErrorPanel
        title="HTTP Errors"
        errors={sampleErrors}
        emptyMessage="No errors."
        defaultOpen={false}
        testIdPrefix="http-errors"
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
        title="HTTP Errors"
        errors={[]}
        emptyMessage="No errors found."
        defaultOpen={true}
        testIdPrefix="http-errors"
      />,
    );

    expect(screen.getByText("No errors found.")).toBeDefined();
  });
});
