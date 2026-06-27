import "@testing-library/jest-dom";

// Mock getBoundingClientRect for react-virtual internal scrolling in JSDOM
const originalGetBoundingClientRect =
  HTMLElement.prototype.getBoundingClientRect;
HTMLElement.prototype.getBoundingClientRect = function () {
  const rect = originalGetBoundingClientRect.call(this);
  // Give virtual containers a default height so they render items in tests
  if (
    typeof this.className === "string" &&
    (this.className.includes("tableBody") ||
      this.className.includes("animeTable") ||
      this.className.includes("tableWrapper"))
  ) {
    return { ...rect, width: 1200, height: 800, bottom: 800, right: 1200 };
  }
  return rect;
};

Object.defineProperty(HTMLElement.prototype, "offsetHeight", {
  configurable: true,
  value: 800,
});
Object.defineProperty(HTMLElement.prototype, "offsetWidth", {
  configurable: true,
  value: 1200,
});

// Mock ResizeObserver for react-virtual
if (typeof ResizeObserver === "undefined") {
  globalThis.ResizeObserver = class {
    callback: (
      entries: { target: Element; contentRect: DOMRect }[],
      observer: unknown,
    ) => void;
    constructor(
      callback: (
        entries: { target: Element; contentRect: DOMRect }[],
        observer: unknown,
      ) => void,
    ) {
      this.callback = callback;
    }
    observe(target: Element) {
      this.callback(
        [{ target, contentRect: target.getBoundingClientRect() }],
        this,
      );
    }
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
}
