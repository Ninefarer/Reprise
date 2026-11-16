import { createRoot } from "react-dom/client";
import { App } from "./App";
import { platform } from "reprise:platform";
platform.start();
createRoot(document.getElementById("root")!).render(<App />);
