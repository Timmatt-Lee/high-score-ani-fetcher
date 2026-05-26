/* eslint-disable react-refresh/only-export-components */
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "../../src/index.css";

import AnimeCardPlayground from "./playgrounds/AnimeCard.playground";
import ProgressBarPlayground from "./playgrounds/ProgressBar.playground";
import TabsPlayground from "./playgrounds/Tabs.playground";
import AnimeListPlayground from "./playgrounds/AnimeList.playground";

function RenderComponent() {
  const params = new URLSearchParams(window.location.search);
  const component = params.get("component");

  switch (component) {
    case "AnimeCard":
      return <AnimeCardPlayground params={params} />;
    case "ProgressBar":
      return <ProgressBarPlayground params={params} />;
    case "Tabs":
      return <TabsPlayground params={params} />;
    case "AnimeList":
      return <AnimeListPlayground params={params} />;
    default:
      return (
        <div style={{ padding: "20px", background: "#121212", color: "red" }}>
          Unknown component: {component}
        </div>
      );
  }
}

const container = document.getElementById("root")!;
createRoot(container).render(
  <StrictMode>
    <RenderComponent />
  </StrictMode>,
);
