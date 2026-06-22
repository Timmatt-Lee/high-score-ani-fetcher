import type { Meta, StoryObj } from "@storybook/react";
import { SettingsTab } from "./SettingsTab";

const meta = {
  title: "Components/SettingsTab",
  component: SettingsTab,
  parameters: {
    layout: "fullscreen",
    chromatic: {
      viewports: [320, 768, 1200],
    },
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
      requestDelayMs: 800,
    },
    onSave: (settings) => console.log("Save settings:", settings),
    searchList: [],
    favoriteList: [],
    trashList: [],
    onImportData: (data) => console.log("Import data:", data),
  },
};
