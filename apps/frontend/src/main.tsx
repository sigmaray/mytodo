import { createRoot } from "react-dom/client";
import { App } from "./App";

/** Find the HTML element where the React application is mounted. */
const root = document.getElementById("root");

if (root !== null) {
  /** Do not start React when the mount point is missing from the document. */
  createRoot(root).render(<App />);
}
