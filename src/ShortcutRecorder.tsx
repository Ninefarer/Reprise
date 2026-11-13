import { useState } from "react";
import {
  defaultCommandShortcut,
  shortcutError,
  shortcutFromEvent,
} from "./shortcuts";
export function ShortcutRecorder({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const [recording, setRecording] = useState(false),
    [error, setError] = useState("");
  return (
    <div className="shortcut-recorder">
      <label>
        Command palette shortcut
        <input
          readOnly
          data-shortcut-recorder
          value={recording ? "Press a shortcut…" : value}
          aria-invalid={!!error}
          aria-describedby={
            error || recording ? "shortcut-feedback" : undefined
          }
          onFocus={() => setRecording(true)}
          onBlur={() => setRecording(false)}
          onKeyDown={(event) => {
            if (event.key === "Tab") {
              setRecording(false);
              return;
            }
            event.preventDefault();
            event.stopPropagation();
            if (event.key === "Escape") {
              setRecording(false);
              setError("");
              return;
            }
            if (
              event.repeat ||
              event.nativeEvent.isComposing ||
              event.getModifierState("AltGraph")
            )
              return;
            if (event.metaKey) {
              setError("Windows shortcuts are reserved by the system.");
              return;
            }
            const next = shortcutFromEvent(event);
            if (!next) return;
            const message = shortcutError(next);
            setError(message ?? "");
            if (!message) {
              onChange(next);
              setRecording(false);
            }
          }}
        />
      </label>
      <button
        type="button"
        onClick={() => {
          onChange(defaultCommandShortcut);
          setError("");
          setRecording(false);
        }}
      >
        Reset shortcut
      </button>
      {(error || recording) && (
        <p id="shortcut-feedback" role={error ? "alert" : "status"}>
          {error || "Press your preferred combination. Escape cancels."}
        </p>
      )}
    </div>
  );
}
