import type { Meta, StoryObj } from "@storybook/react";
import { ProgressBar } from "./ProgressBar";

const meta: Meta<typeof ProgressBar> = {
  title: "Components/ProgressBar",
  component: ProgressBar,
  argTypes: {
    percent: { control: { type: "range", min: 0, max: 100 } },
    message: { control: "text" },
  },
  parameters: {
    chromatic: {
      viewports: [320, 768, 1200],
    },
  },
};

export default meta;
type Story = StoryObj<typeof ProgressBar>;

export const Initializing: Story = {
  args: {
    percent: 0,
    message: "Initializing scanner...",
  },
};

export const InProgress: Story = {
  args: {
    percent: 45,
    message: "Scanning page 3 of 6 (Frieren: Beyond Journey's End)...",
  },
};

export const NearCompletion: Story = {
  args: {
    percent: 95,
    message: "Saving results to database...",
  },
};
