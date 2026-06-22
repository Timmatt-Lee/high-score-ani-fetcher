import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ProgressBar } from "./ProgressBar";

describe("ProgressBar", () => {
  it("renders progress and message", () => {
    render(<ProgressBar percent={50} message="Halfway" />);
    expect(screen.getByText("Halfway")).toBeDefined();
    // Assuming you have styles that set width, we can check for percent
    const fill = screen.getByTestId("progress-fill");
    expect(fill.style.width).toBe("50%");
  });
});
