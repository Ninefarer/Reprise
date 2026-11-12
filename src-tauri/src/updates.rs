use crate::{store::Store, Db};
use rusqlite::{params, OptionalExtension};
use serde::Serialize;
use std::{
    sync::atomic::{AtomicBool, Ordering},
    time::{Duration, Instant},
};
use tauri::{Emitter, Manager};
use tauri_plugin_updater::{Update, UpdaterExt};

#[derive(Default)]
pub struct UpdateRuntime {
    busy: AtomicBool,
}
struct Operation<'a>(&'a AtomicBool);
impl Drop for Operation<'_> {
    fn drop(&mut self) {
        self.0.store(false, Ordering::Release);
    }
}
impl UpdateRuntime {
    fn begin(&self) -> Result<Operation<'_>, String> {
        self.busy
            .compare_exchange(false, true, Ordering::AcqRel, Ordering::Acquire)
            .map_err(|_| "An update operation is already running".to_string())?;
        Ok(Operation(&self.busy))
    }
}
#[derive(Serialize)]
pub struct CheckResult {
    pub notice_id: Option<String>,
    pub message: Option<String>,
}
#[derive(Clone, Serialize)]
struct Progress {
    notice_id: String,
    stage: &'static str,
    downloaded: u64,
    total: Option<u64>,
}

pub fn configured(value: Option<&serde_json::Value>) -> Result<bool, String> {
    let Some(value) = value else { return Ok(false) };
    let endpoints = value.get("endpoints").and_then(|v| v.as_array());
    let pubkey = value.get("pubkey").and_then(|v| v.as_str()).unwrap_or("");
    if endpoints.is_none_or(|v| v.is_empty()) || pubkey.trim().is_empty() {
        return Ok(false);
    }
    for endpoint in endpoints.unwrap() {
        let endpoint = endpoint.as_str().ok_or("Invalid update endpoint")?;
        if !endpoint.starts_with("https://") || endpoint.contains('@') {
            return Err("The update feed must use HTTPS without embedded credentials".into());
        }
    }
    if value.get("requireSignedVersion").and_then(|v| v.as_bool()) != Some(true) {
        return Err("Signed update versions must be required".into());
    }
    Ok(true)
}

