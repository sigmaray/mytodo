import { createPortal } from "react-dom";
import { ToastContainer } from "react-toastify";

/** Рендерит контейнер уведомлений вне основного DOM-поддерева приложения. */
export const ToastPortal = () =>
  createPortal(
    <ToastContainer
      position="bottom-right"
      autoClose={5000}
      newestOnTop
      closeOnClick
      pauseOnFocusLoss
      draggable
      pauseOnHover
      theme="light"
    />,
    document.body,
  );
