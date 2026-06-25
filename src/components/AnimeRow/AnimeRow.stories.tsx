import type { Meta, StoryObj } from "@storybook/react";
import { AnimeRow } from "./AnimeRow";
import { Tab } from "../Tabs";
import { type AnimeItem } from "../../services/animeScanner";

const meta: Meta<typeof AnimeRow> = {
  title: "Components/AnimeRow",
  component: AnimeRow,
  decorators: [
    (Story) => (
      <div
        style={{
          width: "100%",
          overflowX: "auto",
          background: "var(--bg-color)",
          padding: "10px",
          boxSizing: "border-box",
        }}
      >
        <div
          style={{
            background: "#1e293b",
            border: "1px solid #334155",
            borderRadius: "12px",
            overflow: "visible",
            fontFamily: "Inter, sans-serif",
            color: "#f8fafc",
            display: "flex",
            flexDirection: "column",
            width: "100%",
          }}
        >
          <Story />
        </div>
      </div>
    ),
  ],
  argTypes: {
    activeTab: {
      control: "select",
      options: [Tab.Search, Tab.Favorites, Tab.Trash],
    },
    onMoveToFavorites: { action: "moveToFavorites" },
    onMoveToTrash: { action: "moveToTrash" },
    onRestoreFromTrash: { action: "restoreFromTrash" },
  },
  parameters: {
    chromatic: {
      viewports: [320, 768, 1200],
    },
  },
};

export default meta;
type Story = StoryObj<typeof AnimeRow>;

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

// Favorites tab shows a single Trash action button
export const FavoritesTab: Story = {
  args: {
    item: baseAnime,
    activeTab: Tab.Favorites,
  },
};

// Trash tab shows the Restore action button
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
        "This is an extremely long anime title designed to test the layout and text overflow wrapping capabilities of our premium AnimeRow component",
      description:
        "This is an extremely long description designed to test if the row handles large amounts of paragraph text gracefully without overflowing the layout boundaries. It should wrap properly and maintain the visual spacing guidelines.",
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

export const Disabled: Story = {
  args: {
    item: baseAnime,
    activeTab: Tab.Search,
    isDisabled: true,
  },
};
