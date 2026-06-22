/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Meta, StoryObj } from "@storybook/react";
import App from "./App";
import { ServiceProvider } from "./contexts/ServiceContext";
import {
  AnimeScanHttpError,
  AnimeScanStep,
  AnimeScanner,
  type AnimeItem,
} from "./services/animeScanner";
import { AnimeScraper } from "./services/animeScanner/animeScraper";
import { Observable } from "rxjs";
import { within } from "@storybook/test";

// Helper to create sample anime items
const createMockAnime = (overrides: Partial<AnimeItem> = {}): AnimeItem => ({
  link: `https://ani.gamer.com.tw/anime.php?sn=${Math.floor(Math.random() * 10000)}`,
  title: "葬送的芙莉蓮",
  watchCount: 120000,
  episodeCount: 28,
  uploadDate: new Date("2023-09-29T00:00:00.000Z"),
  score: 4.9,
  ratingCount: 15432,
  description: "芙莉蓮與勇者一行人打倒魔王後，展開的新旅程與歲月流逝的故事。",
  ...overrides,
});

const mockAnimeScraper = {
  getTotalPages: async () => 4,
  scrapeAnimesOnPage: async (page: number): Promise<any> => {
    return [
      createMockAnime({ title: `動漫 ${page}-1`, score: 4.9 }),
      createMockAnime({ title: `動漫 ${page}-2`, score: 4.8 }),
    ];
  },
  scrapeAnimeDetails: async (link: string, page: number): Promise<any> => {
    return {
      score: 4.9,
      ratingCount: 5000,
      description: `詳細介紹 ${link} page ${page}`,
    };
  },
};

const meta: Meta<typeof App> = {
  title: "App",
  component: App,
  decorators: [
    (Story) => {
      localStorage.clear();
      // Define a default mock implementation for AnimeScanner.prototype.scan
      AnimeScanner.prototype.scan = function (this: any) {
        return new Observable((subscriber) => {
          const items = [
            createMockAnime({ title: "葬送的芙莉蓮", score: 4.9 }),
            createMockAnime({ title: "鬼滅之刃 柱訓練篇", score: 4.8 }),
            createMockAnime({ title: "無職轉生", score: 4.8 }),
            createMockAnime({ title: "神作續篇", score: 4.9 }),
          ];
          const run = async () => {
            for (const item of items) {
              await new Promise((resolve) => setTimeout(resolve, 10));
              subscriber.next(item);
            }
            subscriber.complete();
          };
          run();
        });
      };
      return (
        <div
          style={{
            width: "100%",
            maxWidth: "1200px",
            minHeight: "1000px",
            background: "var(--bg-color)",
            padding: "20px",
          }}
        >
          <Story />
        </div>
      );
    },
  ],
  parameters: {
    chromatic: {
      cropToViewport: true,
      viewports: [320, 768, 1200], // mobile, tablet, desktop viewports
    },
  },
};

export default meta;
type Story = StoryObj<typeof App>;

export const InitialEmptyState: Story = {
  decorators: [
    (Story) => (
      <ServiceProvider animeScraper={mockAnimeScraper as any}>
        <Story />
      </ServiceProvider>
    ),
  ],
};

export const FavoritesTabEmptyState: Story = {
  decorators: [
    (Story) => (
      <ServiceProvider animeScraper={mockAnimeScraper as any}>
        <Story />
      </ServiceProvider>
    ),
  ],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const favTab = await canvas.findByRole("button", { name: /Favorites/i });
    favTab.click();
  },
};

export const TrashTabEmptyState: Story = {
  decorators: [
    (Story) => (
      <ServiceProvider animeScraper={mockAnimeScraper as any}>
        <Story />
      </ServiceProvider>
    ),
  ],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trashTab = await canvas.findByRole("button", { name: /Trash/i });
    trashTab.click();
  },
};

