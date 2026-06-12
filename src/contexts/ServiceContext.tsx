import { createContext, useContext, type ReactNode } from "react";
import {
  animeScraper,
  AnimeScraper,
} from "../services/animeScanner/animeScraper";

interface ServiceContextType {
  animeScraper: AnimeScraper;
}

const ServiceContext = createContext<ServiceContextType | undefined>(undefined);

interface ServiceProviderProps {
  children: ReactNode;
  animeScraper?: AnimeScraper;
}

export function ServiceProvider({
  children,
  animeScraper: customAnimeScraper,
}: ServiceProviderProps) {
  // We provide the singleton instance here by default.
  // This allows for easier testing by providing a mock service via a custom Provider or prop.
  return (
    <ServiceContext.Provider
      value={{ animeScraper: customAnimeScraper || animeScraper }}
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
