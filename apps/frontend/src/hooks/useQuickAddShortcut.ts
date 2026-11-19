import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

/**
 * Registers a global keyboard shortcut for quickly opening the new task form.
 */
export const useQuickAddShortcut = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const openQuickAdd = (event: globalThis.KeyboardEvent) => {
      const target = event.target;
      /** Do not intercept the key while the user is typing or editing content. */
      const typing =
        target instanceof HTMLElement &&
        (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));
      if (
        !typing &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.altKey &&
        ["q", "й"].includes(event.key.toLocaleLowerCase())
      ) {
        /** Support both keyboard layouts by opening the form through a URL parameter. */
        navigate("/?addTask=1");
      }
    };

    window.addEventListener("keydown", openQuickAdd);
    return () => window.removeEventListener("keydown", openQuickAdd);
  }, [navigate]);
};
