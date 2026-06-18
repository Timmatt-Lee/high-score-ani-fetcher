with open("src/components/AnimeList/AnimeList.tsx", "r") as f:
    content = f.read()

content = content.replace(
"""    default: {
      const _exhaustiveCheck""",
"""    case Tab.Settings:
      return null;
    default: {
      const _exhaustiveCheck"""
)

with open("src/components/AnimeList/AnimeList.tsx", "w") as f:
    f.write(content)

