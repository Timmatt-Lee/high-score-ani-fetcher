import type { Meta, StoryObj } from "@storybook/react";
import { AnimeList } from "./AnimeList";
import { type AnimeItem } from "../../types/anime";

const meta: Meta<typeof AnimeList> = {
  title: "Components/AnimeList",
  component: AnimeList,
  tags: ["autodocs"],
  argTypes: {
    activeTab: {
      control: "select",
      options: ["search", "favorites", "trash"],
    },
    onMoveToFavorites: { action: "moveToFavorites" },
    onMoveToTrash: { action: "moveToTrash" },
    onRestoreFromTrash: { action: "restoreFromTrash" },
  },
};

export default meta;
type Story = StoryObj<typeof AnimeList>;

const sampleSearchList: AnimeItem[] = [
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

const sampleFavoritesList: AnimeItem[] = [
  {
    link: "https://example.com/anime/3",
    title: "Steins;Gate",
    watchCount: 2000000,
    episodeCount: 24,
    uploadDate: new Date("2011-04-06"),
    score: 9.07,
    ratingCount: 180000,
    description:
      "A self-proclaimed mad scientist invents a phone microwave that can send emails to the past.",
  },
];

const sampleTrashList: AnimeItem[] = [
  {
    link: "https://example.com/anime/4",
    title: "Bad Anime Show",
    watchCount: 500,
    episodeCount: 12,
    uploadDate: new Date("2020-01-01"),
    score: 2.1,
    ratingCount: 100,
    description:
      "A poorly animated and written show that belongs in the trash.",
  },
];

export const SearchTabWithItems: Story = {
  args: {
    activeTab: "search",
    searchList: sampleSearchList,
    favorites: sampleFavoritesList,
    trash: sampleTrashList,
  },
};

export const FavoritesTabWithItems: Story = {
  args: {
    activeTab: "favorites",
    searchList: sampleSearchList,
    favorites: sampleFavoritesList,
    trash: sampleTrashList,
  },
};

export const TrashTabWithItems: Story = {
  args: {
    activeTab: "trash",
    searchList: sampleSearchList,
    favorites: sampleFavoritesList,
    trash: sampleTrashList,
  },
};

export const EmptySearchState: Story = {
  args: {
    activeTab: "search",
    searchList: [],
    favorites: sampleFavoritesList,
    trash: sampleTrashList,
  },
};

export const EmptyFavoritesState: Story = {
  args: {
    activeTab: "favorites",
    searchList: sampleSearchList,
    favorites: [],
    trash: sampleTrashList,
  },
};
