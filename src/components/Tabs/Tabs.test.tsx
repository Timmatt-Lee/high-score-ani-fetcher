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
    expect(screen.getByText("Results")).toBeDefined();
    expect(screen.getByText("5")).toBeDefined();
    expect(screen.getByText("Favorites")).toBeDefined();
    expect(screen.getByText("2")).toBeDefined();
    expect(screen.getByText("Trash")).toBeDefined();
    expect(screen.getByText("1")).toBeDefined();
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
    fireEvent.click(screen.getByText("Favorites"));
    expect(setActiveTab).toHaveBeenCalledWith(Tab.Favorites);

    fireEvent.click(screen.getByText("Results"));
    expect(setActiveTab).toHaveBeenCalledWith(Tab.Search);

    fireEvent.click(screen.getByText("Trash"));
    expect(setActiveTab).toHaveBeenCalledWith(Tab.Trash);
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

  it("renders badges and correct counts", () => {
    const { rerender } = render(
      <Tabs
        activeTab={Tab.Search}
        setActiveTab={() => {}}
        searchCount={5}
        favoritesCount={2}
        trashCount={0}
      />,
    );
    expect(screen.queryByTestId("tab-badge-search")?.textContent).toBe("5");
    expect(screen.queryByTestId("tab-badge-favorites")?.textContent).toBe("2");
    expect(screen.queryByTestId("tab-badge-trash")?.textContent).toBe("0");

    // Rerender with different counts
    rerender(
      <Tabs
        activeTab={Tab.Search}
        setActiveTab={() => {}}
        searchCount={0}
        favoritesCount={1}
        trashCount={10}
      />,
    );
    expect(screen.queryByTestId("tab-badge-search")?.textContent).toBe("0");
    expect(screen.queryByTestId("tab-badge-favorites")?.textContent).toBe("1");
    expect(screen.queryByTestId("tab-badge-trash")?.textContent).toBe("10");
  });
});
