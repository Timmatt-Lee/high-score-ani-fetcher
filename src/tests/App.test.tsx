import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
} from "@testing-library/react";
import App from "../App";
import { ScraperService, type AnimeItem } from "../services/scraper";

// --- Chrome storage mock ---
const storageMock: Record<string, unknown> = {};

const chromeStorageMock = {
  storage: {
    local: {
      get: vi.fn(async (keys: string[]) => {
        const result: Record<string, unknown> = {};
        keys.forEach((k) => {
          if (storageMock[k]) result[k] = storageMock[k];
        });
        return result;
      }),
      set: vi.fn(async (data: Record<string, unknown>) => {
        Object.assign(storageMock, data);
      }),
    },
  },
};

vi.stubGlobal("chrome", chromeStorageMock);

const makeAnime = (overrides: Partial<AnimeItem> = {}): AnimeItem => ({
  link: "https://ani.gamer.com.tw/anime.php?sn=1",
  title: "Test Anime",
  watch_count: 10000,
  episode_count: "12",
  upload_date: "2024",
  score: 8.5,
  rating_count: 500,
  description: "A great show.",
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
  Object.keys(storageMock).forEach((k) => delete storageMock[k]);
  vi.stubGlobal("chrome", chromeStorageMock);
  localStorage.clear();
});

afterEach(() => {
  localStorage.clear();
});

describe("App Integration Test", () => {
  it("renders the app and loads data", async () => {
    storageMock["searchList"] = [makeAnime()];
    await act(async () => {
      render(<App />);
    });
    expect(screen.getByText("AniFetcher Pro")).toBeDefined();
    expect(screen.getByText("Test Anime")).toBeDefined();
    expect(screen.getByText(/Results \(1\)/)).toBeDefined();
  });

  it("can switch tabs and move items", async () => {
    storageMock["searchList"] = [makeAnime()];
    await act(async () => {
      render(<App />);
    });

    // Move to Favorites
    fireEvent.click(screen.getByText("❤ Favorite"));
    expect(screen.queryByText("Test Anime")).toBeNull();

    // Go to Favorites Tab
    fireEvent.click(screen.getByText(/Favorites \(1\)/));
    expect(screen.getByText("Test Anime")).toBeDefined();

    // Move to Trash
    fireEvent.click(screen.getByText("🗑 Trash"));
    expect(screen.queryByText("Test Anime")).toBeNull();

    // Go to Trash Tab
    fireEvent.click(screen.getByText(/Trash \(1\)/));
    expect(screen.getByText("Test Anime")).toBeDefined();

    // Restore
    fireEvent.click(screen.getByText("↺ Restore"));
    expect(screen.queryByText("Test Anime")).toBeNull();

    // Back to Search Tab
    fireEvent.click(screen.getByText(/Results \(1\)/));
    expect(screen.getByText("Test Anime")).toBeDefined();
  });

  it("can perform a scan successfully", async () => {
    vi.spyOn(ScraperService, "getTotalPages").mockResolvedValue(1);
    vi.spyOn(ScraperService, "fetchAllWithConcurrency").mockResolvedValue([
      makeAnime({ title: "Scanned Anime" }),
    ]);
    vi.spyOn(ScraperService, "scrapeAnimeDetails").mockResolvedValue({
      score: 4.9,
      rating_count: 100,
      description: "x",
    });

    await act(async () => {
      render(<App />);
    });

    await act(async () => {
      fireEvent.click(screen.getByText("Scan Bahamut"));
    });

    await waitFor(() => expect(screen.queryByText("Scanning...")).toBeNull());
    expect(screen.getByText("Scanned Anime")).toBeDefined();
  });
});
