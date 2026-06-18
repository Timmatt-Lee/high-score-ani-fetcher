import type { Meta, StoryObj } from "@storybook/react";
import { SettingsTab } from "./SettingsTab";

const meta = {
  title: "Components/SettingsTab",
  component: SettingsTab,
  parameters: {
    layout: "centered",
  },
} satisfies Meta<typeof SettingsTab>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    settings: {
      targetScore: 4.8,
      rescanThreshold: 95,
      cacheExpireDays: 14,
    },
    onSave: (settings) => console.log("Save settings:", settings),
  },
};
