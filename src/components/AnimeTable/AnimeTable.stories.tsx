import type { Meta, StoryObj } from "@storybook/react";
import { AnimeTable } from "./AnimeTable";
import { Tab } from "../Tabs";
import { type AnimeItem } from "../../services/animeScanner";

const meta: Meta<typeof AnimeTable> = {
  title: "Components/AnimeTable",
  component: AnimeTable,
  argTypes: {
    activeTab: {
      control: "select",
      options: [Tab.Search, Tab.Favorites, Tab.Trash],
    },
    onMoveToFavorites: { action: "moveToFavorites" },
    onMoveToTrash: { action: "moveToTrash" },
    onRestoreFromTrash: { action: "restoreFromTrash" },
    onSort: { action: "sort" },
  },
};

export default meta;
type Story = StoryObj<typeof AnimeTable>;

const sampleList: AnimeItem[] = [
  {
    link: "https://example.com/anime/1",
    title: "Frieren: Beyond Journey's End",
    watchCount: 1500000,
    episodeCount: 28,
    uploadDate: new Date("2023-09-29"),
    score: 9.39,
    ratingCount: 120000,
    description:
      "An elf mage and her former party members' journey beyond the end.",
  },
  {
    link: "https://example.com/anime/2",
    title: "Fullmetal Alchemist: Brotherhood",
    watchCount: 3000000,
    episodeCount: 64,
    uploadDate: new Date("2009-04-05"),
    score: 9.1,
    ratingCount: 250000,
    description:
      "Two brothers search for the Philosopher's Stone after a failed alchemy attempt.",
  },
];

export const DesktopView: Story = {
  args: {
    activeTab: Tab.Search,
    list: sampleList,
    sortBy: "score",
    sortOrder: "desc",
    onSort: () => {},
    onMoveToFavorites: () => {},
    onMoveToTrash: () => {},
    onRestoreFromTrash: () => {},
    targetScore: 4.8,
  },
};

export const MobileView: Story = {
  args: {
    ...DesktopView.args,
  },
  parameters: {
    viewport: {
      defaultViewport: "mobile1",
    },
    chromatic: {
      viewports: [320, 375],
    },
  },
};
