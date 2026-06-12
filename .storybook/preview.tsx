import type { Preview } from "@storybook/react";
import * as React from "react";
import "../src/index.css";

const preview: Preview = {
  decorators: [
    (Story) => {
      // Force height to auto for storybook body elements to allow Chromatic to correctly crop content height without page viewport stretch
      React.useEffect(() => {
        const style = document.createElement("style");
        style.innerHTML = `
          html, body, #storybook-root {
            height: auto !important;
            min-height: 0 !important;
          }
        `;
        document.head.appendChild(style);
        return () => {
          document.head.removeChild(style);
        };
      }, []);
      return <Story />;
    },
  ],
  parameters: {
    layout: "fullscreen",
    // Configure Chromatic to capture all snapshots at 450px width
    chromatic: {
      viewports: [450],
      // By default, capture content height. For App story or viewport-specific components, we can override cropToViewport: true.
      cropToViewport: false,
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
