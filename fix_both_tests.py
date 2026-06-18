import re

with open("src/App.test.tsx", "r") as f:
    content = f.read()

content = content.replace("<ServiceProvider value={{ animeScraper: mockScraper }}>", "<ServiceProvider>")
with open("src/App.test.tsx", "w") as f:
    f.write(content)

with open("src/hooks/useAnimeScanner.test.ts", "r") as f:
    content = f.read()

content = content.replace("const { result } = setupHook();", """
    const { result } = renderHook(
      () =>
        useAnimeScanner({
          existingAnimesMap: new Map(),
          onScanComplete: vi.fn(),
          settings: { targetScore: 4.8, rescanThreshold: 95, cacheExpireDays: 14 }
        }),
      {
        wrapper: ({ children }) => (
          <ServiceProvider>{children}</ServiceProvider>
        ),
      },
    );
""")
with open("src/hooks/useAnimeScanner.test.ts", "w") as f:
    f.write(content)

