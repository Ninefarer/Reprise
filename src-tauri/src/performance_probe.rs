//! Explicit QA build + identity + measured-request opt-in. Never records task content.
use serde_json::{json, Value};
use std::io::Write;
use tauri::Manager;

const QA_ID: &str = "com.reprise.performance.qa";
const PHASES: &[&str] = &[
    "mutex_wait_ms",
    "tasks_ms",
    "settings_ms",
    "notifications_ms",
    "avatar_system_ms",
    "snapshot_total_ms",
];

fn metrics(snapshot: &Value, reason: Option<&str>) -> Value {
    let (reason, visibility) = reason
        .and_then(|value| value.split_once(':'))
        .map_or((reason, "unknown"), |(reason, visibility)| {
            (Some(reason), visibility)
        });
    let reason = match reason {
        Some("initial" | "timer" | "event" | "focus" | "resume" | "explicit") => reason.unwrap(),
        _ => "other",
    };
    let phases: serde_json::Map<_, _> = PHASES
        .iter()
        .filter_map(|key| {
            snapshot["performance"][key]
                .as_f64()
                .map(|value| ((*key).into(), json!(value)))
        })
        .collect();
    json!({
        "reason": reason,
        "document_visibility": match visibility { "visible" | "hidden" => visibility, _ => "unknown" },
        "tasks": snapshot["tasks"].as_array().map_or(0, Vec::len),
        "notifications": snapshot["notifications"].as_array().map_or(0, Vec::len),
        "bytes": serde_json::to_vec(snapshot).map_or(0, |bytes| bytes.len()),
        "phases": phases,
    })
}

pub fn capture_shortcut(identifier: &str) -> &'static str {
    if identifier == QA_ID {
        "Ctrl+Alt+Shift+Space"
    } else {
        "Ctrl+Shift+Space"
    }
}

pub fn record(
    app: &tauri::AppHandle,
    window: &tauri::WebviewWindow,
    reason: Option<&str>,
    snapshot: &Value,
) {
    record_row(app, window, reason, Some(snapshot));
}

pub fn record_skipped(app: &tauri::AppHandle, window: &tauri::WebviewWindow, reason: Option<&str>) {
    record_row(app, window, reason, None);
}

fn record_row(
    app: &tauri::AppHandle,
    window: &tauri::WebviewWindow,
    reason: Option<&str>,
    snapshot: Option<&Value>,
) {
    if app.config().identifier != QA_ID {
        return;
    }
    let mut row = metrics(snapshot.unwrap_or(&Value::Null), reason);
    row["kind"] = json!(if snapshot.is_none() {
        "skipped"
    } else if window.label() == "capture" {
        "capture"
    } else {
        "full"
    });
    if snapshot.is_none() {
        row["bytes"] = json!(0);
    }
    row["at_ms"] = json!(chrono::Utc::now().timestamp_millis());
    row["window"] = json!(window.label());
    row["visible"] = json!(window.is_visible().ok());
    row["minimized"] = json!(window.is_minimized().ok());
    row["focused"] = json!(window.is_focused().ok());
    let result = (|| -> Result<(), Box<dyn std::error::Error>> {
        let path = app.path().app_data_dir()?.join("performance-qa.jsonl");
        let mut file = std::fs::OpenOptions::new()
            .create(true)
            .append(true)
            .open(path)?;
        writeln!(file, "{row}")?;
        Ok(())
    })();
    if let Err(error) = result {
        eprintln!("QA performance recorder: {error}");
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn exports_only_counts_known_reasons_and_numeric_phases() {
        let snapshot = json!({"tasks":[{"title":"Private title"}], "notifications":[{"message":"Private reminder"}], "settings":{"name":"Private name"}, "performance":{"tasks_ms":1.5,"settings_ms":"Private phase","unexpected":"Private value"}});
        let row = metrics(&snapshot, Some("Private reason"));
        assert_eq!(row["tasks"], 1);
        assert_eq!(row["notifications"], 1);
        assert_eq!(row["reason"], "other");
        assert_eq!(row["phases"], json!({"tasks_ms":1.5}));
        assert_eq!(row["bytes"], serde_json::to_vec(&snapshot).unwrap().len());
        assert!(!row.to_string().contains("Private"));
        let row = metrics(&snapshot, Some("timer:hidden"));
        assert_eq!(row["reason"], "timer");
        assert_eq!(row["document_visibility"], "hidden");
        assert_eq!(capture_shortcut("com.reprise.desktop"), "Ctrl+Shift+Space");
        assert_eq!(capture_shortcut("com.reprise.nightly"), "Ctrl+Shift+Space");
        assert_eq!(capture_shortcut(QA_ID), "Ctrl+Alt+Shift+Space");
    }
}