export const ScanningFromEmpty: Story = {
  decorators: [
    (Story) => {
      AnimeScanner.prototype.scan = function (this: any) {
        return new Observable((subscriber) => {
          const run = async () => {
            await new Promise((resolve) => setTimeout(resolve, 10));
            subscriber.next(
              createMockAnime({ title: "葬送的芙莉蓮", score: 4.9 }),
            );
          };
          run();
        });
      };
      return (
        <ServiceProvider animeScraper={mockAnimeScraper as any}>
          <Story />
        </ServiceProvider>
      );
    },
  ],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const scanBtn = await canvas.findByRole("button", { name: /Scan/i });
    scanBtn.click();
  },
};

export const FailedScanDuringScraping: Story = {
  decorators: [
    (Story) => {
      AnimeScanner.prototype.scan = function (this: any) {
        const options = this.options;
        return new Observable((subscriber) => {
          const run = async () => {
            if (options && options.onlyPages && options.onlyPages.length > 0) {
              await new Promise((resolve) => setTimeout(resolve, 10));
              subscriber.next(
                createMockAnime({ title: "Retry Progress Detail", score: 4.9 }),
              );
              subscriber.complete();
              return;
            }

            await new Promise((resolve) => setTimeout(resolve, 20));
            subscriber.next(
              createMockAnime({
                title: "部分解析成功的動畫",
                score: 4.9,
              }),
            );
            subscriber.error(
              new AnimeScanHttpError(
                2,
                AnimeScanStep.SCRAPE_LIST_PAGE,
                "https://ani.gamer.com.tw/animeList.php?page=2",
                "Internal Server Error",
                500,
                "某個損壞的動畫番",
              ),
            );
          };
          run();
        });
      };
      return (
        <ServiceProvider animeScraper={mockAnimeScraper as any}>
          <Story />
        </ServiceProvider>
      );
    },
  ],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const scanBtn = await canvas.findByRole("button", { name: /Scan/i });
    scanBtn.click();
  },
};

export const WithError: Story = {
  decorators: [
    (Story) => {
      localStorage.clear();
      return <Story />;
    },
  ],
  render: () => {
    const mockAnimeScraperWithFatalError = {
      ...mockAnimeScraper,
      getTotalPages: async () => {
        throw new AnimeScanHttpError(
          1,
          AnimeScanStep.GET_TOTAL_PAGES,
          "https://ani.gamer.com.tw/animeList.php",
          "",
          500,
          undefined,
        );
      },
    };

    return (
      <ServiceProvider
        animeScraper={mockAnimeScraperWithFatalError as unknown as AnimeScraper}
      >
        <App />
      </ServiceProvider>
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const scanBtn = await canvas.findByRole("button", { name: /Scan/i });
    scanBtn.click();
  },
};

export const InitialExistingData: Story = {
  decorators: [
    (Story) => {
      const existingSearch = [
        createMockAnime({
          title: "原有已快取的動畫 (高分)",
          score: 4.8,
          link: "https://ani.gamer.com.tw/anime.php?sn=1111",
        }),
        createMockAnime({
          title: "被過濾的動畫 (分數太低不重新掃描)",
          score: 4.2,
          link: "https://ani.gamer.com.tw/anime.php?sn=2222",
        }),
      ];
      const existingFavorites = [
        createMockAnime({
          title: "原有的最愛動畫",
          score: 4.9,
          link: "https://ani.gamer.com.tw/anime.php?sn=3333",
        }),
      ];
      const existingTrash = [
        createMockAnime({
          title: "原有的垃圾桶動畫",
          score: 3.5,
          link: "https://ani.gamer.com.tw/anime.php?sn=4444",
        }),
      ];

      localStorage.setItem(
        "animeData",
        JSON.stringify({
          searchList: existingSearch,
          favoriteList: existingFavorites,
          trashList: existingTrash,
        }),
      );

      return (
        <ServiceProvider animeScraper={mockAnimeScraper as any}>
          <Story />
        </ServiceProvider>
      );
    },
  ],
};

export const ScanningWithExistingData: Story = {
  decorators: [
    (Story) => {
      const existingSearch = [
        createMockAnime({
          title: "原有已快取的動畫 (高分)",
          score: 4.8,
          link: "https://ani.gamer.com.tw/anime.php?sn=1111",
        }),
        createMockAnime({
          title: "被過濾的動畫 (分數太低不重新掃描)",
          score: 4.2,
          link: "https://ani.gamer.com.tw/anime.php?sn=2222",
        }),
      ];
      const existingFavorites = [
        createMockAnime({
          title: "原有的最愛動畫",
          score: 4.9,
          link: "https://ani.gamer.com.tw/anime.php?sn=3333",
        }),
      ];
      const existingTrash = [
        createMockAnime({
          title: "原有的垃圾桶動畫",
          score: 3.5,
          link: "https://ani.gamer.com.tw/anime.php?sn=4444",
        }),
      ];

      localStorage.setItem(
        "animeData",
        JSON.stringify({
          searchList: existingSearch,
          favoriteList: existingFavorites,
          trashList: existingTrash,
        }),
      );

      AnimeScanner.prototype.scan = function (this: any) {
        return new Observable((subscriber) => {
          const run = async () => {
            await new Promise((resolve) => setTimeout(resolve, 10));
            subscriber.next(
              createMockAnime({
                title: "正在掃描的新動畫...",
                score: 4.9,
                link: "https://ani.gamer.com.tw/anime.php?sn=5555",
              }),
            );
          };
          run();
        });
      };

      return (
        <ServiceProvider animeScraper={mockAnimeScraper as any}>
          <Story />
        </ServiceProvider>
      );
    },
  ],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const scanBtn = await canvas.findByRole("button", { name: /Scan/i });
    scanBtn.click();
  },
};

