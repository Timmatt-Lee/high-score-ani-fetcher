import type { Meta, StoryObj } from "@storybook/react";
import App from "./App";
import { ServiceProvider } from "./contexts/ServiceContext";
import { type AnimeItem, type ScanEvent } from "./types/anime";
import {
  ScraperHttpError,
  ScraperParseError,
  ScraperErrorSource,
} from "./errors";
import { ScraperService } from "./services/scraper";
import { Observable, of } from "rxjs";

// Helper to create sample anime items
const createMockAnime = (overrides: Partial<AnimeItem> = {}): AnimeItem => ({
  link: `https://ani.gamer.com.tw/anime.php?sn=${Math.floor(Math.random() * 10000)}`,
  title: "葬送的芙莉蓮",
  watchCount: 120000,
  episodeCount: 28,
  uploadDate: new Date("2023-09-29"),
  score: 4.9,
  ratingCount: 15432,
  description: "芙莉蓮與勇者一行人打倒魔王後，展開的新旅程與歲月流逝的故事。",
  ...overrides,
});

// A robust mock of ScraperService that simulates progress ticks and resolves with new high-score items
const mockScraperService = {
  getTotalPages: async () => {
    // Simulate network delay
    await new Promise((resolve) => setTimeout(resolve, 600));
    return 3;
  },
  scrapeListPage: async () => {
    return { items: [], httpErrors: [], parseErrors: [] };
  },
  scrapeAnimeDetails: async () => {
    return {
      score: 4.9,
      ratingCount: 1000,
      description: "Mock details",
    };
  },
  scanAllWithPipeline: (): Observable<ScanEvent> => {
    return new Observable((subscriber) => {
      let isCancelled = false;
      const run = async () => {
        const titles = [
          "葬送的芙莉蓮",
          "動漫瘋熱門新作",
          "極高評分動畫",
          "神作續篇",
        ];
        for (let isStep = 1; isStep <= 4; isStep++) {
          if (isCancelled) return;
          await new Promise((resolve) => setTimeout(resolve, 300));
          subscriber.next({ type: "page_completed" });
          subscriber.next({
            type: "detail_completed",
            title: titles[isStep - 1],
          });
        }
        if (isCancelled) return;
        subscriber.next({
          type: "completed",
          result: {
            items: [
              createMockAnime({
                title: "葬送的芙莉蓮",
                score: 4.9,
                link: "https://ani.gamer.com.tw/anime.php?sn=1",
              }),
              createMockAnime({
                title: "動漫瘋熱門新作",
                score: 4.8,
                link: "https://ani.gamer.com.tw/anime.php?sn=2",
              }),
            ],
            httpErrors: [],
            parseErrors: [],
          },
        });
        subscriber.complete();
      };
      run();
      return () => {
        isCancelled = true;
      };
    });
  },
};

const meta: Meta<typeof App> = {
  title: "App/PopupLayout",
  component: App,
  decorators: [
    (Story) => {
      // Stub chrome storage to prevent extension-context errors
      if (typeof window !== "undefined") {
        (window as unknown as { chrome: unknown }).chrome = undefined;
      }
      return (
        <ServiceProvider
          scraperService={mockScraperService as unknown as ScraperService}
        >
          <div
            style={{
              width: "450px",
              border: "1px solid #333",
              background: "#121212",
            }}
          >
            <Story />
          </div>
        </ServiceProvider>
      );
    },
  ],
};

export default meta;
type Story = StoryObj<typeof App>;

export const EmptyState: Story = {
  decorators: [
    (Story) => {
      localStorage.clear();
      return <Story />;
    },
  ],
};

export const WithLoadedData: Story = {
  decorators: [
    (Story) => {
      localStorage.clear();
      const mockSearchList = [
        createMockAnime({
          title: "進擊的巨人 The Final Season",
          score: 4.9,
          watchCount: 450000,
        }),
        createMockAnime({
          title: "鬼滅之刃 柱訓練篇",
          score: 4.8,
          watchCount: 300000,
        }),
      ];
      const mockFavoriteList = [
        createMockAnime({
          title: "鋼之鍊金術師 BROTHERHOOD",
          score: 4.9,
          watchCount: 99999,
          link: "https://ani.gamer.com.tw/anime.php?sn=fav1",
        }),
      ];
      const mockTrashList = [
        createMockAnime({
          title: "爛尾劣質番",
          score: 3.2,
          watchCount: 500,
          link: "https://ani.gamer.com.tw/anime.php?sn=trash1",
        }),
      ];
      localStorage.setItem(
        "animeData",
        JSON.stringify({
          searchList: mockSearchList,
          favoriteList: mockFavoriteList,
          trashList: mockTrashList,
        }),
      );
      return <Story />;
    },
  ],
};

export const WithScanErrors: Story = {
  decorators: [
    (Story) => {
      localStorage.clear();
      // Setup some scan results with partial errors in local storage
      const mockSearchList = [
        createMockAnime({
          title: "某個好看但部分章節損壞的番",
          score: 4.8,
        }),
      ];
      localStorage.setItem(
        "animeData",
        JSON.stringify({
          searchList: mockSearchList,
          favoriteList: [],
          trashList: [],
        }),
      );
      return <Story />;
    },
  ],
  render: () => {
    // We override ScraperService to return errors for this specific story
    const mockScraperServiceWithErrors = {
      ...mockScraperService,
      getTotalPages: async () => 1,
      scanAllWithPipeline: (): Observable<ScanEvent> => {
        return of({
          type: "completed",
          result: {
            items: [
              createMockAnime({ title: "部分解析成功的動畫", score: 4.9 }),
            ],
            httpErrors: [
              new ScraperHttpError(
                "https://ani.gamer.com.tw/animeList.php?page=2",
                "HTTP 502 Bad Gateway",
                502,
              ),
            ],
            parseErrors: [
              new ScraperParseError(
                ScraperErrorSource.TITLE,
                "https://ani.gamer.com.tw/animeVideo.php?sn=999",
                "Missing title tag",
                "Could not parse title",
              ),
            ],
          },
        });
      },
    };

    return (
      <ServiceProvider
        scraperService={
          mockScraperServiceWithErrors as unknown as ScraperService
        }
      >
        <div
          style={{
            width: "450px",
            border: "1px solid #333",
            background: "#121212",
          }}
        >
          <App />
        </div>
      </ServiceProvider>
    );
  },
  play: async ({ canvasElement }) => {
    // Wait a tiny bit for the component to mount, then click the scan button
    await new Promise((resolve) => setTimeout(resolve, 50));
    const scanBtn = Array.from(canvasElement.querySelectorAll("button")).find(
      (btn) => btn.textContent?.includes("Scan"),
    );
    if (scanBtn) {
      (scanBtn as HTMLButtonElement).click();
    }
  },
};
