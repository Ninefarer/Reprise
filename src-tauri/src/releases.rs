use crate::Db;
use tauri::Emitter;
pub fn baseline_first_install(settings: &mut crate::domain::Settings, current: &str) -> bool {
    if !settings.onboarded && settings.last_seen_release.is_none() {
        settings.last_seen_release = Some(current.to_string());
        true
    } else {
        false
    }
}
pub fn should_show(current: &str, ack: Option<&str>) -> bool {
    let Ok(current) = semver::Version::parse(current) else {
        return false;
    };
    match ack.and_then(|v| semver::Version::parse(v).ok()) {
        Some(previous) => current.cmp_precedence(&previous).is_gt(),
        None => true,
    }
}
#[tauri::command]
pub fn acknowledge_release(
    version: String,
    db: tauri::State<Db>,
    app: tauri::AppHandle,
) -> Result<(), String> {
    if version != app.package_info().version.to_string() {
        return Err("Only the installed release can be acknowledged".into());
    }
    let d = db.lock().map_err(|e| e.to_string())?;
    let mut s = d.settings()?;
    s.last_seen_release = Some(version);
    d.set_settings(&s)?;
    drop(d);
    app.emit("refresh", ()).map_err(|e| e.to_string())
}

/// A fixed project URL only; never execute a user-provided URL or shell expression.
#[tauri::command]
pub fn open_issue_report() -> Result<(), String> {
    #[cfg(windows)]
    {
        std::process::Command::new("explorer.exe")
            .arg("https://github.com/Ninefarer/Reprise/issues/new")
            .spawn()
            .map_err(|e| e.to_string())?;
        Ok(())
    }
    #[cfg(not(windows))]
    {
        Err("Open the project issues page in your browser.".into())
    }
}
