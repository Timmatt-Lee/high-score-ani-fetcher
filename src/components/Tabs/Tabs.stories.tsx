import type { Meta, StoryObj } from "@storybook/react";
import { Tabs } from "./Tabs";

const meta: Meta<typeof Tabs> = {
  title: "Components/Tabs",
  component: Tabs,
  tags: ["autodocs"],
  argTypes: {
    activeTab: {
      control: "select",
      options: ["search", "favorites", "trash"],
    },
    searchCount: { control: { type: "number", min: 0 } },
    favoritesCount: { control: { type: "number", min: 0 } },
    trashCount: { control: { type: "number", min: 0 } },
    setActiveTab: { action: "setActiveTab" },
  },
};

export default meta;
type Story = StoryObj<typeof Tabs>;

export const SearchActive: Story = {
  args: {
    activeTab: "search",
    searchCount: 15,
    favoritesCount: 3,
    trashCount: 2,
  },
};

export const FavoritesActive: Story = {
  args: {
    activeTab: "favorites",
    searchCount: 15,
    favoritesCount: 3,
    trashCount: 2,
  },
};

export const TrashActive: Story = {
  args: {
    activeTab: "trash",
    searchCount: 15,
    favoritesCount: 3,
    trashCount: 2,
  },
};

export const EmptyCounts: Story = {
  args: {
    activeTab: "search",
    searchCount: 0,
    favoritesCount: 0,
    trashCount: 0,
  },
};
