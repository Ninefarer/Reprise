use crate::store::Store;
use tauri_plugin_autostart::ManagerExt;

pub fn synchronize(app: &tauri::AppHandle, store: &Store) -> Result<(), String> {
    let enabled = app
        .autolaunch()
        .is_enabled()
        .map_err(|e| format!("Cannot read Windows startup registration: {e}"))?;
    let mut settings = store.settings()?;
    if settings.startup != enabled {
        settings.startup = enabled;
        store.set_settings(&settings)?;
    }
    Ok(())
}

/// Verify registration before persisting. Roll registration back if SQLite fails.
pub fn save(app: &tauri::AppHandle, store: &Store, enabled: bool) -> Result<(), String> {
    let manager = app.autolaunch();
    apply(
        store,
        enabled,
        || manager.is_enabled().map_err(|e| e.to_string()),
        |value| {
            if value {
                manager.enable()
            } else {
                manager.disable()
            }
            .map_err(|e| e.to_string())
        },
    )
}

fn apply(
    store: &Store,
    enabled: bool,
    query: impl Fn() -> Result<bool, String>,
    register: impl Fn(bool) -> Result<(), String>,
) -> Result<(), String> {
    let previous = query()?;
    let mut settings = store.settings()?;
    settings.startup = enabled;
    let result = (|| {
        register(enabled)?;
        if query()? != enabled {
            return Err("Windows startup registration did not match the requested setting".into());
        }
        store.set_settings(&settings)
    })();
    if let Err(error) = result {
        let rollback = register(previous).and_then(|()| {
            if query()? == previous {
                Ok(())
            } else {
                Err("Registration rollback did not match the previous value".into())
            }
        });
        return Err(format!(
            "Could not save startup preference: {error}; registration rollback: {rollback:?}"
        ));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::cell::Cell;
    #[test]
    fn enable_disable_and_registration_failure() {
        let store = Store::init(rusqlite::Connection::open_in_memory().unwrap()).unwrap();
        let registered = Cell::new(false);
        for enabled in [true, false] {
            apply(
                &store,
                enabled,
                || Ok(registered.get()),
                |value| {
                    registered.set(value);
                    Ok(())
                },
            )
            .unwrap();
            assert_eq!(registered.get(), enabled);
            assert_eq!(store.settings().unwrap().startup, enabled);
        }
        assert!(apply(&store, true, || Ok(false), |_| Err("Access denied".into())).is_err());
        assert!(!store.settings().unwrap().startup);
        assert!(apply(&store, true, || Ok(false), |_| Ok(())).is_err());
        assert!(!store.settings().unwrap().startup);
    }
    #[test]
    fn database_failure_restores_registration() {
        let store = Store::init(rusqlite::Connection::open_in_memory().unwrap()).unwrap();
        store.conn.execute_batch("PRAGMA query_only=ON;").unwrap();
        let registered = Cell::new(false);
        assert!(apply(
            &store,
            true,
            || Ok(registered.get()),
            |value| {
                registered.set(value);
                Ok(())
            }
        )
        .is_err());
        assert!(!registered.get());
    }
}
