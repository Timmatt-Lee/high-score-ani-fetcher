import type { Meta, StoryObj } from "@storybook/react";
import { ErrorPanel } from "./ErrorPanel";
import {
  ScraperHttpError,
  ScraperParseError,
  ScraperScanStep,
} from "../../services/scraper";

const meta: Meta<typeof ErrorPanel> = {
  title: "Components/ErrorPanel",
  component: ErrorPanel,
  decorators: [
    (Story) => (
      <div
        style={{
          maxWidth: "600px",
          width: "100%",
          background: "#121212",
          padding: "20px",
        }}
      >
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof ErrorPanel>;

const sampleHttpErrors = [
  new ScraperHttpError(
    2,
    ScraperScanStep.PAGINATION,
    "https://ani.gamer.com.tw/animeList.php?page=2",
    "Internal Server Error",
    500,
    "測試動畫第一季",
  ),
  new ScraperHttpError(
    5,
    ScraperScanStep.PAGINATION,
    "https://ani.gamer.com.tw/animeList.php?page=5",
    "Bad Gateway",
    502,
    undefined,
  ),
];

const sampleParseErrors = [
  new ScraperParseError(
    3,
    ScraperScanStep.TITLE,
    "https://ani.gamer.com.tw/animeList.php?page=3",
    "Missing class theme-name inside theme-list-main anchor card",
    "Anime title missing",
    "測試動畫第二季",
  ),
];

export const CollapsedHttp: Story = {
  args: {
    errorClass: ScraperHttpError,
    errors: sampleHttpErrors,
    isExpandedByDefault: false,
  },
};

export const ExpandedHttp: Story = {
  args: {
    errorClass: ScraperHttpError,
    errors: sampleHttpErrors,
    isExpandedByDefault: true,
  },
};

export const CollapsedParse: Story = {
  args: {
    errorClass: ScraperParseError,
    errors: sampleParseErrors,
    isExpandedByDefault: false,
  },
};

export const ExpandedParse: Story = {
  args: {
    errorClass: ScraperParseError,
    errors: sampleParseErrors,
    isExpandedByDefault: true,
  },
};

export const EmptyGroup: Story = {
  args: {
    errorClass: ScraperHttpError,
    errors: [],
    isExpandedByDefault: true,
  },
};
