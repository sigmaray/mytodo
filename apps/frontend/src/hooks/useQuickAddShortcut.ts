import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

export const useQuickAddShortcut = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const openQuickAdd = (event: globalThis.KeyboardEvent) => {
      const target = event.target;
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
        navigate("/?addTask=1");
      }
    };

    window.addEventListener("keydown", openQuickAdd);
    return () => window.removeEventListener("keydown", openQuickAdd);
  }, [navigate]);
};
