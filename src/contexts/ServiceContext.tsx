import { createContext, useContext, type ReactNode } from "react";
import { scraperService, ScraperService } from "../services/scraper";

interface ServiceContextType {
  scraperService: ScraperService;
}

const ServiceContext = createContext<ServiceContextType | undefined>(undefined);

interface ServiceProviderProps {
  children: ReactNode;
  scraperService?: ScraperService;
}

export function ServiceProvider({
  children,
  scraperService: customScraperService,
}: ServiceProviderProps) {
  // We provide the singleton instance here by default.
  // This allows for easier testing by providing a mock service via a custom Provider or prop.
  return (
    <ServiceContext.Provider
      value={{ scraperService: customScraperService || scraperService }}
    >
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