// These are local history entries, never Pending Windows notifications.
pub fn record_check(
    d: &Store,
    kind: &str,
    version: &str,
    error: Option<&str>,
    now: i64,
) -> Result<String, String> {
    let (id, title, message, state) = match kind {
        "available" => {
            semver::Version::parse(version).map_err(|_| "Invalid update version")?;
            (
                format!("update:available:{version}"),
                format!("Reprise v{version} is available"),
                "Click to download the update and restart Reprise.".to_string(),
                "UpdateAvailable",
            )
        }
        "current" => (
            format!("update:check:{kind}"),
            "You're up to date".into(),
            format!("Reprise v{version} is the latest available version."),
            "UpdateCurrent",
        ),
        "unconfigured" => (
            format!("update:check:{kind}"),
            "Update source not configured".into(),
            "The release repository hasn't been connected yet. Check again once it's ready.".into(),
            "UpdateNotConfigured",
        ),
        _ => (
            format!("update:check:{kind}"),
            "Couldn't check for updates".into(),
            "The update service couldn't be checked. Try again later.".into(),
            "UpdateError",
        ),
    };
    if kind == "available"
        && d.conn
            .query_row(
                "SELECT EXISTS(SELECT 1 FROM retired_notifications WHERE id=?1)",
                [&id],
                |r| r.get::<_, bool>(0),
            )
            .map_err(|e| e.to_string())?
    {
        return Ok(id);
    }
    let tx = d.conn.unchecked_transaction().map_err(|e| e.to_string())?;
    if kind == "available" || kind == "current" {
        tx.execute("UPDATE notifications SET state='UpdateSuperseded' WHERE category='Updates' AND state IN ('UpdateAvailable','UpdateError') AND id<>?1",[&id]).map_err(|e|e.to_string())?;
    }
    tx.execute("INSERT INTO notifications(id,category,title,message,created_at,scheduled_at,state,error) VALUES(?1,'Updates',?2,?3,?4,?4,?5,?6) ON CONFLICT(id) DO UPDATE SET title=excluded.title,message=excluded.message,created_at=excluded.created_at,scheduled_at=excluded.scheduled_at,state=excluded.state,error=excluded.error,unread=1",params![id,title,message,now,state,error]).map_err(|e|e.to_string())?;
    tx.commit().map_err(|e| e.to_string())?;
    Ok(id)
}
pub fn offer_version(d: &Store, id: &str) -> Result<String, String> {
    let found: Option<(String, String)> = d
        .conn
        .query_row(
            "SELECT category,state FROM notifications WHERE id=?1",
            [id],
            |r| Ok((r.get(0)?, r.get(1)?)),
        )
        .optional()
        .map_err(|e| e.to_string())?;
    let (category, state) = found.ok_or("This update notification is no longer available")?;
    if category != "Updates" || !["UpdateAvailable", "UpdateError"].contains(&state.as_str()) {
        return Err("Check for updates again before installing".into());
    }
    let version = id
        .strip_prefix("update:available:")
        .ok_or("Invalid update notification")?;
    semver::Version::parse(version).map_err(|_| "Invalid update version")?;
    Ok(version.into())
}
pub fn reconcile(d: &Store, current: &str) -> Result<(), String> {
    let current = semver::Version::parse(current).map_err(|e| e.to_string())?;
    for n in d
        .notices()?
        .into_iter()
        .filter(|n| n.category == "Updates" && n.id.starts_with("update:available:"))
    {
        let Some(version) =
            n.id.strip_prefix("update:available:")
                .and_then(|v| semver::Version::parse(v).ok())
        else {
            continue;
        };
        if current.cmp_precedence(&version).is_ge() && n.state != "UpdateInstalled" {
            d.conn.execute("UPDATE notifications SET state='UpdateInstalled',title='Reprise updated',message=?2 WHERE id=?1",params![n.id,format!("You're running Reprise v{current}.")]).map_err(|e|e.to_string())?;
        } else if ["UpdateDownloading", "UpdateInstalling"].contains(&n.state.as_str()) {
            d.conn.execute("UPDATE notifications SET state='UpdateAvailable',message='The last update did not finish. Click to try again.',unread=1 WHERE id=?1",[n.id]).map_err(|e|e.to_string())?;
        }
    }
    Ok(())
}
fn refresh(app: &tauri::AppHandle) {
    let _ = app.emit("refresh", ());
}
fn checked_notice(
    app: &tauri::AppHandle,
    kind: &str,
    version: &str,
    error: Option<&str>,
) -> Result<CheckResult, String> {
    let state = app.state::<Db>();
    let d = state.lock().map_err(|e| e.to_string())?;
    let notice_id = record_check(&d, kind, version, error, chrono::Utc::now().timestamp())?;
    drop(d);
    refresh(app);
    Ok(CheckResult {
        notice_id: Some(notice_id),
        message: None,
    })
}
async fn remote(app: &tauri::AppHandle) -> Result<Option<Update>, String> {
    let update = app
        .updater_builder()
        .timeout(Duration::from_secs(20))
        .build()
        .map_err(|e| e.to_string())?
        .check()
        .await
        .map_err(|e| e.to_string())?;
    if let Some(ref update) = update {
        if update.download_url.scheme() != "https" || update.signature.trim().is_empty() {
            return Err("The update does not contain a secure signed download".into());
        }
    }
    Ok(update)
}
#[tauri::command]
pub async fn check_updates(
    app: tauri::AppHandle,
    runtime: tauri::State<'_, UpdateRuntime>,
) -> Result<CheckResult, String> {
    let _operation = runtime.begin()?;
    let current = app.package_info().version.to_string();
    match configured(app.config().plugins.0.get("updater")) {
        Ok(false) => return Ok(CheckResult { notice_id: None, message: Some("Update source not configured. Connect a signed release feed before checking for updates.".into()) }),
        Err(error) => return checked_notice(&app, "error", &current, Some(&error)),
        _ => {}
    }
    match remote(&app).await {
        Ok(Some(update)) => checked_notice(&app, "available", &update.version, None),
        Ok(None) => checked_notice(&app, "current", &current, None),
        Err(error) => checked_notice(&app, "error", &current, Some(&error)),
    }
}
fn stage(
    app: &tauri::AppHandle,
    id: &str,
    stage: &'static str,
    downloaded: u64,
    total: Option<u64>,
) {
    let _ = app.emit(
        "update-progress",
        Progress {
            notice_id: id.into(),
            stage,
            downloaded,
            total,
        },
    );
}
fn status(
    app: &tauri::AppHandle,
    id: &str,
    state: &str,
    message: &str,
    error: Option<&str>,
) -> Result<(), String> {
    let db = app.state::<Db>();
    let d = db.lock().map_err(|e| e.to_string())?;
    d.conn
        .execute(
            "UPDATE notifications SET state=?2,message=?3,error=?4 WHERE id=?1",
            params![id, state, message, error],
        )
        .map_err(|e| e.to_string())?;
    drop(d);
    refresh(app);
    Ok(())
}
async fn install_inner(app: &tauri::AppHandle, id: &str) -> Result<(), String> {
    if !configured(app.config().plugins.0.get("updater"))? {
        return Err("The update repository is not configured yet".into());
    }
    let expected = {
        let db = app.state::<Db>();
        let d = db.lock().map_err(|e| e.to_string())?;
        offer_version(&d, id)?
    };
    stage(app, id, "checking", 0, None);
    let Some(mut update) = remote(app).await? else {
        checked_notice(
            app,
            "current",
            &app.package_info().version.to_string(),
            None,
        )?;
        return Err("This update is no longer offered. Check the latest notification.".into());
    };
    if update.version != expected {
        checked_notice(app, "available", &update.version, None)?;
        return Err("A different release is available. Open its notification to update.".into());
    }
    update.timeout = Some(Duration::from_secs(300));
    status(
        app,
        id,
        "UpdateDownloading",
        "Downloading the update…",
        None,
    )?;
    stage(app, id, "downloading", 0, None);
    let mut downloaded = 0u64;
    let mut last = Instant::now();
    let bytes = update
        .download(
            |chunk, total| {
                downloaded = downloaded.saturating_add(chunk as u64);
                if last.elapsed() >= Duration::from_millis(120) {
                    stage(app, id, "downloading", downloaded, total);
                    last = Instant::now();
                }
            },
            || stage(app, id, "verifying", 0, None),
        )
        .await
        .map_err(|e| e.to_string())?;
    // download() verifies the signature and signed version before returning bytes.
    status(
        app,
        id,
        "UpdateInstalling",
        "Installing the update. Reprise will restart.",
        None,
    )?;
    {
        let db = app.state::<Db>();
        let d = db.lock().map_err(|e| e.to_string())?;
        d.conn
            .execute_batch("PRAGMA wal_checkpoint(FULL)")
            .map_err(|e| e.to_string())?;
    }
    stage(app, id, "installing", 0, None);
    update
        .restart_after_install(true)
        .install(&bytes)
        .map_err(|e| e.to_string())
}
#[tauri::command]
pub async fn install_update(
    notice_id: String,
    app: tauri::AppHandle,
    runtime: tauri::State<'_, UpdateRuntime>,
) -> Result<(), String> {
    let _operation = runtime.begin()?;
    let result = install_inner(&app, &notice_id).await;
    if let Err(ref error) = result {
        // Preserve supersession: an old notification must not become actionable again.
        let db = app.state::<Db>();
        let d = db.lock().map_err(|e| e.to_string())?;
        d.conn.execute("UPDATE notifications SET state='UpdateError',message='The update could not be installed. Click to try again.',error=?2 WHERE id=?1 AND category='Updates' AND state IN ('UpdateAvailable','UpdateError','UpdateDownloading','UpdateInstalling')",params![notice_id,error]).map_err(|e|e.to_string())?;
        drop(d);
        refresh(&app);
    }
    result
}

