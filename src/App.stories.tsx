import type { Meta, StoryObj } from "@storybook/react";
import App from "./App";
import { ServiceProvider } from "./contexts/ServiceContext";
import {
  type AnimeItem,
  type ScanEvent,
  type PipelineOptions,
} from "./types/anime";
import {
  ScraperHttpError,
  ScraperParseError,
  ScraperScanStep,
  ScraperService,
} from "./services/scraper";
import { Observable } from "rxjs";

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
    // Simulate tiny network delay for speed and stability
    await new Promise((resolve) => setTimeout(resolve, 10));
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
          await new Promise((resolve) => setTimeout(resolve, 10));
          subscriber.next({
            type: "page_completed",
            pageNum: isStep,
            success: true,
          });
          subscriber.next({
            type: "detail_completed",
            title: titles[isStep - 1],
            success: true,
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
            <style>{`
              div[class*="appContainer"] {
                height: auto !important;
                max-height: none !important;
                overflow: visible !important;
              }
            `}</style>
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
      scanAllWithPipeline: (
        _totalPages: number,
        _pageConcurrency: number,
        _detailConcurrency: number,
        _filterItem: (item: AnimeItem) => boolean,
        options?: PipelineOptions,
      ): Observable<ScanEvent> => {
        return new Observable((subscriber) => {
          let isCancelled = false;
          const run = async () => {
            if (options) {
              // Retry scan: emit progress events and NEVER complete so Chromatic captures the scanning state
              await new Promise((resolve) => setTimeout(resolve, 10));
              if (isCancelled) return;
              subscriber.next({
                type: "page_completed",
                pageNum: 2,
                success: true,
              });
              return;
            }

            // First scan: completes after 20ms with errors
            await new Promise((resolve) => setTimeout(resolve, 20));
            if (isCancelled) return;
            subscriber.next({
              type: "completed",
              result: {
                items: [
                  createMockAnime({ title: "部分解析成功的動畫", score: 4.9 }),
                ],
                httpErrors: [
                  Object.assign(
                    new ScraperHttpError(
                      2,
                      ScraperScanStep.PAGINATION,
                      "https://ani.gamer.com.tw/animeList.php?page=2",
                      "",
                      502,
                      undefined,
                    ),
                    { animeName: "某個好看但部分章節損壞的番" },
                  ),
                ],
                parseErrors: [
                  Object.assign(
                    new ScraperParseError(
                      3,
                      ScraperScanStep.TITLE,
                      "https://ani.gamer.com.tw/animeVideo.php?sn=999",
                      "",
                      "Missing title tag",
                    ),
                    { animeName: "某個好看但部分章節損壞的番" },
                  ),
                ],
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
          <style>{`
            div[class*="appContainer"] {
              height: auto !important;
              max-height: none !important;
              overflow: visible !important;
            }
          `}</style>
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

export const WithRetryingState: Story = {
  ...WithScanErrors,
  play: async ({ canvasElement }) => {
    const waitForElement = async (selector: string): Promise<Element> => {
      for (let i = 0; i < 100; i++) {
        const el = canvasElement.querySelector(selector);
        if (el) return el;
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
      throw new Error(`Element ${selector} not found`);
    };

    // 1. Click scan first to populate errors
    await new Promise((resolve) => setTimeout(resolve, 50));
    const scanBtn = Array.from(canvasElement.querySelectorAll("button")).find(
      (btn) => btn.textContent?.includes("Scan"),
    );
    if (scanBtn) {
      (scanBtn as HTMLButtonElement).click();
    }
    // 2. Wait for first scan to complete and Retry button to appear
    const retryBtn = (await waitForElement(
      '[data-testid="retry-errors-btn"]',
    )) as HTMLButtonElement;
    // Wait a brief moment to ensure React has fully attached event listeners
    await new Promise((resolve) => setTimeout(resolve, 200));
    // 3. Click the retry button
    retryBtn.click();

    // 4. Poll and assert that errors panel hides and progress bar shows
    const waitForElementToHide = async (selector: string): Promise<void> => {
      for (let i = 0; i < 100; i++) {
        const el = canvasElement.querySelector(selector);
        if (!el) return;
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
      throw new Error(
        `Self-assertion failed: ${selector} did not hide during retry scan!`,
      );
    };

    const waitForElementToShow = async (selector: string): Promise<Element> => {
      for (let i = 0; i < 100; i++) {
        const el = canvasElement.querySelector(selector);
        if (el) return el;
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
      throw new Error(
        `Self-assertion failed: ${selector} did not show during retry scan!`,
      );
    };

    await waitForElementToHide('[data-testid="errors-panel"]');
    await waitForElementToShow('[data-testid="progress-container"]');
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
    const mockScraperServiceWithFatalError = {
      ...mockScraperService,
      getTotalPages: async () => {
        return new ScraperHttpError(
          1,
          ScraperScanStep.PAGINATION,
          "https://ani.gamer.com.tw/animeList.php",
          "",
          500,
          undefined,
        );
      },
    };

    return (
      <ServiceProvider
        scraperService={
          mockScraperServiceWithFatalError as unknown as ScraperService
        }
      >
        <div
          style={{
            width: "450px",
            border: "1px solid #333",
            background: "#121212",
          }}
        >
          <style>{`
            div[class*="appContainer"] {
              height: auto !important;
              max-height: none !important;
              overflow: visible !important;
            }
          `}</style>
          <App />
        </div>
      </ServiceProvider>
    );
  },
  play: async ({ canvasElement }) => {
    await new Promise((resolve) => setTimeout(resolve, 50));
    const scanBtn = Array.from(canvasElement.querySelectorAll("button")).find(
      (btn) => btn.textContent?.includes("Scan"),
    );
    if (scanBtn) {
      (scanBtn as HTMLButtonElement).click();
    }
  },
};

export const WithScanningState: Story = {
  decorators: [
    (Story) => {
      localStorage.clear();
      return <Story />;
    },
  ],
  render: () => {
    // We override ScraperService to return a scan that NEVER completes
    const mockScraperServiceScanning = {
      ...mockScraperService,
      getTotalPages: async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        return 10;
      },
      scanAllWithPipeline: (): Observable<ScanEvent> => {
        return new Observable((subscriber) => {
          let isCancelled = false;
          const run = async () => {
            await new Promise((resolve) => setTimeout(resolve, 10));
            if (isCancelled) return;
            subscriber.next({
              type: "page_completed",
              pageNum: 1,
              success: true,
            });
            // We emit details completed and then do not call complete()
            // to keep it in scanning state forever for screenshot capture.
            subscriber.next({
              type: "detail_completed",
              title: "葬送的芙莉蓮",
              success: true,
            });
          };
          run();
          return () => {
            isCancelled = true;
          };
        });
      },
    };

    return (
      <ServiceProvider
        scraperService={mockScraperServiceScanning as unknown as ScraperService}
      >
        <div
          style={{
            width: "450px",
            border: "1px solid #333",
            background: "#121212",
          }}
        >
          <style>{`
            div[class*="appContainer"] {
              height: auto !important;
              max-height: none !important;
              overflow: visible !important;
            }
          `}</style>
          <App />
        </div>
      </ServiceProvider>
    );
  },
  play: async ({ canvasElement }) => {
    // 1. Wait for mount, then click the Scan button
    await new Promise((resolve) => setTimeout(resolve, 50));
    const scanBtn = Array.from(canvasElement.querySelectorAll("button")).find(
      (btn) => btn.textContent?.includes("Scan"),
    );
    if (scanBtn) {
      (scanBtn as HTMLButtonElement).click();
    }

    // 2. Poll and assert that progress bar correctly shows up
    const waitForElementToShow = async (selector: string): Promise<Element> => {
      for (let i = 0; i < 100; i++) {
        const el = canvasElement.querySelector(selector);
        if (el) return el;
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
      throw new Error(
        `Self-assertion failed: ${selector} did not show during scan state!`,
      );
    };

    await waitForElementToShow('[data-testid="progress-container"]');
  },
};
