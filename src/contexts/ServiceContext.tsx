import { createContext, useContext, type ReactNode } from "react";
import {
  animeScanner,
  AnimeScanner,
} from "../services/animeScanner/animeScanner";

interface ServiceContextType {
  animeScanner: AnimeScanner;
}

const ServiceContext = createContext<ServiceContextType | undefined>(undefined);

interface ServiceProviderProps {
  children: ReactNode;
  animeScanner?: AnimeScanner;
}

export function ServiceProvider({
  children,
  animeScanner: customAnimeScanner,
}: ServiceProviderProps) {
  // We provide the singleton instance here by default.
  // This allows for easier testing by providing a mock service via a custom Provider or prop.
  return (
    <ServiceContext.Provider
      value={{ animeScanner: customAnimeScanner || animeScanner }}
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
