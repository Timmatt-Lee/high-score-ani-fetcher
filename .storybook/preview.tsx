import type { Preview } from "@storybook/react";
import "../src/index.css";

// Override the extension's body width and height constraints for Storybook previews
if (typeof document !== "undefined") {
  const style = document.createElement("style");
  style.innerHTML = `
    body {
      width: auto !important;
      height: auto !important;
      padding: 24px !important;
      background-color: #0f172a !important;
    }
  `;
  document.head.appendChild(style);
}

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
  },
};

export default preview;
