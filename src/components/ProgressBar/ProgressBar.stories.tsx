import type { Meta, StoryObj } from "@storybook/react";
import { ProgressBar } from "./ProgressBar";

const meta: Meta<typeof ProgressBar> = {
  title: "Components/ProgressBar",
  component: ProgressBar,
  argTypes: {
    stepsCount: { control: "number" },
    currentStepIndex: { control: "number" },
    currentStepPercent: { control: { type: "range", min: 0, max: 100 } },
    message: { control: "text" },
  },
};

export default meta;
type Story = StoryObj<typeof ProgressBar>;

export const Step1Progressing: Story = {
  args: {
    stepsCount: 2,
    currentStepIndex: 0,
    currentStepPercent: 33,
    message: "Loading anime index (22/66)",
  },
};

export const Step1Completed: Story = {
  args: {
    stepsCount: 2,
    currentStepIndex: 0,
    currentStepPercent: 100,
    message: "Loading anime index (66/66)",
  },
};

export const Step2Progressing: Story = {
  args: {
    stepsCount: 2,
    currentStepIndex: 1,
    currentStepPercent: 45,
    message: 'Parsing (45/120) "Frieren: Beyond Journey\'s End"',
  },
};

export const Step2NearCompletion: Story = {
  args: {
    stepsCount: 2,
    currentStepIndex: 1,
    currentStepPercent: 95,
    message: "Saving results to database...",
  },
};
