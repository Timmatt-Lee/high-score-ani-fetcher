import type { Preview } from "@storybook/react";
import "../src/index.css";

const preview: Preview = {
  parameters: {
    layout: "fullscreen",
    // Configure Chromatic to capture all snapshots at 1200px width
    chromatic: {
      viewports: [1200],
      // By default, capture content height. For App story or viewport-specific components, we can override cropToViewport: true.
      cropToViewport: false,
    },
    // Configure Storybook UI viewport options for developers to match full-screen dashboard
    viewport: {
      defaultViewport: "desktopDashboard",
      viewports: {
        desktopDashboard: {
          name: "Desktop Dashboard",
          styles: {
            width: "1200px",
            height: "800px",
          },
        },
      },
    },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
  },
};

export default preview;
