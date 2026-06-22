import type { Meta, StoryObj } from "@storybook/react";
import { within } from "@storybook/test";
import { ErrorCard } from "./ErrorCard";
import {
  AnimeScanHttpError,
  AnimeScanParseError,
  AnimeScanStep,
} from "../../services/animeScanner";

const meta: Meta<typeof ErrorCard> = {
  title: "Components/ErrorCard",
  component: ErrorCard,
  parameters: {
    chromatic: {
      viewports: [320, 768, 1200],
    },
  },
};

export default meta;
type Story = StoryObj<typeof ErrorCard>;

export const HttpErrorWithTitle: Story = {
  args: {
    error: new AnimeScanHttpError(
      2,
      AnimeScanStep.GET_TOTAL_PAGES,
      "https://ani.gamer.com.tw/animeList.php?page=2",
      "Internal Server Error",
      500,
      "葬送的芙莉蓮",
    ),
  },
};

export const HttpErrorNoTitle: Story = {
  args: {
    error: new AnimeScanHttpError(
      4,
      AnimeScanStep.GET_TOTAL_PAGES,
      "https://ani.gamer.com.tw/animeList.php?page=4",
      "Bad Gateway",
      502,
      undefined,
    ),
  },
};

export const ParseErrorWithTitle: Story = {
  args: {
    error: new AnimeScanParseError(
      3,
      AnimeScanStep.PARSE_ANIME_INFO,
      "https://ani.gamer.com.tw/animeList.php?page=3",
      "Failed to parse title tag",
      "Parser failed",
      "鬼滅之刃 柱訓練篇",
    ),
  },
};

export const ParseErrorNoTitle: Story = {
  args: {
    error: new AnimeScanParseError(
      5,
      AnimeScanStep.PARSE_ANIME_DETAIL,
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
    error: new AnimeScanHttpError(
      2,
      AnimeScanStep.GET_TOTAL_PAGES,
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

export const HoverCopyTooltip: Story = {
  args: {
    error: new Error("Test error"),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const copyBtn = await canvas.findByTestId("error-card-copy-btn");
    copyBtn.classList.add("forceTooltip");
  },
};

export const HoverDismissTooltip: Story = {
  args: {
    error: new Error("Test error"),
    onDismiss: () => {},
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const dismissBtn = await canvas.findByTestId("error-card-dismiss-btn");
    dismissBtn.classList.add("forceTooltip");
  },
};
