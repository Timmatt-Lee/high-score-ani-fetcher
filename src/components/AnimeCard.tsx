import { type AnimeItem } from "../services/scraper";

interface AnimeCardProps {
  item: AnimeItem;
  activeTab: "search" | "favorites" | "trash";
  onMoveToFavorites: (item: AnimeItem) => void;
  onMoveToTrash: (item: AnimeItem) => void;
  onRestoreFromTrash: (item: AnimeItem) => void;
}

export function AnimeCard({
  item,
  activeTab,
  onMoveToFavorites,
  onMoveToTrash,
  onRestoreFromTrash,
}: AnimeCardProps) {
  return (
    <div className="anime-card">
      <div className="anime-title">
        <a href={item.link} target="_blank" rel="noreferrer">
          {item.title}
        </a>
        <span className="score-badge">★ {item.score.toFixed(1)}</span>
      </div>
      <div className="anime-meta">
        <span>{item.episode_count} Episodes</span>
        <span>{item.watch_count.toLocaleString()} Views</span>
        <span>{item.upload_date}</span>
      </div>
      <div className="anime-desc">{item.description}</div>

      <div className="card-actions">
        {activeTab !== "favorites" && activeTab !== "trash" && (
          <button
            className="action-btn fav"
            onClick={() => onMoveToFavorites(item)}
          >
            ❤ Favorite
          </button>
        )}
        {activeTab !== "trash" && (
          <button
            className="action-btn trash"
            onClick={() => onMoveToTrash(item)}
          >
            🗑 Trash
          </button>
        )}
        {activeTab === "trash" && (
          <button
            className="action-btn"
            onClick={() => onRestoreFromTrash(item)}
          >
            ↺ Restore
          </button>
        )}
      </div>
    </div>
  );
}
