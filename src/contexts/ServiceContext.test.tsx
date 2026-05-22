import { describe, it, expect } from "vitest";
import { renderHook } from "@testing-library/react";
import { useServices, ServiceProvider } from "./ServiceContext";
import { ReactNode } from "react";

describe("ServiceContext", () => {
  it("throws error when useServices is used outside ServiceProvider", () => {
    // Suppress console.error for this test as React will log the error boundary/unhandled error
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(() => renderHook(() => useServices())).toThrow(
      "useServices must be used within a ServiceProvider",
    );

    spy.mockRestore();
  });

  it("provides scraperService when used within ServiceProvider", () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <ServiceProvider>{children}</ServiceProvider>
    );
    const { result } = renderHook(() => useServices(), { wrapper });
    expect(result.current.scraperService).toBeDefined();
  });
});
