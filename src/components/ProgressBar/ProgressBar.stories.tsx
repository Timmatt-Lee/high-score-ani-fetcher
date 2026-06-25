import type { Meta, StoryObj } from "@storybook/react";
import { ProgressBar } from "./ProgressBar";

const meta: Meta<typeof ProgressBar> = {
  title: "Components/ProgressBar",
  component: ProgressBar,
  argTypes: {
    percent: { control: { type: "range", min: 0, max: 100 } },
    message: { control: "text" },
  },
};

export default meta;
type Story = StoryObj<typeof ProgressBar>;

export const Step1Shimmer: Story = {
  args: {
    percent: 0,
    message: "Getting total pages...",
  },
};

export const Step1Progressing: Story = {
  args: {
    percent: 0,
    message: "Loading anime index (22/66)",
  },
};

export const Step1Completed: Story = {
  args: {
    percent: 0,
    message: "Loading anime index (66/66)",
  },
};

export const Step2Progressing: Story = {
  args: {
    percent: 45,
    message: 'Parsing (45/120) "Frieren: Beyond Journey\'s End"',
  },
};

export const Step2NearCompletion: Story = {
  args: {
    percent: 95,
    message: "Saving results to database...",
  },
};

export const Step2Completed: Story = {
  args: {
    percent: 100,
    message: "Scan completed",
  },
};
