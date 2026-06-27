import { render, screen } from "@testing-library/react";
import { Tabs, Tab } from "./src/components/Tabs";

test("accessible name of tabs", () => {
  render(
    <Tabs
      activeTab={Tab.Search}
      setActiveTab={() => {}}
      searchCount={0}
      favoritesCount={0}
      trashCount={0}
    />,
  );
  screen.debug();
  const favBtn = screen.getByRole("button", { name: /Favorites/i });
  console.log(favBtn.outerHTML);
});
