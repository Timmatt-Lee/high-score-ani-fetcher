import type { Preview } from "@storybook/react";
import "../src/index.css";

const preview: Preview = {
  parameters: {
    layout: "fullscreen",
    // Configure Chromatic to capture all snapshots at 450px width and crop to viewport
    chromatic: {
      viewports: [450],
      cropToViewport: true,
    },
    // Configure Storybook UI viewport options for developers
    viewport: {
      defaultViewport: "extensionPopup",
      viewports: {
        extensionPopup: {
          name: "Extension Popup",
          styles: {
            width: "450px",
            height: "600px",
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
