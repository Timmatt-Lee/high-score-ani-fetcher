import { ProgressBar } from "../../../src/components/ProgressBar";
import { TestContainer } from "./TestContainer";

export default function ProgressBarPlayground({
  params,
}: {
  params: URLSearchParams;
}) {
  const percent = parseInt(params.get("percent") || "0", 10);
  const message = params.get("message") || "";
  const isScanning = params.get("isScanning") !== "false";

  return (
    <TestContainer>
      <div style={{ width: "400px", height: "64px", boxSizing: "border-box" }}>
        <ProgressBar
          isScanning={isScanning}
          percent={percent}
          message={message}
        />
      </div>
    </TestContainer>
  );
}
