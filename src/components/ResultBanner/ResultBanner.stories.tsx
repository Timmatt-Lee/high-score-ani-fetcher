import type { Meta, StoryObj } from "@storybook/react";
import { ResultBanner } from "./ResultBanner";

const meta: Meta<typeof ResultBanner> = {
  title: "Components/ResultBanner",
  component: ResultBanner,
  decorators: [
    (Story) => (
      <div
        style={{
          padding: "40px",
          background: "#121212",
          display: "inline-block",
        }}
      >
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof ResultBanner>;

export const ScannedWithResults: Story = {
  args: {
    successCount: 15,
    addedCount: 10,
    refetchedCount: 5,
    skippedCachedCount: 20,
    failedCount: 0,
  },
};

export const ScannedWithErrors: Story = {
  args: {
    successCount: 3,
    addedCount: 2,
    refetchedCount: 1,
    skippedCachedCount: 5,
    failedCount: 1,
  },
};
