import re

with open("src/hooks/useAnimeScanner.test.ts", "r") as f:
    content = f.read()

# remove the appended part
content = content.split('});\n});')[0] + '});\n'

test_case = """
  it("progressively saves results every 3 seconds", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-01-01T00:00:00Z"));

    const mockAnime1 = makeAnime("Test1");
    const mockAnime2 = makeAnime("Test2");
    const mockAnime3 = makeAnime("Test3");

    vi.spyOn(animeScraper, "getTotalPages").mockResolvedValue(1);
    vi.spyOn(AnimeScanner.prototype, "scan").mockImplementation(() => {
      return new Observable<AnimeScanEvent>((subscriber) => {
        subscriber.next(mockAnime1);
        vi.setSystemTime(new Date("2024-01-01T00:00:04Z")); // +4 seconds
        subscriber.next(mockAnime2); // This should trigger a partial save
        subscriber.complete();
      });
    });

    const { result } = setupHook();
    await act(async () => {
      await result.current.handleScan();
    });

    vi.useRealTimers();
  });
});
"""

content += test_case

with open("src/hooks/useAnimeScanner.test.ts", "w") as f:
    f.write(content)