export const ScanCompletedWithExistingData: Story = {
  decorators: [
    (Story) => {
      const existingSearch = [
        createMockAnime({
          title: "原有已快取的動畫 (高分)",
          score: 4.8,
          link: "https://ani.gamer.com.tw/anime.php?sn=1111",
        }),
        createMockAnime({
          title: "被過濾的動畫 (分數太低不重新掃描)",
          score: 4.2,
          link: "https://ani.gamer.com.tw/anime.php?sn=2222",
        }),
      ];
      const existingFavorites = [
        createMockAnime({
          title: "原有的最愛動畫",
          score: 4.9,
          link: "https://ani.gamer.com.tw/anime.php?sn=3333",
        }),
      ];
      const existingTrash = [
        createMockAnime({
          title: "原有的垃圾桶動畫",
          score: 3.5,
          link: "https://ani.gamer.com.tw/anime.php?sn=4444",
        }),
      ];

      localStorage.setItem(
        "animeData",
        JSON.stringify({
          searchList: existingSearch,
          favoriteList: existingFavorites,
          trashList: existingTrash,
        }),
      );

      AnimeScanner.prototype.scan = function (this: any) {
        return new Observable((subscriber) => {
          const run = async () => {
            await new Promise((resolve) => setTimeout(resolve, 10));
            subscriber.next(
              createMockAnime({
                title: "掃描發現的新動畫",
                score: 4.9,
                link: "https://ani.gamer.com.tw/anime.php?sn=5555",
              }),
            );
            subscriber.complete();
          };
          run();
        });
      };

      return (
        <ServiceProvider animeScraper={mockAnimeScraper as any}>
          <Story />
        </ServiceProvider>
      );
    },
  ],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const scanBtn = await canvas.findByRole("button", { name: /Scan/i });
    scanBtn.click();
  },
};

export const SettingsTabShowcase: Story = {
  decorators: [
    (Story) => (
      <ServiceProvider animeScraper={mockAnimeScraper as any}>
        <Story />
      </ServiceProvider>
    ),
  ],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const settingsTabBtn = await canvas.findByRole("button", {
      name: /Settings/i,
    });
    settingsTabBtn.click();
  },
};

