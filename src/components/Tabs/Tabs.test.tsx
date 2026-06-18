import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Tabs, Tab } from "./Tabs";

describe("Tabs", () => {
  it("renders all tabs with correct counts", () => {
    render(
      <Tabs
        activeTab={Tab.Search}
        setActiveTab={() => {}}
        searchCount={5}
        favoritesCount={2}
        trashCount={1}
      />,
    );
    expect(screen.getByText("Results (5)")).toBeDefined();
    expect(screen.getByText("Favorites (2)")).toBeDefined();
    expect(screen.getByText("Trash (1)")).toBeDefined();
  });

  it("calls setActiveTab when clicked", () => {
    const setActiveTab = vi.fn();
    render(
      <Tabs
        activeTab={Tab.Search}
        setActiveTab={setActiveTab}
        searchCount={5}
        favoritesCount={2}
        trashCount={1}
      />,
    );
    fireEvent.click(screen.getByText("Favorites (2)"));
    expect(setActiveTab).toHaveBeenCalledWith(Tab.Favorites);
  });

  it("calls setActiveTab with Settings when Settings tab is clicked", () => {
    const setActiveTab = vi.fn();
    render(
      <Tabs
        activeTab={Tab.Search}
        setActiveTab={setActiveTab}
        searchCount={10}
        favoritesCount={2}
        trashCount={1}
      />,
    );

    fireEvent.click(screen.getByText("Settings"));
    expect(setActiveTab).toHaveBeenCalledWith(Tab.Settings);
  });
});
