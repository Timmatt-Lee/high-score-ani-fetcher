export interface AnimeDetails {
  score: number;
  rating_count: number;
  description: string;
}

export interface AnimeItem extends AnimeDetails {
  link: string;
  title: string;
  watch_count: number;
  episode_count: number;
  upload_date: Date;
}
