import { createPortal } from "react-dom";
import { ToastContainer } from "react-toastify";

/**
 * Renders the notification container outside the application's main DOM tree.
 */
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
