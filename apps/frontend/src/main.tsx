import { createRoot } from "react-dom/client";
import { App } from "./App";

// Находим узел HTML, в который монтируется React-приложение.
const root = document.getElementById("root");

if (root !== null) {
  // Не запускаем React, если точка монтирования отсутствует в документе.
  createRoot(root).render(<App />);
}
