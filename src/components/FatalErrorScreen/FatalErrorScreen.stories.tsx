import type { Meta, StoryObj } from "@storybook/react";
import { FatalErrorScreen } from "./FatalErrorScreen";
import {
  ScraperHttpError,
  ScraperParseError,
  ScraperErrorSource,
  ScraperUnknownError,
} from "../../errors";

const meta: Meta<typeof FatalErrorScreen> = {
  title: "Components/FatalErrorScreen",
  component: FatalErrorScreen,
  decorators: [
    (Story) => (
      <div style={{ maxWidth: "450px", width: "100%" }}>
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof FatalErrorScreen>;

export const HttpError: Story = {
  args: {
    fatalError: new ScraperHttpError(
      "https://ani.gamer.com.tw/animeList.php?page=1",
      "HTTP 500 Internal Server Error",
      500,
    ),
    onDismiss: () => alert("Dismiss clicked"),
  },
};

export const ParseError: Story = {
  args: {
    fatalError: new ScraperParseError(
      ScraperErrorSource.PAGINATION,
      "https://ani.gamer.com.tw/animeList.php?page=1",
      "Invalid HTML document structure",
      "Pagination element not found",
    ),
    onDismiss: () => alert("Dismiss clicked"),
  },
};

export const UnknownError: Story = {
  args: {
    fatalError: new ScraperUnknownError(
      new Error("An unexpected system exception occurred"),
    ),
    onDismiss: () => alert("Dismiss clicked"),
  },
};
