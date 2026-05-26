import React from "react";

export function TestContainer({ children }: { children: React.ReactNode }) {
  return (
    <div
      id="playground-root"
      style={{
        padding: "20px",
        background: "#121212",
        color: "#ffffff",
        minHeight: "100vh",
        display: "inline-block",
        boxSizing: "border-box",
        fontFamily: "Inter, sans-serif",
      }}
    >
      {children}
    </div>
  );
}
