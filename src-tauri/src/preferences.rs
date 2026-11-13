use crate::{domain::Settings, store::Store};
use serde_json::{Map, Value};

pub fn validate_command_shortcut(value: &str) -> Result<(), String> {
    let parts: Vec<&str> = value.split('+').collect();
    let mut index = 0;
    let control = parts.get(index) == Some(&"Ctrl");
    if control {
        index += 1;
    }
    let alt = parts.get(index) == Some(&"Alt");
    if alt {
        index += 1;
    }
    if parts.get(index) == Some(&"Shift") {
        index += 1;
    }
    let key = parts.get(index).copied().unwrap_or("");
    let valid_key = (key.len() == 1
        && key
            .bytes()
            .all(|b| b.is_ascii_uppercase() || b.is_ascii_digit()))
        || key == "Space"
        || (1..=12).any(|n| key == format!("F{n}"));
    if (!control && !alt) || !valid_key || parts.len() != index + 1 {
        return Err("Use Ctrl or Alt with a letter, number, F1-F12 or Space".into());
    }
    if [
        "Ctrl+A",
        "Ctrl+C",
        "Ctrl+V",
        "Ctrl+X",
        "Ctrl+Z",
        "Ctrl+Y",
        "Ctrl+Shift+Z",
        "Ctrl+F",
        "Ctrl+Shift+N",
        "Ctrl+Shift+Space",
        "Ctrl+W",
        "Ctrl+T",
        "Ctrl+N",
        "Ctrl+L",
        "Ctrl+R",
        "Ctrl+Shift+R",
        "Ctrl+F5",
        "Alt+F4",
    ]
    .contains(&value)
    {
        return Err("That shortcut is reserved for another command".into());
    }
    Ok(())
}

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
        validate_command_shortcut(&settings.command_shortcut)?;
        self.set_settings(&settings)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn custom_shortcuts_reject_conflicts_and_preserve_existing_choices() {
        for value in [
            "Ctrl+K",
            "Ctrl+Shift+P",
            "Alt+J",
            "Ctrl+Alt+Shift+F12",
            "Ctrl+7",
        ] {
            assert!(validate_command_shortcut(value).is_ok(), "{value}");
        }
        for value in [
            "Ctrl+C",
            "Ctrl+F",
            "Ctrl+Shift+N",
            "Ctrl+Shift+Space",
            "Alt+F4",
            "Shift+J",
            "Ctrl+F13",
            "Meta+K",
            "Shift+Ctrl+K",
        ] {
            assert!(validate_command_shortcut(value).is_err(), "{value}");
        }
    }
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
