use crate::Db;
use serde::Serialize;
use std::sync::Mutex;
use tauri::{Emitter, Manager};
#[derive(Default, Clone, Serialize)]
pub struct Health {
    pub heartbeat: Option<i64>,
    pub scheduler_error: Option<String>,
    pub tray_running: bool,
    pub shortcut_error: Option<String>,
}
pub type RuntimeHealth = Mutex<Health>;
#[tauri::command]
pub fn diagnostics(
    app: tauri::AppHandle,
    db: tauri::State<Db>,
) -> Result<serde_json::Value, String> {
    let health = app
        .state::<RuntimeHealth>()
        .lock()
        .map_err(|e| e.to_string())?
        .clone();
    let d = db.lock().map_err(|e| e.to_string())?;
    let notices = d.notices()?;
    Ok(
        serde_json::json!({"health":health,"application_id":app.config().identifier,"registration":notification_setting(&app.config().identifier),"last_submission":notices.iter().filter_map(|n|n.submitted_at).max(),"errors":notices.iter().filter_map(|n|n.error.as_ref().map(|e|serde_json::json!({"at":n.created_at,"message":e}))).take(5).collect::<Vec<_>>()}),
    )
}
#[tauri::command]
pub fn test_notification(app: tauri::AppHandle, db: tauri::State<Db>) -> Result<(), String> {
    let d = db.lock().map_err(|e| e.to_string())?;
    let now = chrono::Utc::now().timestamp();
    let id = format!("test:{}", uuid::Uuid::new_v4());
    d.conn.execute("INSERT INTO notifications(id,category,title,message,created_at,scheduled_at) VALUES(?1,'Diagnostic','Reprise reminder test','Quick Capture: Ctrl+Shift+Space. This is a native Windows toast, separate from your in-app history.',?2,?2)",rusqlite::params![id,now]).map_err(|e|e.to_string())?;
    let content=crate::toasts::Content {title:"Reprise reminder test".into(),body:"Quick Capture: Ctrl+Shift+Space. This is a native Windows toast, separate from your in-app history.".into()};
    let result = crate::toasts::send(&app, &content, vec![id.clone()], false, None);
    d.conn
        .execute(
            "UPDATE notifications SET state=?1,submitted_at=?2,error=?3 WHERE id=?4",
            rusqlite::params![
                if result.is_ok() {
                    "Submitted"
                } else {
                    "Failed"
                },
                if result.is_ok() { Some(now) } else { None },
                result.as_ref().err().map(|e| e.to_string()),
                id
            ],
        )
        .map_err(|e| e.to_string())?;
    drop(d);
    let _ = app.emit("refresh", ());
    result.map_err(|e| e.to_string())
}

fn notification_setting(id: &str) -> String {
    #[cfg(windows)]
    {
        use windows::{
            core::HSTRING,
            UI::Notifications::{NotificationSetting, ToastNotificationManager},
        };
        match ToastNotificationManager::CreateToastNotifierWithId(&HSTRING::from(id))
            .and_then(|n| n.Setting())
        {
            Ok(s) => format!(
                "Windows notifier: {}. This does not prove Start Menu registration or display.",
                match s {
                    NotificationSetting::Enabled => "Enabled",
                    NotificationSetting::DisabledForApplication => "Disabled for this application",
                    NotificationSetting::DisabledForUser => "Disabled for this user",
                    NotificationSetting::DisabledByGroupPolicy => "Disabled by group policy",
                    NotificationSetting::DisabledByManifest => "Disabled by manifest",
                    _ => "Unknown",
                }
            ),
            Err(e) => format!(
                "Windows notifier unavailable: {e}. Install Reprise to register its app identity."
            ),
        }
    }
    #[cfg(not(windows))]
    {
        let _ = id;
        "Windows notifications are unavailable on this platform".into()
    }
}
