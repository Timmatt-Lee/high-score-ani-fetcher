import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import { ServiceProvider } from "./contexts/ServiceContext.tsx";
import { ComponentPlayground } from "./components/ComponentPlayground.tsx";

const params = new URLSearchParams(window.location.search);
const testComponent = params.get("test-component");

const container = document.getElementById("root")!;

if (testComponent) {
  createRoot(container).render(
    <StrictMode>
      <ComponentPlayground name={testComponent} />
    </StrictMode>,
  );
} else {
  createRoot(container).render(
    <StrictMode>
      <ServiceProvider>
        <App />
      </ServiceProvider>
    </StrictMode>,
  );
}
