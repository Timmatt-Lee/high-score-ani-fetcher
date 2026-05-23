import { AnimeCard } from "./AnimeCard";
import { ProgressBar } from "./ProgressBar";
import { Tabs } from "./Tabs";
import { AnimeList } from "./AnimeList";
import { type AnimeItem } from "../types/anime";

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

export function ComponentPlayground({ name }: { name: string }) {
  return (
    <div
      id="playground-root"
      style={{
        padding: "20px",
        background: "#121212",
        color: "#ffffff",
        minHeight: "100vh",
        fontFamily: "Inter, sans-serif",
      }}
    >
      <h2 style={{ marginBottom: "20px", color: "#4fc3f7" }}>
        Component Playground: {name}
      </h2>

      {name === "AnimeCard" && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "20px",
            maxWidth: "360px",
          }}
        >
          <div>
            <h3>Search Tab State (Standard Score)</h3>
            <AnimeCard
              item={mockItem1}
              activeTab="search"
              onMoveToFavorites={() => {}}
              onMoveToTrash={() => {}}
              onRestoreFromTrash={() => {}}
            />
          </div>

          <div>
            <h3>Favorites Tab State</h3>
            <AnimeCard
              item={mockItem1}
              activeTab="favorites"
              onMoveToFavorites={() => {}}
              onMoveToTrash={() => {}}
              onRestoreFromTrash={() => {}}
            />
          </div>

          <div>
            <h3>Trash Tab State</h3>
            <AnimeCard
              item={mockItem1}
              activeTab="trash"
              onMoveToFavorites={() => {}}
              onMoveToTrash={() => {}}
              onRestoreFromTrash={() => {}}
            />
          </div>

          <div>
            <h3>Long Title Wrapping Test</h3>
            <AnimeCard
              item={mockItem2}
              activeTab="search"
              onMoveToFavorites={() => {}}
              onMoveToTrash={() => {}}
              onRestoreFromTrash={() => {}}
            />
          </div>
        </div>
      )}

      {name === "ProgressBar" && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "25px",
            maxWidth: "400px",
          }}
        >
          <div>
            <h3>Scanning (In Progress 50%)</h3>
            <ProgressBar
              isScanning={true}
              percent={50}
              message="Scanning page 5 of 10..."
            />
          </div>

          <div>
            <h3>Scanning (0% Start)</h3>
            <ProgressBar
              isScanning={true}
              percent={0}
              message="Initializing scanner..."
            />
          </div>

          <div>
            <h3>Scanning (100% Completed)</h3>
            <ProgressBar
              isScanning={true}
              percent={100}
              message="Scan finished!"
            />
          </div>

          <div>
            <h3>Not Scanning (Hidden State / Height 0)</h3>
            <div style={{ border: "1px dashed #333", padding: "10px" }}>
              <ProgressBar isScanning={false} percent={0} message="" />
              <p style={{ fontSize: "12px", color: "#666", margin: 0 }}>
                (ProgressBar should be invisible above this text)
              </p>
            </div>
          </div>
        </div>
      )}

      {name === "Tabs" && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "20px",
            maxWidth: "400px",
          }}
        >
          <div>
            <h3>Search Tab Active</h3>
            <Tabs
              activeTab="search"
              setActiveTab={() => {}}
              searchCount={12}
              favoritesCount={5}
              trashCount={2}
            />
          </div>

          <div>
            <h3>Favorites Tab Active (Empty counts)</h3>
            <Tabs
              activeTab="favorites"
              setActiveTab={() => {}}
              searchCount={0}
              favoritesCount={0}
              trashCount={0}
            />
          </div>

          <div>
            <h3>Trash Tab Active</h3>
            <Tabs
              activeTab="trash"
              setActiveTab={() => {}}
              searchCount={99}
              favoritesCount={42}
              trashCount={7}
            />
          </div>
        </div>
      )}

      {name === "AnimeList" && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "30px",
            maxWidth: "360px",
          }}
        >
          <div>
            <h3>Active Search Tab (Populated List)</h3>
            <div
              style={{
                maxHeight: "300px",
                overflowY: "auto",
                border: "1px solid #222",
              }}
            >
              <AnimeList
                activeTab="search"
                searchList={[mockItem1, mockItem2]}
                favorites={[]}
                trash={[]}
                onMoveToFavorites={() => {}}
                onMoveToTrash={() => {}}
                onRestoreFromTrash={() => {}}
              />
            </div>
          </div>

          <div>
            <h3>Empty State (Search Tab)</h3>
            <div style={{ border: "1px solid #222" }}>
              <AnimeList
                activeTab="search"
                searchList={[]}
                favorites={[]}
                trash={[]}
                onMoveToFavorites={() => {}}
                onMoveToTrash={() => {}}
                onRestoreFromTrash={() => {}}
              />
            </div>
          </div>

          <div>
            <h3>Empty State (Favorites Tab)</h3>
            <div style={{ border: "1px solid #222" }}>
              <AnimeList
                activeTab="favorites"
                searchList={[]}
                favorites={[]}
                trash={[]}
                onMoveToFavorites={() => {}}
                onMoveToTrash={() => {}}
                onRestoreFromTrash={() => {}}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
