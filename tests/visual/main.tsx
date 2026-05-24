import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { AnimeCard } from "../../src/components/AnimeCard";
import { ProgressBar } from "../../src/components/ProgressBar";
import { Tabs } from "../../src/components/Tabs";
import { AnimeList } from "../../src/components/AnimeList";
import { type AnimeItem } from "../../src/types/anime";
import "../../src/index.css";

const mockItem1: AnimeItem = {
  link: "https://ani.gamer.com.tw/animeVideo.php?sn=123",
  title: "Test Anime (Normal)",
  watchCount: 25000,
  episodeCount: 12,
  uploadDate: new Date("2026-01-01T00:00:00Z"),
  score: 8.5,
  ratingCount: 1234,
  description:
    "This is a great test anime with a standard layout and a normal description length.",
};

const mockItem2: AnimeItem = {
  link: "https://ani.gamer.com.tw/animeVideo.php?sn=456",
  title:
    "Test Anime with an Extremely Long Title that Should Wrap Correctly on Multiple Lines in the Card Component Layout",
  watchCount: 120000,
  episodeCount: 24,
  uploadDate: new Date("2025-01-01T00:00:00Z"),
  score: 9.2,
  ratingCount: 5678,
  description:
    "This anime has a very long title and high scores to test how the card behaves under stress.",
};

export function TestContainer({ children }: { children: React.ReactNode }) {
  return (
    <div
      id="playground-root"
      style={{
        padding: "20px",
        background: "#121212",
        color: "#ffffff",
        minHeight: "100vh",
        display: "inline-block",
        boxSizing: "border-box",
        fontFamily: "Inter, sans-serif",
      }}
    >
      {children}
    </div>
  );
}

export function RenderComponent() {
  const params = new URLSearchParams(window.location.search);
  const component = params.get("component");
  const state = params.get("state") || "search";
  const percent = parseInt(params.get("percent") || "0", 10);
  const message = params.get("message") || "";
  const searchCount = parseInt(params.get("searchCount") || "0", 10);
  const favoritesCount = parseInt(params.get("favoritesCount") || "0", 10);
  const trashCount = parseInt(params.get("trashCount") || "0", 10);

  if (component === "AnimeCard") {
    const item = state === "long-title" ? mockItem2 : mockItem1;
    const cardState =
      state === "long-title"
        ? "search"
        : (state as "search" | "favorites" | "trash");
    return (
      <TestContainer>
        <div style={{ width: "360px" }}>
          <AnimeCard
            item={item}
            activeTab={cardState}
            onMoveToFavorites={() => {}}
            onMoveToTrash={() => {}}
            onRestoreFromTrash={() => {}}
          />
        </div>
      </TestContainer>
    );
  }

  if (component === "ProgressBar") {
    const isScanning = params.get("isScanning") !== "false";
    return (
      <TestContainer>
        <div style={{ width: "400px" }}>
          <ProgressBar
            isScanning={isScanning}
            percent={percent}
            message={message}
          />
        </div>
      </TestContainer>
    );
  }

  if (component === "Tabs") {
    const activeTabType = state as "search" | "favorites" | "trash";
    return (
      <TestContainer>
        <div style={{ width: "400px" }}>
          <Tabs
            activeTab={activeTabType}
            setActiveTab={() => {}}
            searchCount={searchCount}
            favoritesCount={favoritesCount}
            trashCount={trashCount}
          />
        </div>
      </TestContainer>
    );
  }

  if (component === "AnimeList") {
    const activeTabType = state as "search" | "favorites" | "trash";
    const isListEmpty = params.get("isListEmpty") === "true";
    const searchList = isListEmpty ? [] : [mockItem1, mockItem2];
    const favorites = isListEmpty ? [] : [mockItem1];
    const trash = isListEmpty ? [] : [mockItem2];

    return (
      <TestContainer>
        <div
          style={{
            width: "360px",
            maxHeight: "400px",
            overflowY: "auto",
            border: "1px solid #222",
          }}
        >
          <AnimeList
            activeTab={activeTabType}
            searchList={searchList}
            favorites={favorites}
            trash={trash}
            onMoveToFavorites={() => {}}
            onMoveToTrash={() => {}}
            onRestoreFromTrash={() => {}}
          />
        </div>
      </TestContainer>
    );
  }

  return (
    <TestContainer>
      <div style={{ color: "red" }}>Unknown component or state parameter!</div>
    </TestContainer>
  );
}

const container = document.getElementById("root")!;
createRoot(container).render(
  <StrictMode>
    <RenderComponent />
  </StrictMode>,
);
