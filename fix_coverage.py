with open("src/components/AnimeCard/AnimeCard.test.tsx", "r") as f:
    content = f.read()

# remove the poorly inserted string
import re
content = re.sub(r'  it\("renders nothing when activeTab is Settings".*?\}\);\n', '', content, flags=re.DOTALL)

# Insert it before the last `});`
last_idx = content.rindex("});")
new_test = """
  it("renders nothing when activeTab is Settings", () => {
    const { container } = render(
      <AnimeCard
        item={mockItem}
        activeTab={Tab.Settings}
        onMoveToFavorites={mockMoveToFavorites}
        onMoveToTrash={mockMoveToTrash}
        onRestoreFromTrash={mockRestoreFromTrash}
      />
    );
    expect(container).toBeEmptyDOMElement();
  });
"""
content = content[:last_idx] + new_test + content[last_idx:]

with open("src/components/AnimeCard/AnimeCard.test.tsx", "w") as f:
    f.write(content)

with open("src/components/AnimeList/AnimeList.test.tsx", "r") as f:
    content = f.read()

content = re.sub(r'  it\("renders nothing when activeTab is Settings".*?\}\);\n', '', content, flags=re.DOTALL)

last_idx = content.rindex("});")
new_test = """
  it("renders nothing when activeTab is Settings", () => {
    const { container } = render(
      <AnimeList
        activeTab={Tab.Settings}
        searchList={[mockItem]}
        favoriteList={[]}
        trashList={[]}
        onMoveToFavorites={mockMoveToFavorites}
        onMoveToTrash={mockMoveToTrash}
        onRestoreFromTrash={mockRestoreFromTrash}
      />
    );
    expect(container).toBeEmptyDOMElement();
  });
"""
content = content[:last_idx] + new_test + content[last_idx:]

with open("src/components/AnimeList/AnimeList.test.tsx", "w") as f:
    f.write(content)

