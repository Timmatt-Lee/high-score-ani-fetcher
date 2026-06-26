import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ProgressBar } from "./ProgressBar";

describe("ProgressBar", () => {
  it("renders progress and message for Step 2", () => {
    render(<ProgressBar percent={50} message="Halfway" />);
    expect(screen.getByText(/Halfway/)).toBeDefined();

    // Step 1 should be completed with a checkmark
    const step1 = screen.getByTestId("step-circle-1");
    expect(step1.className).toContain("completed");
    expect(screen.getByTestId("check-1").textContent).toBe("✓");

    // Step 2 should be active with 50% progress
    const step2 = screen.getByTestId("step-circle-2");
    expect(step2.className).toContain("active");

    const step2Inner = screen.getByTestId("step2-inner");
    expect(step2Inner.style.width).toBe("50%");
  });

  it("parses percent from message for Step 1, checks inactive step 2, and handles edge cases", () => {
    // 1. With page count in message
    const { rerender } = render(
      <ProgressBar percent={0} message="Loading anime index (10/50)" />,
    );
    expect(screen.getByText(/Loading anime index/)).toBeDefined();

    const step1 = screen.getByTestId("step-circle-1");
    expect(step1.className).toContain("active");

    const step1Inner = screen.getByTestId("step1-inner");
    expect(step1Inner.style.width).toBe("20%"); // 10/50 = 20%

    // Step 2 should be inactive
    const step2 = screen.getByTestId("step-circle-2");
    expect(step2.className).toContain("inactive");

    // 2. Edge case: total is 0 in message
    rerender(<ProgressBar percent={0} message="Loading anime index (10/0)" />);
    const zeroProgress = screen.getByTestId("step1-inner");
    expect(zeroProgress.style.width).toBe("0%");

    // 3. Edge case: empty message
    rerender(<ProgressBar percent={30} message="" />);
    expect(screen.queryByTestId("progress-status-text")).toBeNull();

    // 4. Edge case: message already prefixed with "["
    rerender(<ProgressBar percent={45} message="[Custom] Scanning..." />);
    expect(screen.getByText("[Custom] Scanning...")).toBeDefined();

    // 5. Step 1 active with percent === 100 (for branch coverage)
    rerender(
      <ProgressBar percent={100} message="Loading anime index (10/50)" />,
    );
    expect(screen.getByTestId("step-circle-2").className).toContain("inactive");

    // 6. Step 2 active with percent === 0 (for branch coverage)
    rerender(<ProgressBar percent={0} message="Scanning details..." />);
    const step2InnerZero = screen.getByTestId("step2-inner");
    expect(step2InnerZero.style.transition).toBe("none");

    // 7. Step 1 with no regex match and no shimmer keywords (falls through to step2)
    rerender(<ProgressBar percent={0} message="Getting total pages..." />);
    expect(screen.getByTestId("step-circle-1").className).toContain("active");
    expect(screen.getByTestId("step1-inner").style.width).toBe("0%");
  });
});
