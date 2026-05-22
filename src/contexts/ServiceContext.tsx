import { createContext, useContext, ReactNode } from "react";
import { scraperService, ScraperService } from "../services/scraper";

interface ServiceContextType {
  scraperService: ScraperService;
}

const ServiceContext = createContext<ServiceContextType | undefined>(undefined);

export function ServiceProvider({ children }: { children: ReactNode }) {
  // We provide the singleton instance here.
  // This allows for easier testing by providing a mock service via a custom Provider in tests.
  return (
    <ServiceContext.Provider value={{ scraperService }}>
      {children}
    </ServiceContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useServices() {
  const context = useContext(ServiceContext);
  if (!context) {
    throw new Error("useServices must be used within a ServiceProvider");
  }
  return context;
}
