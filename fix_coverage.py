import re

with open('src/services/animeScanner/animeScanner.test.ts', 'r') as f:
    content = f.read()

test_to_add = """
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

    const result = await new Promise<AnimeScanEvent[]>((resolve, reject) => {
      const events: AnimeScanEvent[] = [];
      pipeline.scan().subscribe({
        next: (event) => events.push(event),
        complete: () => resolve(events),
        error: reject,
      });
    });

    expect(detailSpy).not.toHaveBeenCalled();
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(cachedAnime);
  });
"""

if 'yields cached item directly if not expired' not in content:
    content = content.replace('});\n', '});\n' + test_to_add, 1) # Insert before last });
    # Wait, better to insert before the last `});`
    idx = content.rfind('});')
    if idx != -1:
        content = content[:idx] + test_to_add + content[idx:]
    with open('src/services/animeScanner/animeScanner.test.ts', 'w') as f:
        f.write(content)

with open('src/hooks/useAnimeScanner.test.ts', 'r') as f:
    content = f.read()

test_to_add2 = """
  it("handles generic Error events emitted during scan", async () => {
    vi.spyOn(animeScraper, "getTotalPages").mockResolvedValue(1);
    vi.spyOn(AnimeScanner.prototype, "scan").mockImplementation(() => {
      return new Observable<AnimeScanEvent>((subscriber) => {
        subscriber.next(new Error("Generic emitted error"));
        subscriber.complete();
      });
    });

    const onComplete = vi.fn();
    const { result } = renderHook(
      () => useAnimeScanner([], [], [], defaultSettings, onComplete),
      { wrapper: ServiceProvider }
    );

    await act(async () => {
      await result.current.handleScan();
    });

    // Error emitted via next shouldn't crash it, but is ignored from results
    expect(result.current.searchList).toHaveLength(0);
  });

  it("updates existing trash and favorite items correctly when they appear in scan results", async () => {
    vi.spyOn(animeScraper, "getTotalPages").mockResolvedValue(1);
    const mockFav = makeAnime("Fav");
    mockFav.score = 1.0;
    const mockTrash = makeAnime("Trash");
    mockTrash.score = 2.0;

    const scannedFav = { ...mockFav, score: 9.9 };
    const scannedTrash = { ...mockTrash, score: 8.8 };

    vi.spyOn(AnimeScanner.prototype, "scan").mockImplementation(() => {
      return new Observable<AnimeScanEvent>((subscriber) => {
        subscriber.next(scannedFav);
        subscriber.next(scannedTrash);
        subscriber.complete();
      });
    });

    const onComplete = vi.fn();
    const { result } = renderHook(
      () => useAnimeScanner([], [mockFav], [mockTrash], defaultSettings, onComplete),
      { wrapper: ServiceProvider }
    );

    await act(async () => {
      await result.current.handleScan();
    });

    expect(onComplete).toHaveBeenCalledWith(expect.objectContaining({
      updatedFavoriteList: [scannedFav],
      updatedTrashList: [scannedTrash]
    }));
  });
"""

if 'handles generic Error events emitted during scan' not in content:
    idx = content.rfind('});')
    if idx != -1:
        content = content[:idx] + test_to_add2 + content[idx:]
    with open('src/hooks/useAnimeScanner.test.ts', 'w') as f:
        f.write(content)
