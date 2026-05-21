import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ProgressBar } from "./ProgressBar";

describe("ProgressBar", () => {
  it("does not render when isScanning is false", () => {
    const { container } = render(
      <ProgressBar isScanning={false} percent={50} message="Halfway" />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders progress and message when isScanning is true", () => {
    render(<ProgressBar isScanning={true} percent={50} message="Halfway" />);
    expect(screen.getByText("Halfway")).toBeDefined();
    // Assuming you have styles that set width, we can check for percent
    const fill = screen.getByTestId("progress-fill");
    expect(fill.style.width).toBe("50%");
  });
});
