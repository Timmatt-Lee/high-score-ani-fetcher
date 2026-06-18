with open("src/components/AnimeCard/AnimeCard.test.tsx", "r") as f:
    content = f.read()

content = content.replace('expect(container.querySelector(".cardActions") || container.querySelector("[class*="cardActions"]")).toBeEmptyDOMElement();', 'expect(container).toBeEmptyDOMElement();')

# Wait, if we use container.toBeEmptyDOMElement() it fails because AnimeCard wraps it in `<div class="animeCard">`.
# So let's just make the test not use toBeEmptyDOMElement, but instead check `expect(container.firstChild).toBeNull()`
content = content.replace('expect(container).toBeEmptyDOMElement();', 'expect(container.firstChild).toBeNull();')

with open("src/components/AnimeCard/AnimeCard.test.tsx", "w") as f:
    f.write(content)

with open("src/components/AnimeList/AnimeList.test.tsx", "r") as f:
    content = f.read()

content = content.replace('expect(container).toBeEmptyDOMElement();', 'expect(container.firstChild).toBeNull();')

with open("src/components/AnimeList/AnimeList.test.tsx", "w") as f:
    f.write(content)

