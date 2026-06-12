import type { Meta, StoryObj } from "@storybook/react";
import { ErrorPanel } from "./ErrorPanel";
import {
  AnimeScanHttpError,
  AnimeScanParseError,
  AnimeScanStep,
} from "../../services/animeScanner";

const meta: Meta<typeof ErrorPanel> = {
  title: "Components/ErrorPanel",
  component: ErrorPanel,
  decorators: [(Story) => <Story />],
};

export default meta;
type Story = StoryObj<typeof ErrorPanel>;

const sampleHttpErrors = [
  new AnimeScanHttpError(
    2,
    AnimeScanStep.GET_TOTAL_PAGES,
    "https://ani.gamer.com.tw/animeList.php?page=2",
    "Internal Server Error",
    500,
    "測試動畫第一季",
  ),
  new AnimeScanHttpError(
    5,
    AnimeScanStep.GET_TOTAL_PAGES,
    "https://ani.gamer.com.tw/animeList.php?page=5",
    "Bad Gateway",
    502,
    undefined,
  ),
];

const sampleParseErrors = [
  new AnimeScanParseError(
    3,
    AnimeScanStep.PARSE_ANIME_INFO,
    "https://ani.gamer.com.tw/animeList.php?page=3",
    "Missing class theme-name inside theme-list-main anchor card",
    "Anime title missing",
    "測試動畫第二季",
  ),
];

export const CollapsedHttp: Story = {
  args: {
    title: "HTTP Network Errors",
    testIdPrefix: "http-errors",
    emptyMessage: "No network errors.",
    errors: sampleHttpErrors,
    isExpandedByDefault: false,
  },
};

export const ExpandedHttp: Story = {
  args: {
    title: "HTTP Network Errors",
    testIdPrefix: "http-errors",
    emptyMessage: "No network errors.",
    errors: sampleHttpErrors,
    isExpandedByDefault: true,
  },
};

export const CollapsedParse: Story = {
  args: {
    title: "Document Parser Errors",
    testIdPrefix: "parse-errors",
    emptyMessage: "No parser errors.",
    errors: sampleParseErrors,
    isExpandedByDefault: false,
  },
};

export const ExpandedParse: Story = {
  args: {
    title: "Document Parser Errors",
    testIdPrefix: "parse-errors",
    emptyMessage: "No parser errors.",
    errors: sampleParseErrors,
    isExpandedByDefault: true,
  },
};

export const EmptyGroup: Story = {
  args: {
    title: "HTTP Network Errors",
    testIdPrefix: "http-errors",
    emptyMessage: "No network errors.",
    errors: [],
    isExpandedByDefault: true,
  },
};