#[cfg(test)]
mod tests {
    use super::*;
    fn db() -> Store {
        Store::init(rusqlite::Connection::open_in_memory().unwrap()).unwrap()
    }
    #[test]
    fn absent_feed_is_not_reported_as_up_to_date() {
        assert!(!configured(None).unwrap());
        assert!(!configured(Some(&serde_json::json!({"endpoints":[],"pubkey":""}))).unwrap());
        let d = db();
        record_check(&d, "unconfigured", "3.1.1", None, 100).unwrap();
        let n = d.notices().unwrap().remove(0);
        assert_eq!(n.state, "UpdateNotConfigured");
        assert!(n.submitted_at.is_none());
        assert!(n.task_id.is_none());
        assert!(!n.title.contains("up to date"));
    }
    #[test]
    fn secure_feed_requires_signed_versions() {
        let value = serde_json::json!({"endpoints":["https://example.com/latest.json"],"pubkey":"public-key","requireSignedVersion":true});
        assert!(configured(Some(&value)).unwrap());
        let mut insecure = value.clone();
        insecure["endpoints"] = serde_json::json!(["http://example.com/latest.json"]);
        assert!(configured(Some(&insecure)).is_err());
        let mut unsigned = value;
        unsigned["requireSignedVersion"] = serde_json::json!(false);
        assert!(configured(Some(&unsigned)).is_err());
    }
    #[test]
    fn check_results_persist_without_native_submission_or_task_changes() {
        let d = db();
        record_check(&d, "current", "3.1.1", None, 100).unwrap();
        let d = Store::init(d.conn).unwrap();
        let n = d.notices().unwrap().remove(0);
        assert_eq!(n.title, "You're up to date");
        assert_eq!(n.state, "UpdateCurrent");
        assert!(!n.read);
        assert!(n.submitted_at.is_none());
        assert!(d.tasks().unwrap().is_empty());
    }
    #[test]
    fn offers_deduplicate_and_superseded_offers_cannot_install() {
        let d = db();
        let first = record_check(&d, "available", "3.2.0", None, 100).unwrap();
        assert_eq!(
            first,
            record_check(&d, "available", "3.2.0", None, 110).unwrap()
        );
        assert_eq!(d.notices().unwrap().len(), 1);
        assert_eq!(offer_version(&d, &first).unwrap(), "3.2.0");
        let next = record_check(&d, "available", "3.3.0", None, 120).unwrap();
        assert!(offer_version(&d, &first).is_err());
        assert_eq!(offer_version(&d, &next).unwrap(), "3.3.0");
        record_check(&d, "current", "3.3.0", None, 130).unwrap();
        assert!(offer_version(&d, &next).is_err());
    }
    #[test]
    fn interrupted_download_can_retry_and_new_version_reconciles_installation() {
        let d = db();
        let id = record_check(&d, "available", "3.2.0", None, 100).unwrap();
        d.conn
            .execute(
                "UPDATE notifications SET state='UpdateDownloading' WHERE id=?1",
                [&id],
            )
            .unwrap();
        let d = Store::init(d.conn).unwrap();
        reconcile(&d, "3.1.1").unwrap();
        assert!(offer_version(&d, &id).is_ok());
        d.conn
            .execute(
                "UPDATE notifications SET state='UpdateInstalling' WHERE id=?1",
                [&id],
            )
            .unwrap();
        reconcile(&d, "3.2.0").unwrap();
        assert_eq!(d.notices().unwrap()[0].state, "UpdateInstalled");
        assert!(offer_version(&d, &id).is_err());
    }
    #[test]
    fn concurrent_operations_are_rejected_and_guard_recovers() {
        let runtime = UpdateRuntime::default();
        let op = runtime.begin().unwrap();
        assert!(runtime.begin().is_err());
        drop(op);
        assert!(runtime.begin().is_ok());
    }
}

#[cfg(test)]
mod management_regressions {
    use super::*;
    #[test]
    fn repeated_checks_do_not_flood_and_dismissed_offers_stay_hidden() {
        let mut d = Store::init(rusqlite::Connection::open_in_memory().unwrap()).unwrap();
        for now in 1..10 {
            record_check(&d, "error", "3.2.0", Some("offline"), now).unwrap();
        }
        assert_eq!(d.notices().unwrap().len(), 1);
        let id = record_check(&d, "available", "3.3.0", None, 11).unwrap();
        d.manage_notices("dismiss", &[id], 12).unwrap();
        record_check(&d, "available", "3.3.0", None, 13).unwrap();
        assert!(d
            .notices()
            .unwrap()
            .iter()
            .all(|n| !n.id.starts_with("update:available:")));
    }
}
