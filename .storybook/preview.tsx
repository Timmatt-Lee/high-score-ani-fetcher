import type { Preview } from "@storybook/react";
import "../src/index.css";

// Override the extension's body width and height constraints for Storybook previews
if (typeof document !== "undefined") {
  const style = document.createElement("style");
  style.innerHTML = `
    html, body, #storybook-root, #storybook-root > * {
      width: auto !important;
      height: auto !important;
      min-height: auto !important;
      padding: 16px !important;
      background-color: #0f172a !important;
    }
  `;
  document.head.appendChild(style);
}

const preview: Preview = {
  parameters: {
    // Configure Chromatic to capture all snapshots at 450px width
    chromatic: {
      viewports: [450],
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
