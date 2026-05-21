import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./styles.css";

const appRoot = document.querySelector<HTMLElement>("#app");

if (!appRoot) {
  throw new Error("앱 루트를 찾을 수 없습니다.");
}

createRoot(appRoot).render(<App />);
