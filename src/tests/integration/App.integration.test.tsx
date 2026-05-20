import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import App from "../../App";
import { ScraperService } from "../../services/scraper";

// Mock Chrome Storage since we are in Vitest/JSDOM environment
const mockStorage: Record<string, unknown> = {};

interface ChromeMock {
  storage: {
    local: {
      get: ReturnType<typeof vi.fn>;
      set: ReturnType<typeof vi.fn>;
    };
  };
}

const chromeMock: ChromeMock = {
  storage: {
    local: {
      get: vi.fn(
        (
          keys: string | string[],
          cb?: (items: Record<string, unknown>) => void,
        ) => {
          const result: Record<string, unknown> = {};
          if (Array.isArray(keys)) {
            keys.forEach((k) => (result[k] = mockStorage[k]));
          } else if (typeof keys === "string") {
            result[keys] = mockStorage[keys];
          }
          if (cb) cb(result);
          return Promise.resolve(result);
        },
      ),
      set: vi.fn((data: Record<string, unknown>, cb?: () => void) => {
        Object.assign(mockStorage, data);
        if (cb) cb();
        return Promise.resolve();
      }),
    },
  },
};

(global as unknown as { chrome: ChromeMock }).chrome = chromeMock;

describe("App Integration Test", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset mock storage
    Object.keys(mockStorage).forEach((key) => delete mockStorage[key]);
    localStorage.clear();
  });

  it("should perform a full scan and move item to favorites", async () => {
    // 1. Mock ScraperService to return controlled data
    vi.spyOn(ScraperService, "getTotalPages").mockResolvedValue(1);
    vi.spyOn(ScraperService, "fetchAllWithConcurrency").mockResolvedValue([
      {
        link: "https://ani.gamer.com.tw/animeVideo.php?sn=1",
        title: "Integration Test Anime",
        watch_count: 10000,
        episode_count: "12",
        upload_date: "2024",
        score: 0,
        rating_count: 0,
        description: "",
      },
    ]);
    vi.spyOn(ScraperService, "scrapeAnimeDetails").mockResolvedValue({
      score: 4.9,
      rating_count: 500,
      description: "Wonderful integration test anime.",
    });

    render(<App />);

    // 2. Initial state
    expect(
      screen.getByText("No anime found in this list."),
    ).toBeInTheDocument();

    // 3. Trigger Scan
    const scanButton = screen.getByRole("button", { name: "Scan Bahamut" });
    fireEvent.click(scanButton);

    // 4. Wait for scan to complete and show results
    await waitFor(
      () => {
        expect(screen.getByText("Integration Test Anime")).toBeInTheDocument();
      },
      { timeout: 5000 },
    );

    expect(screen.getByText("★ 4.9")).toBeInTheDocument();
    expect(screen.getByText("Results (1)")).toBeInTheDocument();

    // 5. Move to Favorites
    const favButton = screen.getByRole("button", { name: "❤ Favorite" });
    fireEvent.click(favButton);

    // 6. Verify tab counts and list content
    expect(screen.getByText("Results (0)")).toBeInTheDocument();
    expect(screen.getByText("Favorites (1)")).toBeInTheDocument();
    expect(
      screen.queryByText("Integration Test Anime"),
    ).not.toBeInTheDocument();

    // 7. Switch to Favorites Tab
    const favoritesTab = screen.getByRole("button", { name: /Favorites/ });
    fireEvent.click(favoritesTab);

    expect(screen.getByText("Integration Test Anime")).toBeInTheDocument();

    // 8. Move to Trash
    const trashButton = screen.getByRole("button", { name: "🗑 Trash" });
    fireEvent.click(trashButton);

    expect(screen.getByText("Favorites (0)")).toBeInTheDocument();
    expect(screen.getByText("Trash (1)")).toBeInTheDocument();
    expect(
      screen.queryByText("Integration Test Anime"),
    ).not.toBeInTheDocument();
  });

  it("should restore data from chrome storage on mount", async () => {
    // Pre-populate storage
    mockStorage.favorites = [
      {
        link: "https://ani.gamer.com.tw/animeVideo.php?sn=99",
        title: "Saved Anime",
        watch_count: 5000,
        episode_count: "24",
        upload_date: "2023",
        score: 4.8,
        rating_count: 200,
        description: "Already saved.",
      },
    ];

    render(<App />);

    // Switch to Favorites to see loaded data
    const favoritesTab = screen.getByRole("button", { name: /Favorites/ });
    fireEvent.click(favoritesTab);

    await waitFor(() => {
      expect(screen.getByText("Saved Anime")).toBeInTheDocument();
    });
    expect(screen.getByText("Favorites (1)")).toBeInTheDocument();
  });
});
