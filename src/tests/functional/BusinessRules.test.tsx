import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
} from "@testing-library/react";
import App from "../../App";
import { ScraperService } from "../../services/scraper";

// Mock Chrome Storage
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

describe("Business Logic Functional Test", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(mockStorage).forEach((key) => delete mockStorage[key]);
  });

  it("should filter out anime based on business rules (OVA, episodes < 10, score < 4.8)", async () => {
    vi.spyOn(ScraperService, "getTotalPages").mockResolvedValue(1);
    vi.spyOn(ScraperService, "fetchAllWithConcurrency").mockResolvedValue([
      {
        link: "http://good-anime",
        title: "High Score Anime",
        watch_count: 100,
        episode_count: "12",
        upload_date: "2024",
        score: 0,
        rating_count: 0,
        description: "",
      },
      {
        link: "http://ova-anime",
        title: "Test OVA Special",
        watch_count: 100,
        episode_count: "12",
        upload_date: "2024",
        score: 0,
        rating_count: 0,
        description: "",
      },
      {
        link: "http://short-anime",
        title: "Short Anime",
        watch_count: 100,
        episode_count: "5",
        upload_date: "2024",
        score: 0,
        rating_count: 0,
        description: "",
      },
    ]);

    vi.spyOn(ScraperService, "scrapeAnimeDetails").mockResolvedValue({
      score: 4.9,
      rating_count: 100,
      description: "Good",
    });

    render(<App />);

    fireEvent.click(
      screen.getByRole("button", { name: "Scan 巴哈姆特動漫瘋" }),
    );

    await waitFor(
      () => {
        expect(screen.queryByText("Scanning...")).not.toBeInTheDocument();
      },
      { timeout: 10000 },
    );

    expect(screen.getByText("High Score Anime")).toBeInTheDocument();
    expect(screen.queryByText("Test OVA Special")).not.toBeInTheDocument();
    expect(screen.queryByText("Short Anime")).not.toBeInTheDocument();
  });

  it("should restore an item from trash back to search results", async () => {
    const trashItem = {
      link: "http://trashed",
      title: "Trashed Anime",
      watch_count: 100,
      episode_count: "12",
      upload_date: "2024",
      score: 4.9,
      rating_count: 100,
      description: "In trash",
    };
    mockStorage.trash = [trashItem];

    render(<App />);

    // Wait for async load on mount
    await waitFor(() => {
      expect(screen.getByText("Trash (1)")).toBeInTheDocument();
    });

    // 1. Go to Trash Tab
    fireEvent.click(screen.getByRole("button", { name: /Trash/ }));
    expect(screen.getByText("Trashed Anime")).toBeInTheDocument();

    // 2. Click Restore
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "↺ Restore" }));
    });

    // 3. Verify it's gone from Trash
    await waitFor(() => {
      expect(
        screen.getByText("No anime found in this list."),
      ).toBeInTheDocument();
    });
    expect(screen.getByText("Trash (0)")).toBeInTheDocument();

    // 4. Verify it's back in Results (Search) Tab
    fireEvent.click(screen.getByRole("button", { name: /Results/ }));
    expect(screen.getByText("Trashed Anime")).toBeInTheDocument();
    expect(screen.getByText("Results (1)")).toBeInTheDocument();
  });
});
