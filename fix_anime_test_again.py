import re

with open("src/services/animeScanner/animeScanner.test.ts", "r") as f:
    content = f.read()

# remove the appended part
content = content.split('});\n});')[0] + '});\n'

test_case = """
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
    };
    const map = new Map<string, AnimeItem>();
    map.set(mockItem.link, mockItem);

    const scraper = {
      scrapeAnimesOnPage: vi.fn().mockResolvedValue({
        animeItems: [mockItem],
        httpErrors: [],
        parseErrors: [],
      }),
      scrapeAnimeDetails: vi.fn().mockResolvedValue({ score: 4.9, ratingCount: 20, description: "New" }),
    } as unknown as AnimeScraper;

    const pipeline = new AnimeScanner(1, 1, 1, () => true, scraper, map, defaultSettings);

    const result = await new Promise<AnimeScanEvent[]>((resolve, reject) => {
      const events: AnimeScanEvent[] = [];
      pipeline.scan().subscribe({
        next: (event) => events.push(event),
        complete: () => resolve(events),
        error: reject,
      });
    });

    expect(result).toHaveLength(1);
    expect(scraper.scrapeAnimeDetails).toHaveBeenCalled();
  });
});
"""

content += test_case

with open("src/services/animeScanner/animeScanner.test.ts", "w") as f:
    f.write(content)
