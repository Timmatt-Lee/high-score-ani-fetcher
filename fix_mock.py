with open("src/components/AnimeCard/AnimeCard.test.tsx", "r") as f:
    content = f.read()

content = content.replace("item={mockItem}", "item={makeAnime()}")
content = content.replace("onMoveToFavorites={mockMoveToFavorites}", "onMoveToFavorites={vi.fn()}")
content = content.replace("onMoveToTrash={mockMoveToTrash}", "onMoveToTrash={vi.fn()}")
content = content.replace("onRestoreFromTrash={mockRestoreFromTrash}", "onRestoreFromTrash={vi.fn()}")

with open("src/components/AnimeCard/AnimeCard.test.tsx", "w") as f:
    f.write(content)


with open("src/components/AnimeList/AnimeList.test.tsx", "r") as f:
    content = f.read()

content = content.replace("searchList={[mockItem]}", "searchList={[makeAnime()]}")
content = content.replace("onMoveToFavorites={mockMoveToFavorites}", "onMoveToFavorites={vi.fn()}")
content = content.replace("onMoveToTrash={mockMoveToTrash}", "onMoveToTrash={vi.fn()}")
content = content.replace("onRestoreFromTrash={mockRestoreFromTrash}", "onRestoreFromTrash={vi.fn()}")

with open("src/components/AnimeList/AnimeList.test.tsx", "w") as f:
    f.write(content)

