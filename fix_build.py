with open("src/components/AnimeCard/AnimeCard.tsx", "r") as f:
    content = f.read()

content = content.replace(
"""      default: {
        const _exhaustiveCheck: never = activeTab;""",
"""      case Tab.Settings:
        return null;
      default: {
        const _exhaustiveCheck: never = activeTab;"""
)

with open("src/components/AnimeCard/AnimeCard.tsx", "w") as f:
    f.write(content)

with open("src/components/AnimeList/AnimeList.tsx", "r") as f:
    content = f.read()

content = content.replace(
"""      default: {
        const _exhaustiveCheck: never = activeTab;""",
"""      case Tab.Settings:
        return null;
      default: {
        const _exhaustiveCheck: never = activeTab;"""
)

with open("src/components/AnimeList/AnimeList.tsx", "w") as f:
    f.write(content)

with open("src/hooks/useAnimeScanner.test.ts", "r") as f:
    content = f.read()

content = content.replace('subscriber.next(new Error("Generic emitted error"));', 'subscriber.next(new Error("Generic emitted error") as any);')
content = content.replace('new AnimeScanParseError(1, "step", "url", "err")', 'new AnimeScanParseError(1, AnimeScanStep.GET_TOTAL_PAGES, "url", "err")')

with open("src/hooks/useAnimeScanner.test.ts", "w") as f:
    f.write(content)

