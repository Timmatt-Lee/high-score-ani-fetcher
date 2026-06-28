import type { Meta, StoryObj } from "@storybook/react";
import { ResultBanner } from "./ResultBanner";

const meta: Meta<typeof ResultBanner> = {
  title: "Components/ResultBanner",
  component: ResultBanner,
};

export default meta;
type Story = StoryObj<typeof ResultBanner>;

const baseArgs = {
  successCount: 15,
  addedCount: 10,
  updatedCount: 5,
  skippedCachedCount: 20,
  failedCount: 1,
};

export const ScannedWithResults: Story = {
  args: {
    ...baseArgs,
    failedCount: 0,
  },
};

export const ScannedWithErrors: Story = {
  args: {
    ...baseArgs,
  },
};

export const SuccessHoverExpand: Story = {
  args: {
    ...baseArgs,
  },
  play: async ({ canvasElement }) => {
    const { within, userEvent } = await import("@storybook/test");
    const canvas = within(canvasElement);
    const chip = canvas.getByTestId("chip-success");
    await userEvent.hover(chip);
  },
};

export const AddedHoverExpand: Story = {
  args: {
    ...baseArgs,
  },
  play: async ({ canvasElement }) => {
    const { within, userEvent } = await import("@storybook/test");
    const canvas = within(canvasElement);
    const chip = canvas.getByTestId("chip-added");
    await userEvent.hover(chip);
  },
};

export const UpdatedHoverExpand: Story = {
  args: {
    ...baseArgs,
  },
  play: async ({ canvasElement }) => {
    const { within, userEvent } = await import("@storybook/test");
    const canvas = within(canvasElement);
    const chip = canvas.getByTestId("chip-updated");
    await userEvent.hover(chip);
  },
};

export const SkipHoverExpand: Story = {
  args: {
    ...baseArgs,
  },
  play: async ({ canvasElement }) => {
    const { within, userEvent } = await import("@storybook/test");
    const canvas = within(canvasElement);
    const chip = canvas.getByTestId("chip-skip");
    await userEvent.hover(chip);
  },
};

export const FailHoverExpand: Story = {
  args: {
    ...baseArgs,
  },
  play: async ({ canvasElement }) => {
    const { within, userEvent } = await import("@storybook/test");
    const canvas = within(canvasElement);
    const chip = canvas.getByTestId("chip-fail");
    await userEvent.hover(chip);
  },
};
