import type { Meta, StoryObj } from "@storybook/react";
import { ErrorPanel } from "./ErrorPanel";
import { ScraperHttpError, ScraperParseError } from "../../errors";
import { ScraperErrorSource } from "../../errors/scraper-error-source";

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
    "https://ani.gamer.com.tw/animeList.php?page=2",
    "Internal Server Error",
    500,
    "測試動畫第一季",
  ),
  new ScraperHttpError(
    "https://ani.gamer.com.tw/animeList.php?page=5",
    "Bad Gateway",
    502,
  ),
];

const sampleParseErrors = [
  new ScraperParseError(
    ScraperErrorSource.TITLE,
    "https://ani.gamer.com.tw/animeList.php?page=3",
    "Missing class theme-name inside theme-list-main anchor card",
    "Anime title missing",
    "測試動畫第二季",
  ),
];

export const CollapsedHttp: Story = {
  args: {
    title: "HTTP Network Errors",
    errors: sampleHttpErrors,
    emptyMessage: "No network errors.",
    defaultOpen: false,
    testIdPrefix: "http-errors",
  },
};

export const ExpandedHttp: Story = {
  args: {
    title: "HTTP Network Errors",
    errors: sampleHttpErrors,
    emptyMessage: "No network errors.",
    defaultOpen: true,
    testIdPrefix: "http-errors",
  },
};

export const CollapsedParse: Story = {
  args: {
    title: "Document Parser Errors",
    errors: sampleParseErrors,
    emptyMessage: "No parser errors.",
    defaultOpen: false,
    testIdPrefix: "parse-errors",
  },
};

export const ExpandedParse: Story = {
  args: {
    title: "Document Parser Errors",
    errors: sampleParseErrors,
    emptyMessage: "No parser errors.",
    defaultOpen: true,
    testIdPrefix: "parse-errors",
  },
};

export const EmptyGroup: Story = {
  args: {
    title: "HTTP Network Errors",
    errors: [],
    emptyMessage: "No network errors.",
    defaultOpen: true,
    testIdPrefix: "http-errors",
  },
};
