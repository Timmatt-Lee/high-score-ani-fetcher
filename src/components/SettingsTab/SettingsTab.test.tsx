import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { SettingsTab } from "./SettingsTab";

describe("SettingsTab", () => {
  const defaultSettings = {
    targetScore: 4.8,
    rescanThreshold: 95,
    cacheExpireDays: 14,
    requestDelayMs: 800,
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

  it("calls onSave when requestDelayMs changes", () => {
    const handleSave = vi.fn();
    render(<SettingsTab settings={defaultSettings} onSave={handleSave} />);

    const input = screen.getByDisplayValue("800");
    fireEvent.change(input, { target: { value: "1000" } });

    expect(handleSave).toHaveBeenCalledWith({
      ...defaultSettings,
      requestDelayMs: 1000,
    });
  });

  it("does not call onSave when input is invalid or NaN", () => {
    const handleSave = vi.fn();
    render(<SettingsTab settings={defaultSettings} onSave={handleSave} />);

    const input = screen.getByDisplayValue("4.8");
    Object.defineProperty(input, "value", {
      value: "abc",
      writable: true,
      configurable: true,
    });
    fireEvent.change(input);

    expect(handleSave).not.toHaveBeenCalled();
  });

  it("clamps targetScore between 0.0 and 5.0", () => {
    const handleSave = vi.fn();
    render(<SettingsTab settings={defaultSettings} onSave={handleSave} />);

    const input = screen.getByDisplayValue("4.8");

    // Test upper limit clamping
    fireEvent.change(input, { target: { value: "6.0" } });
    expect(handleSave).toHaveBeenCalledWith({
      ...defaultSettings,
      targetScore: 5.0,
    });

    // Test lower limit clamping
    fireEvent.change(input, { target: { value: "-1.0" } });
    expect(handleSave).toHaveBeenCalledWith({
      ...defaultSettings,
      targetScore: 0.0,
    });
  });

  it("clamps rescanThreshold between 0 and 100", () => {
    const handleSave = vi.fn();
    render(<SettingsTab settings={defaultSettings} onSave={handleSave} />);

    const input = screen.getByDisplayValue("95");

    // Test upper limit clamping
    fireEvent.change(input, { target: { value: "120" } });
    expect(handleSave).toHaveBeenCalledWith({
      ...defaultSettings,
      rescanThreshold: 100,
    });

    // Test lower limit clamping
    fireEvent.change(input, { target: { value: "-10" } });
    expect(handleSave).toHaveBeenCalledWith({
      ...defaultSettings,
      rescanThreshold: 0,
    });
  });
});
