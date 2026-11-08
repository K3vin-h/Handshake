import "@fontsource-variable/atkinson-hyperlegible-next";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { MotionProvider } from "./components/motion/MotionProvider";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <MotionProvider>
      <App />
    </MotionProvider>
  </StrictMode>,
);
