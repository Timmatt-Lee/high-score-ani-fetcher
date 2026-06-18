import re

with open("src/components/AnimeCard/AnimeCard.tsx", "r") as f:
    content = f.read()

content = content.replace("default: {\n        const _exhaustiveCheck", "case Tab.Settings:\n        return null;\n      default: {\n        const _exhaustiveCheck")

with open("src/components/AnimeCard/AnimeCard.tsx", "w") as f:
    f.write(content)

with open("src/components/AnimeList/AnimeList.tsx", "r") as f:
    content = f.read()

content = content.replace("default: {\n        const _exhaustiveCheck", "case Tab.Settings:\n        return null;\n      default: {\n        const _exhaustiveCheck")

with open("src/components/AnimeList/AnimeList.tsx", "w") as f:
    f.write(content)

