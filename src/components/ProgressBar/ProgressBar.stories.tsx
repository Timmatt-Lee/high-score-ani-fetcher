import type { Meta, StoryObj } from "@storybook/react";
import { ProgressBar } from "./ProgressBar";

const meta: Meta<typeof ProgressBar> = {
  title: "Components/ProgressBar",
  component: ProgressBar,
  argTypes: {
    isScanning: { control: "boolean" },
    percent: { control: { type: "range", min: 0, max: 100 } },
    message: { control: "text" },
  },
};

export default meta;
type Story = StoryObj<typeof ProgressBar>;

export const Initializing: Story = {
  args: {
    isScanning: true,
    percent: 0,
    message: "Initializing scanner...",
  },
};

export const InProgress: Story = {
  args: {
    isScanning: true,
    percent: 45,
    message: "Scanning page 3 of 6 (Frieren: Beyond Journey's End)...",
  },
};

export const NearCompletion: Story = {
  args: {
    isScanning: true,
    percent: 95,
    message: "Saving results to database...",
  },
};

export const CompletedHidden: Story = {
  args: {
    isScanning: false,
    percent: 100,
    message: "Scan complete!",
  },
};
