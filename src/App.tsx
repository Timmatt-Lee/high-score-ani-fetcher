import { useState, useEffect } from 'react';
import { ScraperService, type AnimeItem } from './services/scraper';
import './index.css';

type TabType = 'search' | 'favorites' | 'trash';

function App() {
  const [activeTab, setActiveTab] = useState<TabType>('search');
  const [searchList, setSearchList] = useState<AnimeItem[]>([]);
  const [favorites, setFavorites] = useState<AnimeItem[]>([]);
  const [trash, setTrash] = useState<AnimeItem[]>([]);
  
  const [isScanning, setIsScanning] = useState(false);
  const [progress, setProgress] = useState({ percent: 0, message: '' });

  // Load data on mount
  useEffect(() => {
    const loadData = async () => {
      try {
        if (typeof chrome !== 'undefined' && chrome.storage) {
          const data = await chrome.storage.local.get(['searchList', 'favorites', 'trash']);
          if (data.searchList) setSearchList(data.searchList as AnimeItem[]);
          if (data.favorites) setFavorites(data.favorites as AnimeItem[]);
          if (data.trash) setTrash(data.trash as AnimeItem[]);
        } else {
          // Fallback for local web dev without extension context
          const localData = localStorage.getItem('animeData');
          if (localData) {
            const parsed = JSON.parse(localData);
            setSearchList(parsed.searchList || []);
            setFavorites(parsed.favorites || []);
            setTrash(parsed.trash || []);
          }
        }
      } catch (err) {
        console.error('Failed to load data', err);
      }
    };
    loadData();
  }, []);

  // Save data when state changes
  const saveData = async (s: AnimeItem[], f: AnimeItem[], t: AnimeItem[]) => {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage) {
        await chrome.storage.local.set({ searchList: s, favorites: f, trash: t });
      } else {
        localStorage.setItem('animeData', JSON.stringify({ searchList: s, favorites: f, trash: t }));
      }
    } catch (err) {
      console.error('Failed to save data', err);
    }
  };

  const handleScan = async () => {
    setIsScanning(true);
    setProgress({ percent: 0, message: 'Getting total pages...' });
    
    const totalPages = await ScraperService.getTotalPages();
    
    const allItems = await ScraperService.fetchAllWithConcurrency(totalPages, 5, (percent, msg) => {
      setProgress({ percent, message: msg });
    });
    
    setProgress({ percent: 100, message: 'Fetching details...' });
    
    // Filter out trash and favorites, and filter by score & episode count
    const newItems: AnimeItem[] = [];
    const trashLinks = new Set(trash.map(t => t.link));
    const favLinks = new Set(favorites.map(f => f.link));
    
    for (const item of allItems) {
      if (trashLinks.has(item.link) || favLinks.has(item.link)) continue;
      
      const epCount = parseInt(item.episode_count, 10);
      if (isNaN(epCount) || epCount < 10) continue; // Episode threshold
      if (item.title.includes('OVA')) continue;
      
      setProgress({ percent: 100, message: `Fetching details for ${item.title}...` });
      
      const details = await ScraperService.scrapeAnimeDetails(item.link);
      if (details.score >= 4.8) {
        newItems.push({ ...item, ...details });
      }
    }
    
    setSearchList(newItems);
    saveData(newItems, favorites, trash);
    setIsScanning(false);
    setProgress({ percent: 0, message: '' });
  };

  const moveToFavorites = (item: AnimeItem) => {
    const newSearch = searchList.filter(i => i.link !== item.link);
    const newFav = [...favorites, item];
    setSearchList(newSearch);
    setFavorites(newFav);
    saveData(newSearch, newFav, trash);
  };

  const moveToTrash = (item: AnimeItem) => {
    const newSearch = searchList.filter(i => i.link !== item.link);
    const newFav = favorites.filter(i => i.link !== item.link);
    const newTrash = [...trash, item];
    setSearchList(newSearch);
    setFavorites(newFav);
    setTrash(newTrash);
    saveData(newSearch, newFav, newTrash);
  };
  
  const restoreFromTrash = (item: AnimeItem) => {
    const newTrash = trash.filter(i => i.link !== item.link);
    const newSearch = [...searchList, item];
    setTrash(newTrash);
    setSearchList(newSearch);
    saveData(newSearch, favorites, newTrash);
  };

  const renderList = () => {
    let list: AnimeItem[] = [];
    if (activeTab === 'search') list = searchList;
    if (activeTab === 'favorites') list = favorites;
    if (activeTab === 'trash') list = trash;

    if (list.length === 0) {
      return <div className="empty-state">No anime found in this list.</div>;
    }

    return (
      <div className="list-container">
        {list.map(item => (
          <div key={item.link} className="anime-card">
            <div className="anime-title">
              <a href={item.link} target="_blank" rel="noreferrer">{item.title}</a>
              <span className="score-badge">★ {item.score.toFixed(1)}</span>
            </div>
            <div className="anime-meta">
              <span>{item.episode_count} Episodes</span>
              <span>{item.watch_count.toLocaleString()} Views</span>
              <span>{item.upload_date}</span>
            </div>
            <div className="anime-desc">{item.description}</div>
            
            <div className="card-actions">
              {activeTab !== 'favorites' && activeTab !== 'trash' && (
                <button className="action-btn fav" onClick={() => moveToFavorites(item)}>❤ Favorite</button>
              )}
              {activeTab !== 'trash' && (
                <button className="action-btn trash" onClick={() => moveToTrash(item)}>🗑 Trash</button>
              )}
              {activeTab === 'trash' && (
                <button className="action-btn" onClick={() => restoreFromTrash(item)}>↺ Restore</button>
              )}
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="app-container">
      <div className="header">
        <h1>AniFetcher Pro</h1>
        <button 
          className="btn" 
          onClick={handleScan} 
          disabled={isScanning}
        >
          {isScanning ? 'Scanning...' : 'Scan Bahamut'}
        </button>
      </div>

      {isScanning && (
        <div className="progress-container">
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${progress.percent}%` }}></div>
          </div>
          <div className="status-text">{progress.message}</div>
        </div>
      )}

      <div className="tabs">
        <button 
          className={`tab ${activeTab === 'search' ? 'active' : ''}`}
          onClick={() => setActiveTab('search')}
        >
          Results ({searchList.length})
        </button>
        <button 
          className={`tab ${activeTab === 'favorites' ? 'active' : ''}`}
          onClick={() => setActiveTab('favorites')}
        >
          Favorites ({favorites.length})
        </button>
        <button 
          className={`tab ${activeTab === 'trash' ? 'active' : ''}`}
          onClick={() => setActiveTab('trash')}
        >
          Trash ({trash.length})
        </button>
      </div>

      {renderList()}
    </div>
  );
}

export default App;
