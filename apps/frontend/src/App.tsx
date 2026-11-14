import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import { AppRouter } from "./AppRouter";

export { TaskApp } from "./TaskApp";

/**
 * Создаёт клиент React Query с отключённым автоматическим повтором запросов.
 */
export const createQueryClient = () => new QueryClient({ defaultOptions: { queries: { retry: false } } });

/**
 * Корневое приложение, подключающее маршрутизацию и общий кэш запросов.
 */
export const App = () => (
  <QueryClientProvider client={createQueryClient()}>
    <BrowserRouter>
      <AppRouter />
    </BrowserRouter>
  </QueryClientProvider>
);
