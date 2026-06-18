with open("src/components/AnimeCard/AnimeCard.test.tsx", "r") as f:
    content = f.read()

content = content.replace('expect(container.firstChild).toBeNull();', 'expect(container.querySelector(\'[class*="cardActions"]\')?.childNodes.length).toBe(0);')

with open("src/components/AnimeCard/AnimeCard.test.tsx", "w") as f:
    f.write(content)

