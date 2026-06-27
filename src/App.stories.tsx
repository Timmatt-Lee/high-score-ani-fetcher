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
import { Observable } from "rxjs";
import { within } from "@storybook/test";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

/** Seed localStorage with realistic multi-tab data. */
const seedExistingData = () => {
  const existingSearch = [
    createMockAnime({
      title: "葬送的芙莉蓮",
      score: 4.9,
      link: "https://ani.gamer.com.tw/anime.php?sn=1111",
    }),
    createMockAnime({
      title: "鬼滅之刃 柱訓練篇",
      score: 4.8,
      link: "https://ani.gamer.com.tw/anime.php?sn=2222",
    }),
  ];
  const existingFavorites = [
    createMockAnime({
      title: "無職轉生 ～到了異世界就拿出真本事～",
      score: 4.9,
      link: "https://ani.gamer.com.tw/anime.php?sn=3333",
    }),
  ];
  const existingTrash = [
    createMockAnime({
      title: "我推的孩子",
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
};

// ---------------------------------------------------------------------------
// Meta
// ---------------------------------------------------------------------------

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
      return <Story />;
    },
  ],
  parameters: {
    chromatic: {
      cropToViewport: true,
      viewports: [320, 768, 1200],
    },
  },
};

export default meta;
type Story = StoryObj<typeof App>;

// ---------------------------------------------------------------------------
// 1. Empty / First-Run State
// ---------------------------------------------------------------------------

/** App on first launch — no data, search tab active. */
export const EmptySearchTab: Story = {
  decorators: [
    (Story) => (
      <ServiceProvider animeScraper={mockAnimeScraper as any}>
        <Story />
      </ServiceProvider>
    ),
  ],
};

// ---------------------------------------------------------------------------
// 2. Populated Data — Tab Navigation
// ---------------------------------------------------------------------------

/** Search tab showing pre-loaded anime items. */
export const PopulatedSearchTab: Story = {
  render: () => {
    seedExistingData();
    return (
      <ServiceProvider animeScraper={mockAnimeScraper as any}>
        <App />
      </ServiceProvider>
    );
  },
};

/** Favorites tab with a saved item. */
export const PopulatedFavoritesTab: Story = {
  render: () => {
    seedExistingData();
    return (
      <ServiceProvider animeScraper={mockAnimeScraper as any}>
        <App />
      </ServiceProvider>
    );
  },
  play: async ({ canvasElement }) => {
    const { userEvent } = await import("@storybook/test");
    const canvas = within(canvasElement);
    // Wait for the app container to be mounted in the DOM
    await canvas.findByTestId("app-container", {}, { timeout: 5000 });
    const favTab = await canvas.findByTestId("tab-favorites");
    await userEvent.click(favTab);
  },
};

/** Trash tab with a discarded item. */
export const PopulatedTrashTab: Story = {
  render: () => {
    seedExistingData();
    return (
      <ServiceProvider animeScraper={mockAnimeScraper as any}>
        <App />
      </ServiceProvider>
    );
  },
  play: async ({ canvasElement }) => {
    const { userEvent } = await import("@storybook/test");
    const canvas = within(canvasElement);
    // Wait for the app container to be mounted in the DOM
    await canvas.findByTestId("app-container", {}, { timeout: 5000 });
    const trashTab = await canvas.findByTestId("tab-trash");
    await userEvent.click(trashTab);
  },
};

/** Settings panel accessed via the gear icon tab. */
export const SettingsTab: Story = {
  decorators: [
    (Story) => (
      <ServiceProvider animeScraper={mockAnimeScraper as any}>
        <Story />
      </ServiceProvider>
    ),
  ],
  play: async ({ canvasElement }) => {
    const { userEvent } = await import("@storybook/test");
    const canvas = within(canvasElement);
    // Wait for the app container to be mounted in the DOM
    await canvas.findByTestId("app-container", {}, { timeout: 5000 });
    const settingsBtn = await canvas.findByTestId("tab-settings");
    await userEvent.click(settingsBtn);
  },
};

// ---------------------------------------------------------------------------
// 3. Scan Lifecycle
// ---------------------------------------------------------------------------

/** Scan in-progress — floating ProgressBar visible. */
export const ScanInProgress: Story = {
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
    const { userEvent } = await import("@storybook/test");
    const canvas = within(canvasElement);
    await canvas.findByTestId("app-container", {}, { timeout: 5000 });
    const scanBtn = await canvas.findByRole("button", { name: /Scan/i });
    await userEvent.click(scanBtn);
  },
};

/** Scan completed — floating ResultBanner visible. */
export const ScanCompleted: Story = {
  render: () => {
    seedExistingData();
    // Define the custom mock scan implementation
    AnimeScanner.prototype.scan = function (this: any) {
      return new Observable((subscriber) => {
        const run = async () => {
          await new Promise((resolve) => setTimeout(resolve, 10));
          subscriber.next(
            createMockAnime({
              title: "新發現的動畫",
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
        <App />
      </ServiceProvider>
    );
  },
  play: async ({ canvasElement }) => {
    const { userEvent } = await import("@storybook/test");
    const canvas = within(canvasElement);
    await canvas.findByTestId("app-container", {}, { timeout: 5000 });
    const scanBtn = await canvas.findByRole("button", { name: /Scan/i });
    await userEvent.click(scanBtn);
  },
};

// ---------------------------------------------------------------------------
// 4. Error States
// ---------------------------------------------------------------------------

/** Scan error — scan errors mid-way, shows ErrorCard + partial data. */
export const ScanError: Story = {
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
    const { userEvent } = await import("@storybook/test");
    const canvas = within(canvasElement);
    await canvas.findByTestId("app-container", {}, { timeout: 5000 });
    const scanBtn = await canvas.findByRole("button", { name: /Scan/i });
    await userEvent.click(scanBtn);
  },
};

// ---------------------------------------------------------------------------
// 5. Scroll Behavior
// ---------------------------------------------------------------------------

/** Large list scrolled down — verifies sticky header stays visible. */
export const ScrolledWithStickyHeader: Story = {
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
          <Story />
        </ServiceProvider>
      );
    },
  ],
  play: async () => {
    await new Promise((resolve) => setTimeout(resolve, 500));
    window.scrollTo(0, 250);
  },
};
