import type { Meta, StoryObj } from "@storybook/react";
import { ErrorCard } from "./ErrorCard";
import {
  ScraperHttpError,
  ScraperParseError,
  ScraperUnknownError,
  ScraperScanStep,
} from "../../services/scraper";

const meta: Meta<typeof ErrorCard> = {
  title: "Components/ErrorCard",
  component: ErrorCard,
};

export default meta;
type Story = StoryObj<typeof ErrorCard>;

export const HttpErrorWithTitle: Story = {
  args: {
    error: new ScraperHttpError(
      2,
      ScraperScanStep.PAGINATION,
      "https://ani.gamer.com.tw/animeList.php?page=2",
      "Internal Server Error",
      500,
      "葬送的芙莉蓮",
    ),
  },
};

export const HttpErrorNoTitle: Story = {
  args: {
    error: new ScraperHttpError(
      4,
      ScraperScanStep.PAGINATION,
      "https://ani.gamer.com.tw/animeList.php?page=4",
      "Bad Gateway",
      502,
      undefined,
    ),
  },
};

export const ParseErrorWithTitle: Story = {
  args: {
    error: new ScraperParseError(
      3,
      ScraperScanStep.TITLE,
      "https://ani.gamer.com.tw/animeList.php?page=3",
      "Failed to parse title tag",
      "Parser failed",
      "鬼滅之刃 柱訓練篇",
    ),
  },
};

export const ParseErrorNoTitle: Story = {
  args: {
    error: new ScraperParseError(
      5,
      ScraperScanStep.EPISODE_COUNT,
      "https://ani.gamer.com.tw/animeList.php?page=5",
      "Failed to parse episode number",
      "Parser failed",
    ),
  },
};

export const FatalUnknownError: Story = {
  args: {
    error: new ScraperUnknownError(
      new Error("Connection reset by peer"),
      1,
      ScraperScanStep.PAGINATION,
      "unknown",
      undefined,
    ),
  },
};

export const WithCopiedState: Story = {
  args: {
    error: new ScraperHttpError(
      2,
      ScraperScanStep.PAGINATION,
      "https://ani.gamer.com.tw/animeList.php?page=2",
      "Internal Server Error",
      500,
      "葬送的芙莉蓮",
    ),
  },
  play: async ({ canvasElement }) => {
    const copyBtn = canvasElement.querySelector(
      '[data-testid="error-card-copy-btn"]',
    );
    if (copyBtn) {
      (copyBtn as HTMLButtonElement).click();
    }
  },
};
