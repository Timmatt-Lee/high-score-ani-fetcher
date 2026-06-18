/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Meta, StoryObj } from "@storybook/react";
import App from "./App";
import { ServiceProvider } from "./contexts/ServiceContext";
import {
  AnimeScanHttpError,
  AnimeScanParseError,
  AnimeScanStep,
  type AnimeItem,
} from "./services/animeScanner";
import { AnimeScraper } from "./services/animeScanner/animeScraper";

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
  getTotalPages: async () => 2,
  scrapeAnimesOnPage: async (page: number): Promise<any> => {
    return {
      animeItems: [createMockAnime({ title: `動漫 ${page}-1`, score: 4.9 })],
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
      const slowScraper = {
        ...mockAnimeScraper,
        scrapeAnimeDetails: async () => new Promise<any>(() => {}), // hangs forever
      };
      return (
        <ServiceProvider animeScraper={slowScraper as any}>
          <Story />
        </ServiceProvider>
      );
    },
  ],
  play: async ({ canvasElement }) => {
    const scanBtn = canvasElement.querySelector("button");
    if (scanBtn) {
      (scanBtn as HTMLButtonElement).click();
    }
  },
};

export const PartiallyFailedScan: Story = {
  decorators: [
    (Story) => {
      const isRetried = false;
      const failedScraper = {
        ...mockAnimeScraper,
        getTotalPages: async () => 3,
        scrapeAnimesOnPage: async (page: number): Promise<any> => {
          if (page === 2 && !isRetried) {
            return {
              animeItems: [],
              httpErrors: [
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
              ],
              parseErrors: [],
            };
          }
          if (page === 3 && !isRetried) {
            return {
              animeItems: [],
              httpErrors: [],
              parseErrors: [
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
              ],
            };
          }
          if (isRetried) {
            return {
              animeItems: [
                createMockAnime({
                  title: `Retry Progress Detail ${page}`,
                  score: 4.9,
                }),
              ],
              httpErrors: [],
              parseErrors: [],
            };
          }
          return {
            animeItems: [
              createMockAnime({ title: "部分解析成功的動畫", score: 4.9 }),
            ],
            httpErrors: [],
            parseErrors: [],
          };
        },
      };
      return (
        <ServiceProvider animeScraper={failedScraper as any}>
          <Story />
        </ServiceProvider>
      );
    },
  ],
  play: async ({ canvasElement }) => {
    const scanBtn = canvasElement.querySelector("button");
    if (scanBtn) {
      (scanBtn as HTMLButtonElement).click();
    }
  },
};

export const PartiallyFailedScanExpanded: Story = {
  ...PartiallyFailedScan,
  play: async (context) => {
    await PartiallyFailedScan.play?.(context);
    const { canvasElement } = context;

    const findErrorsPanel = () =>
      canvasElement.querySelector('[data-testid="errors-panel"]');
    await new Promise<void>((resolve) => {
      const interval = setInterval(() => {
        const el = findErrorsPanel();
        if (el) {
          clearInterval(interval);
          resolve();
        }
      }, 50);
    });

    const httpHeader = canvasElement.querySelector(
      '[data-testid="http-errors-header"]',
    );
    if (httpHeader) (httpHeader as HTMLDivElement).click();

    const parseHeader = canvasElement.querySelector(
      '[data-testid="parse-errors-header"]',
    );
    if (parseHeader) (parseHeader as HTMLDivElement).click();
  },
};

export const WithError: Story = {
  decorators: [
    (Story) => {
      localStorage.clear();
      const fatalErrorScraper = {
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
          animeScraper={fatalErrorScraper as unknown as AnimeScraper}
        >
          <Story />
        </ServiceProvider>
      );
    },
  ],
  play: async ({ canvasElement }) => {
    const scanBtn = canvasElement.querySelector("button");
    if (scanBtn) {
      (scanBtn as HTMLButtonElement).click();
    }
  },
};

export const WithLoadingDetails: Story = {
  decorators: [
    (Story) => {
      const singleItemScraper = {
        ...mockAnimeScraper,
        getTotalPages: async () => 1,
        scrapeAnimesOnPage: async (): Promise<any> => {
          return {
            animeItems: [createMockAnime()],
            httpErrors: [],
            parseErrors: [],
          };
        },
        scrapeAnimeDetails: async (): Promise<any> => new Promise(() => {}),
      };
      return (
        <ServiceProvider animeScraper={singleItemScraper as any}>
          <Story />
        </ServiceProvider>
      );
    },
  ],
  play: async ({ canvasElement }) => {
    const scanBtn = canvasElement.querySelector("button");
    if (scanBtn) {
      (scanBtn as HTMLButtonElement).click();
    }
  },
};
