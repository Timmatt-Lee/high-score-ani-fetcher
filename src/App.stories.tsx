/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Meta, StoryObj } from "@storybook/react";
import App from "./App";
import { ServiceProvider } from "./contexts/ServiceContext";
import {
  AnimeScanHttpError,
  AnimeScanParseError,
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
  uploadDate: new Date("2023-09-29"),
  score: 4.9,
  ratingCount: 15432,
  description: "芙莉蓮與勇者一行人打倒魔王後，展開的新旅程與歲月流逝的故事。",
  ...overrides,
});

const mockAnimeScraper = {
  getTotalPages: async () => 4,
  scrapeAnimesOnPage: async (page: number): Promise<any> => {
    return {
      animeItems: [
        createMockAnime({ title: `動漫 ${page}-1`, score: 4.9 }),
        createMockAnime({ title: `動漫 ${page}-2`, score: 4.8 }),
      ],
      httpErrors: [],
      parseErrors: [],
    };
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
  title: "App/PopupLayout",
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
          style={{ width: "450px", minHeight: "600px", background: "#121212" }}
        >
          <Story />
        </div>
      );
    },
  ],
  parameters: {
    chromatic: {
      cropToViewport: true,
    },
  },
};

export default meta;
type Story = StoryObj<typeof App>;

export const Default: Story = {
  decorators: [
    (Story) => (
      <ServiceProvider animeScraper={mockAnimeScraper as any}>
        <Story />
      </ServiceProvider>
    ),
  ],
};

export const ScanningState: Story = {
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

export const PartiallyFailedScan: Story = {
  decorators: [
    (Story) => {
      AnimeScanner.prototype.scan = function (this: any) {
        const options = this.options;
        return new Observable((subscriber) => {
          const run = async () => {
            if (options) {
              await new Promise((resolve) => setTimeout(resolve, 10));
              subscriber.next(
                createMockAnime({ title: "Retry Progress Detail", score: 4.9 }),
              );
              return;
            }

            await new Promise((resolve) => setTimeout(resolve, 20));
            subscriber.next(
              createMockAnime({
                title: "部分解析成功的動畫",
                score: 4.9,
              }),
            );
            subscriber.next(
              Object.assign(
                new AnimeScanHttpError(
                  2,
                  AnimeScanStep.GET_TOTAL_PAGES,
                  "https://ani.gamer.com.tw/animeList.php?page=2",
                  "",
                  502,
                  undefined,
                ),
                { animeName: "某個好看但部分章節損壞的番" },
              ),
            );
            subscriber.next(
              Object.assign(
                new AnimeScanParseError(
                  3,
                  AnimeScanStep.PARSE_ANIME_INFO,
                  "https://ani.gamer.com.tw/animeList.php?page=3",
                  "",
                  "解析失敗",
                ),
                { animeName: "某個結構毀損無法取得標題的番" },
              ),
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
    // Click scan
    const canvas = within(canvasElement);
    const scanBtn = await canvas.findByRole("button", { name: /Scan/i });
    scanBtn.click();
  },
};

export const PartiallyFailedScanExpanded: Story = {
  ...PartiallyFailedScan,
  play: async (context) => {
    // Click scan first
    await PartiallyFailedScan.play?.(context);
    const { canvasElement } = context;
    const canvas = within(canvasElement);

    // Wait for the scanning to complete and show results / errors tab using findBy
    await canvas.findByTestId("errors-panel");

    // Expand HTTP errors
    const httpHeader = await canvas.findByTestId("http-errors-header");
    httpHeader.click();

    // Expand Parser errors
    const parseHeader = await canvas.findByTestId("parse-errors-header");
    parseHeader.click();
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
        return new AnimeScanHttpError(
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

export const WithLoadingDetails: Story = {
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

export const WithExistingData: Story = {
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

export const WithExistingDataScan: Story = {
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