export const LargeListScrolled: Story = {
  decorators: [
    (Story) => {
      const items = Array.from({ length: 35 }, (_, idx) =>
        createMockAnime({
          title: `動畫項目 ${idx + 1}`,
          score: 4.5 + (idx % 6) * 0.1,
          watchCount: 50000 + idx * 10000,
          link: `https://ani.gamer.com.tw/anime.php?sn=${1000 + idx}`,
        }),
      );
      localStorage.setItem(
        "animeData",
        JSON.stringify({
          searchList: items,
          favoriteList: [],
          trashList: [],
        }),
      );
      return (
        <ServiceProvider animeScraper={mockAnimeScraper as any}>
          <div
            className="scrollable-test-container"
            style={{
              height: "600px",
              overflowY: "auto",
              position: "relative",
              width: "100%",
            }}
          >
            <Story />
          </div>
        </ServiceProvider>
      );
    },
  ],
  play: async () => {
    await new Promise((resolve) => setTimeout(resolve, 500));
    const container = document.querySelector(".scrollable-test-container");
    if (container) {
      container.scrollTop = 400;
    }
  },
};

export const FavoritesLargeListScrolled: Story = {
  decorators: [
    (Story) => {
      const items = Array.from({ length: 35 }, (_, idx) =>
        createMockAnime({
          title: `最愛動畫項目 ${idx + 1}`,
          score: 4.5 + (idx % 6) * 0.1,
          watchCount: 50000 + idx * 10000,
          link: `https://ani.gamer.com.tw/anime.php?sn=${2000 + idx}`,
        }),
      );
      localStorage.setItem(
        "animeData",
        JSON.stringify({
          searchList: [],
          favoriteList: items,
          trashList: [],
        }),
      );
      return (
        <ServiceProvider animeScraper={mockAnimeScraper as any}>
          <div
            className="scrollable-test-container"
            style={{
              height: "600px",
              overflowY: "auto",
              position: "relative",
              width: "100%",
            }}
          >
            <Story />
          </div>
        </ServiceProvider>
      );
    },
  ],
  play: async ({ canvasElement }) => {
    const { userEvent } = await import("@storybook/test");
    const canvas = within(canvasElement);
    const favTabBtn = await canvas.findByRole("button", { name: /Favorites/i });
    await userEvent.click(favTabBtn);
    await new Promise((resolve) => setTimeout(resolve, 500));
    const container = document.querySelector(".scrollable-test-container");
    if (container) {
      container.scrollTop = 400;
    }
  },
};

export const TrashLargeListScrolled: Story = {
  decorators: [
    (Story) => {
      const items = Array.from({ length: 35 }, (_, idx) =>
        createMockAnime({
          title: `垃圾桶動畫項目 ${idx + 1}`,
          score: 4.5 + (idx % 6) * 0.1,
          watchCount: 50000 + idx * 10000,
          link: `https://ani.gamer.com.tw/anime.php?sn=${3000 + idx}`,
        }),
      );
      localStorage.setItem(
        "animeData",
        JSON.stringify({
          searchList: [],
          favoriteList: [],
          trashList: items,
        }),
      );
      return (
        <ServiceProvider animeScraper={mockAnimeScraper as any}>
          <div
            className="scrollable-test-container"
            style={{
              height: "600px",
              overflowY: "auto",
              position: "relative",
              width: "100%",
            }}
          >
            <Story />
          </div>
        </ServiceProvider>
      );
    },
  ],
  play: async ({ canvasElement }) => {
    const { userEvent } = await import("@storybook/test");
    const canvas = within(canvasElement);
    const trashTabBtn = await canvas.findByRole("button", { name: /Trash/i });
    await userEvent.click(trashTabBtn);
    await new Promise((resolve) => setTimeout(resolve, 500));
    const container = document.querySelector(".scrollable-test-container");
    if (container) {
      container.scrollTop = 400;
    }
  },
};
