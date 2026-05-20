declare global {
  interface JQuery {
    tablesorter(options?: any): JQuery;
  }
  
  const actionUrls: {
    add_to_favorites: string;
    move_to_trash: string;
  };
  const scoreThreshold: number;
  const initialScrapingState: {
    is_running: boolean;
    stop_requested: boolean;
    progress?: {
      percentage?: number;
      loaded_count?: number;
      total_estimated?: number;
      current_anime?: string;
      status_message?: string;
    };
  };

  interface HTMLElement {
    timeoutId?: NodeJS.Timeout | number;
  }
}
export {};
