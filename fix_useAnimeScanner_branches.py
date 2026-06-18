with open("src/hooks/useAnimeScanner.test.ts", "r") as f:
    content = f.read()

last_idx = content.rindex("});")

test_case = """
  it("preserves unmodified fav/trash items during scan (branch coverage)", async () => {
    const mockFav = makeAnime("Fav");
    const mockTrash = makeAnime("Trash");
    const scannedAnime = makeAnime("Scanned");

    vi.spyOn(animeScraper, "getTotalPages").mockResolvedValue(1);
    vi.spyOn(AnimeScanner.prototype, "scan").mockImplementation(() => {
      return createMockObservable([scannedAnime]);
    });

    const onComplete = vi.fn();
    const { result } = renderHook(
      () => useAnimeScanner([mockFav], [mockTrash], [], defaultSettings, onComplete),
      { wrapper: ServiceProvider }
    );

    await act(async () => {
      await result.current.handleScan();
    });

    expect(onComplete).toHaveBeenCalledWith({
      newSearchItems: [scannedAnime],
      updatedFavoriteList: [mockFav],
      updatedTrashList: [mockTrash],
    });
  });

  it("updates existing fav/trash items during scan (branch coverage)", async () => {
    const mockFav = makeAnime("Fav");
    const mockTrash = makeAnime("Trash");
    
    const updatedFav = { ...mockFav, score: 9.9 };
    const updatedTrash = { ...mockTrash, score: 1.1 };

    vi.spyOn(animeScraper, "getTotalPages").mockResolvedValue(1);
    vi.spyOn(AnimeScanner.prototype, "scan").mockImplementation(() => {
      return createMockObservable([updatedFav, updatedTrash]);
    });

    const onComplete = vi.fn();
    const { result } = renderHook(
      () => useAnimeScanner([mockFav], [mockTrash], [], defaultSettings, onComplete),
      { wrapper: ServiceProvider }
    );

    await act(async () => {
      await result.current.handleScan();
    });

    expect(onComplete).toHaveBeenCalledWith({
      newSearchItems: [],
      updatedFavoriteList: [updatedFav],
      updatedTrashList: [updatedTrash],
    });
  });

  it("handles AnimeScanParseError without animeName (branch coverage)", async () => {
    vi.spyOn(animeScraper, "getTotalPages").mockResolvedValue(1);
    vi.spyOn(AnimeScanner.prototype, "scan").mockImplementation(() => {
      const { Subject } = require("rxjs");
      const subject = new Subject();
      setTimeout(() => {
        subject.next(new AnimeScanParseError(1, "step", "url", "err"));
        subject.complete();
      }, 0);
      return subject;
    });

    const onComplete = vi.fn();
    const { result } = renderHook(
      () => useAnimeScanner([], [], [], defaultSettings, onComplete),
      { wrapper: ServiceProvider }
    );

    await act(async () => {
      await result.current.handleScan();
    });

    expect(result.current.parseErrors.length).toBe(1);
  });

  it("handles non-Error objects thrown during scan (branch coverage)", async () => {
    vi.spyOn(animeScraper, "getTotalPages").mockResolvedValue(1);
    vi.spyOn(AnimeScanner.prototype, "scan").mockImplementation(() => {
      const { Subject } = require("rxjs");
      const subject = new Subject();
      setTimeout(() => {
        subject.error({ notAnError: true });
      }, 0);
      return subject;
    });

    const onComplete = vi.fn();
    const { result } = renderHook(
      () => useAnimeScanner([], [], [], defaultSettings, onComplete),
      { wrapper: ServiceProvider }
    );

    await act(async () => {
      await result.current.handleScan();
    });

    expect(result.current.error).toBeInstanceOf(Error);
  });
"""

new_content = content[:last_idx] + test_case + content[last_idx:]

with open("src/hooks/useAnimeScanner.test.ts", "w") as f:
    f.write(new_content)
