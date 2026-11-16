import { createRoot } from "react-dom/client";
import { platform } from "reprise:platform";
import { App } from "./App";
platform.start();
createRoot(document.getElementById("root")!).render(<App />);
