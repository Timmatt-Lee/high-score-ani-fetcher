import type { Meta, StoryObj } from "@storybook/react";
import { ErrorCard } from "./ErrorCard";
import {
  ScraperHttpError,
  ScraperParseError,
  ScraperUnknownError,
} from "../../errors";
import { ScraperErrorSource } from "../../errors/scraper-error-source";

const meta: Meta<typeof ErrorCard> = {
  title: "Components/ErrorCard",
  component: ErrorCard,
  decorators: [
    (Story) => (
      <div
        style={{
          maxWidth: "450px",
          width: "100%",
          padding: "20px",
          background: "#121212",
        }}
      >
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof ErrorCard>;

export const HttpErrorWithTitle: Story = {
  args: {
    error: Object.assign(
      new ScraperHttpError(
        "https://ani.gamer.com.tw/animeList.php?page=2",
        "Internal Server Error",
        500,
      ),
      { title: "葬送的芙莉蓮" },
    ),
  },
};

export const HttpErrorNoTitle: Story = {
  args: {
    error: new ScraperHttpError(
      "https://ani.gamer.com.tw/animeList.php?page=4",
      "Bad Gateway",
      502,
    ),
  },
};

export const ParseErrorWithTitle: Story = {
  args: {
    error: Object.assign(
      new ScraperParseError(
        ScraperErrorSource.TITLE,
        "https://ani.gamer.com.tw/animeList.php?page=3",
        "Failed to parse title tag",
        "Parser failed",
      ),
      { title: "鬼滅之刃 柱訓練篇" },
    ),
  },
};

export const ParseErrorNoTitle: Story = {
  args: {
    error: new ScraperParseError(
      ScraperErrorSource.EPISODE_COUNT,
      "https://ani.gamer.com.tw/animeList.php?page=5",
      "Failed to parse episode number",
      "Parser failed",
    ),
  },
};

export const FatalUnknownError: Story = {
  args: {
    error: new ScraperUnknownError(new Error("Connection reset by peer")),
    onDismiss: () => console.log("Dismissed"),
  },
};
