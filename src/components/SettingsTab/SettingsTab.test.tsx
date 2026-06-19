import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { SettingsTab } from "./SettingsTab";

describe("SettingsTab", () => {
  const defaultSettings = {
    targetScore: 4.8,
    rescanThreshold: 95,
    cacheExpireDays: 14,
  };

  it("renders correctly with provided settings", () => {
    render(<SettingsTab settings={defaultSettings} onSave={vi.fn()} />);

    expect(screen.getByDisplayValue("4.8")).toBeDefined();
    expect(screen.getByDisplayValue("95")).toBeDefined();
    expect(screen.getByDisplayValue("14")).toBeDefined();
  });

  it("calls onSave when targetScore changes", () => {
    const handleSave = vi.fn();
    render(<SettingsTab settings={defaultSettings} onSave={handleSave} />);

    const input = screen.getByDisplayValue("4.8");
    fireEvent.change(input, { target: { value: "4.9" } });

    expect(handleSave).toHaveBeenCalledWith({
      ...defaultSettings,
      targetScore: 4.9,
    });
  });

  it("calls onSave when rescanThreshold changes", () => {
    const handleSave = vi.fn();
    render(<SettingsTab settings={defaultSettings} onSave={handleSave} />);

    const input = screen.getByDisplayValue("95");
    fireEvent.change(input, { target: { value: "90" } });

    expect(handleSave).toHaveBeenCalledWith({
      ...defaultSettings,
      rescanThreshold: 90,
    });
  });

  it("calls onSave when cacheExpireDays changes", () => {
    const handleSave = vi.fn();
    render(<SettingsTab settings={defaultSettings} onSave={handleSave} />);

    const input = screen.getByDisplayValue("14");
    fireEvent.change(input, { target: { value: "7" } });

    expect(handleSave).toHaveBeenCalledWith({
      ...defaultSettings,
      cacheExpireDays: 7,
    });
  });
});
