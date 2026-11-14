import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

/** Регистрирует глобальную клавишу быстрого открытия формы новой задачи. */
export const useQuickAddShortcut = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const openQuickAdd = (event: globalThis.KeyboardEvent) => {
      const target = event.target;
      // Не перехватываем клавишу, когда пользователь вводит текст или редактирует содержимое.
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
        // Поддерживаем обе раскладки, открывая форму через URL-параметр.
        navigate("/?addTask=1");
      }
    };

    window.addEventListener("keydown", openQuickAdd);
    return () => window.removeEventListener("keydown", openQuickAdd);
  }, [navigate]);
};
