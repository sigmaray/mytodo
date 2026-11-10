import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import { AppRouter } from "./AppRouter";

export { TaskApp } from "./TaskApp";

export const createQueryClient = () => new QueryClient({ defaultOptions: { queries: { retry: false } } });

export const App = () => (
  <QueryClientProvider client={createQueryClient()}>
    <BrowserRouter>
      <AppRouter />
    </BrowserRouter>
  </QueryClientProvider>
);
