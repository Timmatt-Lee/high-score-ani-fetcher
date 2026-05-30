import type { Meta, StoryObj } from "@storybook/react";
import App from "./App";
import { ServiceProvider } from "./contexts/ServiceContext";
import { type AnimeItem, type ScraperResult } from "./types/anime";
import {
  ScraperHttpError,
  ScraperParseError,
  ScraperErrorSource,
  ScraperUnknownError,
} from "./errors";
import { ScraperService } from "./services/scraper";

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
  scanAllWithPipeline: async (
    _totalPages: number,
    _pageConcurrency: number,
    _detailConcurrency: number,
    _filterItem: (item: AnimeItem) => boolean,
    onProgress: (
      pagesCompleted: number,
      pagesTotal: number,
      detailsCompleted: number,
      detailsTotal: number,
      currentTitle?: string,
    ) => void,
  ): Promise<ScraperResult> => {
    const titles = [
      "葬送的芙莉蓮",
      "動漫瘋熱門新作",
      "極高評分動畫",
      "神作續篇",
    ];

    // Simulate pipeline scanning with step-by-step progress callbacks
    for (let isStep = 1; isStep <= 4; isStep++) {
      await new Promise((resolve) => setTimeout(resolve, 500));
      onProgress(isStep, 4, isStep * 2, 8, titles[isStep - 1]);
    }

    return {
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
    };
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
      scanAllWithPipeline: async (): Promise<ScraperResult> => {
        return {
          items: [createMockAnime({ title: "部分解析成功的動畫", score: 4.9 })],
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
        };
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
};

// Automate click to enter fatal error screen for visual review
const clickScanOnMount = (Story: () => React.ReactElement) => {
  setTimeout(() => {
    const btn = document.querySelector("button");
    if (btn && btn.textContent === "Scan 巴哈姆特動漫瘋") {
      btn.click();
    }
  }, 100);
  return <Story />;
};

export const WithFatalHttpError: Story = {
  decorators: [clickScanOnMount],
  render: () => {
    const mockService = {
      ...mockScraperService,
      getTotalPages: async () => {
        return new ScraperHttpError(
          "https://ani.gamer.com.tw/animeList.php?page=1",
          "HTTP 500 Internal Server Error",
          500,
        );
      },
    };
    return (
      <ServiceProvider
        scraperService={mockService as unknown as ScraperService}
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
};

export const WithFatalParseError: Story = {
  decorators: [clickScanOnMount],
  render: () => {
    const mockService = {
      ...mockScraperService,
      getTotalPages: async () => {
        return new ScraperParseError(
          ScraperErrorSource.PAGINATION,
          "https://ani.gamer.com.tw/animeList.php?page=1",
          "Invalid HTML document structure",
          "Pagination element not found",
        );
      },
    };
    return (
      <ServiceProvider
        scraperService={mockService as unknown as ScraperService}
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
};

export const WithFatalUnknownError: Story = {
  decorators: [clickScanOnMount],
  render: () => {
    const mockService = {
      ...mockScraperService,
      getTotalPages: async () => {
        return new ScraperUnknownError(
          new Error("An unexpected system exception occurred"),
        );
      },
    };
    return (
      <ServiceProvider
        scraperService={mockService as unknown as ScraperService}
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
};
