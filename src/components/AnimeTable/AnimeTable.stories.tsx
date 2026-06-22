import type { Meta, StoryObj } from "@storybook/react";
import { within } from "@storybook/test";
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
  parameters: {
    chromatic: {
      viewports: [320, 768, 1200],
    },
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

const largeList: AnimeItem[] = Array.from({ length: 40 }, (_, idx) => ({
  link: `https://example.com/anime/${idx + 3}`,
  title: `Anime Title ${idx + 1} with a decently long title for wrapping`,
  watchCount: 10000 + idx * 15000,
  episodeCount: 12 + (idx % 3) * 12,
  uploadDate: new Date(2020 + (idx % 5), idx % 12, 1),
  score: 7.0 + (idx % 25) * 0.1,
  ratingCount: 500 + idx * 250,
  description: `This is a long description text for anime card ${idx + 1} to test the multi-line clamp styling. It should truncate after two lines in mobile and desktop viewports correctly.`,
}));

export const Default: Story = {
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

export const LargeListScrolled: Story = {
  args: {
    ...Default.args,
    list: largeList,
  },
  play: async () => {
    await new Promise((resolve) => setTimeout(resolve, 500));
    if (document.documentElement) {
      document.documentElement.scrollTop = 800;
    }
    if (document.body) {
      document.body.scrollTop = 800;
    }
    window.scrollTo(0, 800);
  },
};

export const HoverHeaderTooltip: Story = {
  args: {
    ...Default.args,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const scoreHeader = await canvas.findByTestId("sort-header-score");
    scoreHeader.classList.add("forceTooltip");
  },
};
