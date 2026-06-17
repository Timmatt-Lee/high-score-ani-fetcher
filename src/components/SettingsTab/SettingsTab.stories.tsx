import type { Meta, StoryObj } from "@storybook/react";
import { SettingsTab } from "./SettingsTab";
import { DEFAULT_SETTINGS } from "../../types/settings";

const meta = {
  title: "Components/SettingsTab",
  component: SettingsTab,
  parameters: {
    layout: "fullscreen",
  },
} satisfies Meta<typeof SettingsTab>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    settings: DEFAULT_SETTINGS,
    onSaveSettings: (settings) => console.log("Saved", settings),
  },
};
