import type { Meta, StoryObj } from "@storybook/react";
import { within } from "@storybook/test";
import { Tabs, Tab } from "./Tabs";

const meta: Meta<typeof Tabs> = {
  title: "Components/Tabs",
  component: Tabs,
  argTypes: {
    activeTab: {
      control: "select",
      options: [Tab.Search, Tab.Favorites, Tab.Trash],
    },
    searchCount: { control: { type: "number", min: 0 } },
    favoritesCount: { control: { type: "number", min: 0 } },
    trashCount: { control: { type: "number", min: 0 } },
    setActiveTab: { action: "setActiveTab" },
  },
  parameters: {
    chromatic: {
      viewports: [320, 768, 1200],
    },
  },
};

export default meta;
type Story = StoryObj<typeof Tabs>;

export const SearchActive: Story = {
  args: {
    activeTab: Tab.Search,
    searchCount: 15,
    favoritesCount: 3,
    trashCount: 2,
  },
};

export const FavoritesActive: Story = {
  args: {
    activeTab: Tab.Favorites,
    searchCount: 15,
    favoritesCount: 3,
    trashCount: 2,
  },
};

export const TrashActive: Story = {
  args: {
    activeTab: Tab.Trash,
    searchCount: 15,
    favoritesCount: 3,
    trashCount: 2,
  },
};

export const EmptyCounts: Story = {
  args: {
    activeTab: Tab.Search,
    searchCount: 0,
    favoritesCount: 0,
    trashCount: 0,
  },
};

export const ResultsHoverTooltip: Story = {
  args: {
    activeTab: Tab.Search,
    searchCount: 15,
    favoritesCount: 3,
    trashCount: 2,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const resultsButton = canvas.getByText(/Results/);
    resultsButton.classList.add("forceTooltip");
  },
};
