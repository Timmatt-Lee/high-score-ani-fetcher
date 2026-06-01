/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Meta, StoryObj } from "@storybook/react";
import App from "./App";
import { ServiceProvider } from "./contexts/ServiceContext";
import { type AnimeItem } from "./types/anime";
import {
  ScraperHttpError,
  ScraperParseError,
  ScraperScanStep,
  ScraperService,
  ScanEventType,
  type ScanEvent,
  type PipelineOptions,
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

const mockScraperService = {
  getTotalPages: async () => 4,
  scrapeListPage: async (page: number): Promise<any> => {
    return {
      items: [
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
  scanAllWithPipeline: (
    _totalPages: number,
    _pageConcurrency: number,
    _detailConcurrency: number,
    _filterItem: (item: AnimeItem) => boolean,
    _options?: PipelineOptions,
  ): Observable<ScanEvent> => {
    return new Observable((subscriber) => {
      let isCancelled = false;
      const run = async () => {
        const titles = [
          "葬送的芙莉蓮",
          "鬼滅之刃 柱訓練篇",
          "無職轉生",
          "神作續篇",
        ];
        for (let isStep = 1; isStep <= 4; isStep++) {
          if (isCancelled) return;
          await new Promise((resolve) => setTimeout(resolve, 10));
          subscriber.next({
            type: ScanEventType.PAGE_COMPLETED,
            page: isStep,
            isSuccess: true,
          });
          subscriber.next({
            type: ScanEventType.DETAIL_COMPLETED,
            title: titles[isStep - 1],
            isSuccess: true,
          });
        }
        if (isCancelled) return;
        subscriber.next({
          type: ScanEventType.COMPLETED,
          result: {
            items: [
              createMockAnime({ title: "葬送的芙莉蓮", score: 4.9 }),
              createMockAnime({ title: "鬼滅之刃 柱訓練篇", score: 4.8 }),
              createMockAnime({ title: "無職轉生", score: 4.8 }),
              createMockAnime({ title: "神作續篇", score: 4.9 }),
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
      localStorage.clear();
      return (
        <div
          style={{ width: "380px", minHeight: "500px", background: "#121212" }}
        >
          <Story />
        </div>
      );
    },
  ],
};

export default meta;
type Story = StoryObj<typeof App>;

export const Default: Story = {
  decorators: [
    (Story) => (
      <ServiceProvider scraperService={mockScraperService as any}>
        <Story />
      </ServiceProvider>
    ),
  ],
};

export const ScanningState: Story = {
  decorators: [
    (Story) => {
      const slowScraperService = {
        ...mockScraperService,
        scanAllWithPipeline: (): Observable<ScanEvent> => {
          return new Observable((subscriber) => {
            let isCancelled = false;
            const run = async () => {
              await new Promise((resolve) => setTimeout(resolve, 10));
              if (isCancelled) return;
              subscriber.next({
                type: ScanEventType.PAGE_COMPLETED,
                page: 1,
                isSuccess: true,
              });
              // We emit details completed and then do not call complete()
              // to keep it in scanning state forever for screenshot capture.
              subscriber.next({
                type: ScanEventType.DETAIL_COMPLETED,
                title: "葬送的芙莉蓮",
                isSuccess: true,
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
        <ServiceProvider scraperService={slowScraperService as any}>
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
      const failingScraperService = {
        ...mockScraperService,
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
                  type: ScanEventType.PAGE_COMPLETED,
                  page: 2,
                  isSuccess: true,
                });
                return;
              }

              // First scan: completes after 20ms with errors
              await new Promise((resolve) => setTimeout(resolve, 20));
              if (isCancelled) return;
              subscriber.next({
                type: ScanEventType.COMPLETED,
                result: {
                  items: [
                    createMockAnime({
                      title: "部分解析成功的動畫",
                      score: 4.9,
                    }),
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
                        "https://ani.gamer.com.tw/animeList.php?page=3",
                        "",
                        "解析失敗",
                      ),
                      { animeName: "某個結構毀損無法取得標題的番" },
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
        <ServiceProvider scraperService={failingScraperService as any}>
          <Story />
        </ServiceProvider>
      );
    },
  ],
  play: async ({ canvasElement }) => {
    // Click scan
    const scanBtn = canvasElement.querySelector("button");
    if (scanBtn) {
      (scanBtn as HTMLButtonElement).click();
    }
  },
};

export const PartiallyFailedScanExpanded: Story = {
  ...PartiallyFailedScan,
  play: async (context) => {
    // Click scan first
    await PartiallyFailedScan.play?.(context);
    const { canvasElement } = context;

    // Wait for the scanning to complete and show results / errors tab
    const findErrorsTab = () =>
      canvasElement.querySelector('[data-testid="tab-errors"]');
    await new Promise<void>((resolve) => {
      const interval = setInterval(() => {
        const el = findErrorsTab();
        if (el) {
          clearInterval(interval);
          resolve();
        }
      }, 50);
    });

    // Switch to Errors tab
    const errorsTab = findErrorsTab();
    if (errorsTab) {
      (errorsTab as HTMLButtonElement).click();
    }

    // Expand HTTP errors
    const httpHeader = canvasElement.querySelector(
      '[data-testid="http-errors-header"]',
    );
    if (httpHeader) {
      (httpHeader as HTMLDivElement).click();
    }

    // Expand Parser errors
    const parseHeader = canvasElement.querySelector(
      '[data-testid="parse-errors-header"]',
    );
    if (parseHeader) {
      (parseHeader as HTMLDivElement).click();
    }
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
        <App />
      </ServiceProvider>
    );
  },
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
      const slowScraperService = {
        ...mockScraperService,
        scanAllWithPipeline: (): Observable<ScanEvent> => {
          return new Observable((subscriber) => {
            let isCancelled = false;
            const run = async () => {
              await new Promise((resolve) => setTimeout(resolve, 10));
              if (isCancelled) return;
              subscriber.next({
                type: ScanEventType.PAGE_COMPLETED,
                page: 1,
                isSuccess: true,
              });
              subscriber.next({
                type: ScanEventType.PAGE_COMPLETED,
                page: 2,
                isSuccess: true,
              });
              subscriber.next({
                type: ScanEventType.DETAIL_COMPLETED,
                title: "葬送的芙莉蓮",
                isSuccess: true,
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
        <ServiceProvider scraperService={slowScraperService as any}>
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
