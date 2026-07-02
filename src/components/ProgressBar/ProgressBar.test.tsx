import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ProgressBar } from "./ProgressBar";

describe("ProgressBar", () => {
  it("renders progress and message for Step 2 active", () => {
    render(
      <ProgressBar
        stepsCount={2}
        currentStepIndex={1}
        currentStepPercent={50}
        message="Halfway"
      />,
    );
    expect(screen.getByText(/Halfway/)).toBeDefined();

    // Step 1 should be completed with a checkmark
    const step1 = screen.getByTestId("step-circle-1");
    expect(step1.className).toContain("completed");
    expect(screen.getByTestId("check-1").textContent).toBe("✓");

    // Step 2 should be active with 50% progress
    const step2 = screen.getByTestId("step-circle-2");
    expect(step2.className).toContain("active");

    const step2Inner = screen.getByTestId("step2-inner");
    expect(step2Inner.style.getPropertyValue("--percent")).toBe("50%");
  });

  it("renders Step 1 active and Step 2 inactive", () => {
    const { rerender } = render(
      <ProgressBar
        stepsCount={2}
        currentStepIndex={0}
        currentStepPercent={20}
        message="Loading anime index"
      />,
    );
    expect(screen.getByText(/Loading anime index/)).toBeDefined();

    const step1 = screen.getByTestId("step-circle-1");
    expect(step1.className).toContain("active");

    const step1Inner = screen.getByTestId("step1-inner");
    expect(step1Inner.style.getPropertyValue("--percent")).toBe("20%");

    // Step 2 should be inactive
    const step2 = screen.getByTestId("step-circle-2");
    expect(step2.className).toContain("inactive");

    // Test fallback style class when step style is not defined (e.g. step3)
    rerender(
      <ProgressBar
        stepsCount={3}
        currentStepIndex={0}
        currentStepPercent={20}
        message="Loading anime index"
      />,
    );
    expect(screen.getByTestId("step-circle-3")).toBeDefined();

    // Test transition-none when percent is 0
    rerender(
      <ProgressBar
        stepsCount={2}
        currentStepIndex={0}
        currentStepPercent={0}
        message="Loading anime index"
      />,
    );
    const zeroProgressInner = screen.getByTestId("step1-inner");
    expect(zeroProgressInner.style.getPropertyValue("--transition")).toBe(
      "none",
    );

    // Test empty message
    rerender(
      <ProgressBar
        stepsCount={2}
        currentStepIndex={0}
        currentStepPercent={0}
        message=""
      />,
    );
    expect(screen.queryByTestId("progress-status-text")).toBeNull();
  });
});
