import type { Meta, StoryObj } from "@storybook/react";
import { AnimeCard } from "./AnimeCard";
import { Tab } from "../Tabs";
import { type AnimeItem } from "../../services/scraper";

const meta: Meta<typeof AnimeCard> = {
  title: "Components/AnimeCard",
  component: AnimeCard,
  tags: ["autodocs"],
  argTypes: {
    activeTab: {
      control: "select",
      options: [Tab.Search, Tab.Favorites, Tab.Trash],
    },
    onMoveToFavorites: { action: "moveToFavorites" },
    onMoveToTrash: { action: "moveToTrash" },
    onRestoreFromTrash: { action: "restoreFromTrash" },
  },
};

export default meta;
type Story = StoryObj<typeof AnimeCard>;

const baseAnime: AnimeItem = {
  link: "https://example.com/anime/1",
  title: "Frieren: Beyond Journey's End",
  watchCount: 1500000,
  episodeCount: 28,
  uploadDate: new Date("2023-09-29"),
  score: 9.39,
  ratingCount: 120000,
  description:
    "An elf mage and her former party members' journey beyond the end.",
};

export const SearchTab: Story = {
  args: {
    item: baseAnime,
    activeTab: Tab.Search,
  },
};

export const FavoritesTab: Story = {
  args: {
    item: baseAnime,
    activeTab: Tab.Favorites,
  },
};

export const TrashTab: Story = {
  args: {
    item: baseAnime,
    activeTab: Tab.Trash,
  },
};

export const LongText: Story = {
  args: {
    item: {
      ...baseAnime,
      title:
        "This is an extremely long anime title designed to test the layout and text overflow wrapping capabilities of our premium AnimeCard component",
      description:
        "This is an extremely long description designed to test if the card handles large amounts of paragraph text gracefully without overflowing the layout boundaries. It should wrap properly and maintain the visual spacing guidelines.",
    },
    activeTab: Tab.Search,
  },
};

const mockInvalidDate = new Date(NaN);
mockInvalidDate.toISOString = () => "Invalid Date";

export const InvalidDate: Story = {
  args: {
    item: {
      ...baseAnime,
      uploadDate: mockInvalidDate,
    },
    activeTab: Tab.Search,
  },
};
