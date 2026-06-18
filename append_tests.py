with open("src/services/animeScanner/animeScanner.test.ts", "r") as f:
    content = f.read()

# remove the last '});\n'
last_idx = content.rindex("});")
content = content[:last_idx]

tests = """
  it("treats scannedAt as 0 if undefined", async () => {
    const listSpy = vi.fn().mockResolvedValue({
      animeItems: [{ link: "http://undefined-scannedAt", title: "Test" } as AnimeItem],
      httpErrors: [],
      parseErrors: [],
    });
    const map = new Map();
    const cachedAnime = { link: "http://undefined-scannedAt", title: "Test", score: 9.9 } as AnimeItem; // no scannedAt
    map.set("http://undefined-scannedAt", cachedAnime);

    const pipeline = new AnimeScanner(
      1, 1, 1, () => true,
      { getTotalPages: vi.fn(), scrapeAnimesOnPage: listSpy, scrapeAnimeDetails: vi.fn().mockResolvedValue({ score: 9.9, ratingCount: 1, description: "" }) } as unknown as AnimeScraper,
      map,
      { targetScore: 4.8, rescanThreshold: 95, cacheExpireDays: 14 }
    );

    const { animeItems } = await runPipeline(pipeline);
    expect(animeItems).toHaveLength(1);
    expect(animeItems[0].title).toBe("Test");
  });

  it("yields cached item directly if not expired", async () => {
    const listSpy = vi.fn().mockResolvedValue({
      animeItems: [{ link: "http://cached", title: "Cached Anime" } as AnimeItem],
      httpErrors: [],
      parseErrors: [],
    });
    const detailSpy = vi.fn();
    const map = new Map();
    const cachedAnime = { link: "http://cached", title: "Cached Anime", score: 9.9, scannedAt: new Date(Date.now() - 1000) } as AnimeItem;
    map.set("http://cached", cachedAnime);

    const pipeline = new AnimeScanner(
      1, 1, 1, () => true,
      { getTotalPages: vi.fn(), scrapeAnimesOnPage: listSpy, scrapeAnimeDetails: detailSpy } as unknown as AnimeScraper,
      map,
      { targetScore: 4.8, rescanThreshold: 95, cacheExpireDays: 14 }
    );

    const { animeItems } = await runPipeline(pipeline);
    expect(animeItems).toHaveLength(1);
    expect(detailSpy).not.toHaveBeenCalled();
  });

  it("fetches details if existing cache is expired and score is high enough", async () => {
    const defaultSettings = { targetScore: 4.8, rescanThreshold: 95, cacheExpireDays: 14 };
    const mockItem = {
      link: "http://expired-high-score",
      title: "Expired High Score Anime",
      watchCount: 1,
      episodeCount: 12,
      uploadDate: new Date(),
      score: 4.8, // meets threshold
      ratingCount: 10,
      description: "Desc",
      scannedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // expired (30 days ago)
    } as AnimeItem;
    const map = new Map<string, AnimeItem>();
    map.set(mockItem.link, mockItem);

    const listSpy = vi.fn().mockResolvedValue({
      animeItems: [mockItem],
      httpErrors: [],
      parseErrors: [],
    });
    const detailSpy = vi.fn().mockResolvedValue({ score: 4.9, ratingCount: 20, description: "New" });
    
    const scraper = {
      getTotalPages: vi.fn(),
      scrapeAnimesOnPage: listSpy,
      scrapeAnimeDetails: detailSpy,
    } as unknown as AnimeScraper;

    const pipeline = new AnimeScanner(1, 1, 1, () => true, scraper, map, defaultSettings);

    const { animeItems } = await runPipeline(pipeline);

    expect(animeItems).toHaveLength(1);
    expect(scraper.scrapeAnimeDetails).toHaveBeenCalled();
  });
});
"""

content += tests

with open("src/services/animeScanner/animeScanner.test.ts", "w") as f:
    f.write(content)
