import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import { AppRouter } from "./AppRouter";

export { TaskApp } from "./TaskApp";

/**
 * Creates a React Query client with automatic query retries disabled.
 */
export const createQueryClient = () => new QueryClient({ defaultOptions: { queries: { retry: false } } });

/**
 * Root application that provides routing and the shared query cache.
 */
export const App = () => (
  <QueryClientProvider client={createQueryClient()}>
    <BrowserRouter>
      <AppRouter />
    </BrowserRouter>
  </QueryClientProvider>
);
