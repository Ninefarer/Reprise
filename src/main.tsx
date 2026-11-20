import { createRoot } from "react-dom/client";
import { App } from "./App";
const root = createRoot(document.getElementById("root")!);
if (
  import.meta.env.DEV &&
  new URLSearchParams(location.search).has("glass-motion-lab")
) {
  void import("./GlassMotionLab").then(({ GlassMotionLab }) =>
    root.render(<GlassMotionLab />),
  );
} else if (
  import.meta.env.DEV &&
  new URLSearchParams(location.search).has("glass-lab")
) {
  void import("./GlassLab").then(({ GlassLab }) => root.render(<GlassLab />));
} else {
  root.render(<App />);
}
