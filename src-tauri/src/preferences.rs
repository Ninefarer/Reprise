use crate::{domain::Settings, store::Store};
use serde_json::{Map, Value};

impl Store {
    /// Merge only user-editable section fields while holding the Store mutex.
    pub fn preference_patch(&self, patch: Map<String, Value>) -> Result<(), String> {
        const ALLOWED: &[&str] = &[
            "name",
            "settlement_mode",
            "return_time",
            "review_time",
            "daily_review",
            "quiet_start",
            "quiet_end",
            "notifications",
            "categories",
            "close_to_tray",
            "command_shortcut",
        ];
        if patch.keys().any(|key| !ALLOWED.contains(&key.as_str())) {
            return Err("Unknown preference field".into());
        }
        let mut value = serde_json::to_value(self.settings()?).map_err(|e| e.to_string())?;
        value
            .as_object_mut()
            .ok_or("Invalid settings")?
            .extend(patch);
        let mut settings: Settings = serde_json::from_value(value).map_err(|e| e.to_string())?;
        settings.name = settings.name.trim().into();
        if settings.name.chars().count() > 100 {
            return Err("Use a shorter display name".into());
        }
        if !["next_day", "24h"].contains(&settings.settlement_mode.as_str()) {
            return Err("Choose a supported settlement mode".into());
        }
        for time in [
            &settings.return_time,
            &settings.review_time,
            &settings.quiet_start,
            &settings.quiet_end,
        ] {
            if time.len() != 5 || chrono::NaiveTime::parse_from_str(time, "%H:%M").is_err() {
                return Err("Enter times as HH:mm".into());
            }
        }
        if !["Ctrl+K", "Ctrl+Shift+P"].contains(&settings.command_shortcut.as_str()) {
            return Err("Choose a supported command shortcut".into());
        }
        self.set_settings(&settings)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn patches_preserve_unowned_fields_and_reject_invalid_values_atomically() {
        let store = Store::init(rusqlite::Connection::open_in_memory().unwrap()).unwrap();
        let mut initial = store.settings().unwrap();
        initial.workspace = "Legacy space".into();
        initial.desktop_glass = true;
        initial.sidebar_width = 301;
        store.set_settings(&initial).unwrap();
        store
            .preference_patch(
                serde_json::json!({"name":"  New name  "})
                    .as_object()
                    .unwrap()
                    .clone(),
            )
            .unwrap();
        let saved = store.settings().unwrap();
        assert_eq!(saved.name, "New name");
        assert_eq!(saved.workspace, initial.workspace);
        assert!(saved.desktop_glass);
        assert_eq!(saved.sidebar_width, 301);
        assert!(store
            .preference_patch(
                serde_json::json!({"name":"Lost", "return_time":"24:00"})
                    .as_object()
                    .unwrap()
                    .clone()
            )
            .is_err());
        assert_eq!(store.settings().unwrap().name, "New name");
        assert!(store
            .preference_patch(
                serde_json::json!({"onboarded":false})
                    .as_object()
                    .unwrap()
                    .clone()
            )
            .is_err());
    }
}
