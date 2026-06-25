import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ResultBanner } from "./ResultBanner";

describe("ResultBanner", () => {
  it("renders with correct default values", () => {
    render(
      <ResultBanner
        successCount={15}
        addedCount={10}
        refetchedCount={5}
        skippedCachedCount={20}
        failedCount={1}
      />,
    );

    // Initial labels showing counts
    expect(screen.getByText("15")).toBeDefined();
    expect(screen.getByText("10")).toBeDefined();
    expect(screen.getByText("5")).toBeDefined();
    expect(screen.getByText("20")).toBeDefined();
    expect(screen.getByText("1")).toBeDefined();
  });

  it("expands a chip on hover and collapses on mouse leave", () => {
    render(
      <ResultBanner
        successCount={15}
        addedCount={10}
        refetchedCount={5}
        skippedCachedCount={20}
        failedCount={1}
      />,
    );

    const successChip = screen.getByTestId("chip-success");

    // Hover success chip
    fireEvent.mouseEnter(successChip);
    expect(successChip.className).toContain("expanded");
    expect(screen.getByText("success")).toBeDefined();
    expect(screen.getByText("15")).toBeDefined();

    // Leave success chip
    fireEvent.mouseLeave(successChip);
    expect(successChip.className).toContain("collapsed");

    // Hover added chip
    const addedChip = screen.getByTestId("chip-added");
    fireEvent.mouseEnter(addedChip);
    expect(addedChip.className).toContain("expanded");
    fireEvent.mouseLeave(addedChip);

    // Hover updated chip
    const updatedChip = screen.getByTestId("chip-updated");
    fireEvent.mouseEnter(updatedChip);
    expect(updatedChip.className).toContain("expanded");
    fireEvent.mouseLeave(updatedChip);

    // Hover skip chip
    const skipChip = screen.getByTestId("chip-skip");
    fireEvent.mouseEnter(skipChip);
    expect(skipChip.className).toContain("expanded");
    fireEvent.mouseLeave(skipChip);

    // Hover fail chip
    const failChip = screen.getByTestId("chip-fail");
    fireEvent.mouseEnter(failChip);
    expect(failChip.className).toContain("expanded");
    fireEvent.mouseLeave(failChip);
  });

  it("calls onDismiss callback when clicked", () => {
    const handleDismiss = vi.fn();
    render(
      <ResultBanner
        successCount={15}
        addedCount={10}
        refetchedCount={5}
        skippedCachedCount={20}
        failedCount={1}
        onDismiss={handleDismiss}
      />,
    );

    const dismissBtn = screen.getByLabelText("Dismiss scan results");
    fireEvent.click(dismissBtn);
    expect(handleDismiss).toHaveBeenCalledTimes(1);
  });
});
