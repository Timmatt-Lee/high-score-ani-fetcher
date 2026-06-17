import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { SettingsTab } from "./SettingsTab";

describe("SettingsTab", () => {
  it("renders correctly and allows updating settings", () => {
    const mockSettings = {
      targetScore: 4.8,
      rescanThresholdRatio: 0.95,
      cacheExpireDays: 14,
    };
    const mockSetSettings = vi.fn();

    render(
      <SettingsTab settings={mockSettings} onSaveSettings={mockSetSettings} />,
    );

    expect(screen.getByText("Settings")).toBeInTheDocument();

    const targetScoreInput = screen.getByLabelText(/Target Score/i);
    fireEvent.change(targetScoreInput, { target: { value: "4.9" } });

    const rescanInput = screen.getByLabelText(/Rescan Threshold Ratio/i);
    fireEvent.change(rescanInput, { target: { value: "90" } });

    const cacheExpireInput = screen.getByLabelText(/Cache Expire Days/i);
    fireEvent.change(cacheExpireInput, { target: { value: "7" } });

    // Wait, the form requires submit to actually call setSettings!
    fireEvent.click(screen.getByRole("button", { name: /Save Settings/i }));

    expect(mockSetSettings).toHaveBeenCalledWith({
      targetScore: 4.9,
      rescanThresholdRatio: 0.9,
      cacheExpireDays: 7,
    });
  });
});
