import { Tabs } from "../../../src/components/Tabs";
import { TestContainer } from "./TestContainer";

export default function TabsPlayground({
  params,
}: {
  params: URLSearchParams;
}) {
  const state = params.get("state") || "search";
  const activeTabType = state as "search" | "favorites" | "trash";
  const searchCount = parseInt(params.get("searchCount") || "0", 10);
  const favoritesCount = parseInt(params.get("favoritesCount") || "0", 10);
  const trashCount = parseInt(params.get("trashCount") || "0", 10);

  return (
    <TestContainer>
      <div style={{ width: "400px", height: "48px", boxSizing: "border-box" }}>
        <Tabs
          activeTab={activeTabType}
          setActiveTab={() => {}}
          searchCount={searchCount}
          favoritesCount={favoritesCount}
          trashCount={trashCount}
        />
      </div>
    </TestContainer>
  );
}
