import type { Meta, StoryObj } from "@storybook/react";
import { ErrorsPanel } from "./ErrorsPanel";
import { ScraperHttpError, ScraperParseError } from "../../errors";
import { ScraperErrorSource } from "../../errors/scraper-error-source";
import { type AnimeItem } from "../../types/anime";

const meta: Meta<typeof ErrorsPanel> = {
  title: "Components/ErrorsPanel",
  component: ErrorsPanel,
  decorators: [
    (Story) => (
      <div
        style={{
          width: "600px",
          border: "1px solid #333",
          background: "#1e1e1e",
          padding: "20px",
          borderRadius: "8px",
        }}
      >
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof ErrorsPanel>;

const sampleHttpErrors = [
  Object.assign(
    new ScraperHttpError(
      "https://ani.gamer.com.tw/animeList.php?page=2",
      "Internal Server Error",
      500,
    ),
    { title: "測試動畫第一季" },
  ),
  new ScraperHttpError(
    "https://ani.gamer.com.tw/animeList.php?page=5",
    "Bad Gateway",
    502,
  ),
];

const sampleParseErrors = [
  Object.assign(
    new ScraperParseError(
      ScraperErrorSource.TITLE,
      "https://ani.gamer.com.tw/animeList.php?page=3",
      "Missing class theme-name inside theme-list-main anchor card",
      "Anime title missing",
    ),
    { title: "測試動畫第二季" },
  ),
];

const sampleFailedDetails: AnimeItem[] = [
  {
    link: "https://ani.gamer.com.tw/anime.php?sn=12345",
    title: "測試動畫第一季",
    watchCount: 50000,
    episodeCount: 12,
    uploadDate: new Date("2024-01-01"),
    score: 0,
    ratingCount: 0,
    description: "",
  },
];

export const AllErrors: Story = {
  args: {
    httpErrors: sampleHttpErrors,
    parseErrors: sampleParseErrors,
    failedDetails: sampleFailedDetails,
    isScanning: false,
    onRetry: (options) =>
      console.log("Retry callback triggered with options:", options),
  },
};

export const HttpErrorsOnly: Story = {
  args: {
    httpErrors: sampleHttpErrors,
    parseErrors: [],
    failedDetails: [],
    isScanning: false,
    onRetry: (options) =>
      console.log("Retry callback triggered with options:", options),
  },
};

export const ParseErrorsOnly: Story = {
  args: {
    httpErrors: [],
    parseErrors: sampleParseErrors,
    failedDetails: [],
    isScanning: false,
    onRetry: (options) =>
      console.log("Retry callback triggered with options:", options),
  },
};

export const FailedDetailsOnly: Story = {
  args: {
    httpErrors: [],
    parseErrors: [],
    failedDetails: sampleFailedDetails,
    isScanning: false,
    onRetry: (options) =>
      console.log("Retry callback triggered with options:", options),
  },
};

export const RetryingState: Story = {
  args: {
    httpErrors: sampleHttpErrors,
    parseErrors: sampleParseErrors,
    failedDetails: sampleFailedDetails,
    isScanning: true,
    onRetry: (options) =>
      console.log("Retry callback triggered with options:", options),
  },
};

export const EmptyErrors: Story = {
  args: {
    httpErrors: [],
    parseErrors: [],
    failedDetails: [],
    isScanning: false,
    onRetry: (options) =>
      console.log("Retry callback triggered with options:", options),
  },
};
