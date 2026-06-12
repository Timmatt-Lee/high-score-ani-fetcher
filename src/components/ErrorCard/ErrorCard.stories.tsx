import type { Meta, StoryObj } from "@storybook/react";
import { ErrorCard } from "./ErrorCard";
import {
  ScraperHttpError,
  ScraperParseError,
  ScraperScanStep,
} from "../../services/scraper";

const meta: Meta<typeof ErrorCard> = {
  title: "Components/ErrorCard",
  component: ErrorCard,
  parameters: {
    layout: "fullscreen",
  },
};

export default meta;
type Story = StoryObj<typeof ErrorCard>;

export const HttpErrorWithTitle: Story = {
  args: {
    error: new ScraperHttpError(
      2,
      ScraperScanStep.GET_TOTAL_PAGES,
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
      ScraperScanStep.GET_TOTAL_PAGES,
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
      ScraperScanStep.PARSE_ANIME_INFO,
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
      ScraperScanStep.PARSE_ANIME_DETAIL,
      "https://ani.gamer.com.tw/animeList.php?page=5",
      "Failed to parse episode number",
      "Parser failed",
    ),
  },
};

export const FatalUnknownError: Story = {
  args: {
    error: new Error("Connection reset by peer"),
  },
};

export const WithCopiedState: Story = {
  args: {
    error: new ScraperHttpError(
      2,
      ScraperScanStep.GET_TOTAL_PAGES,
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
