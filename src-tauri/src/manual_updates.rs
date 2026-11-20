//! A user-requested check always leaves a visible result, independent of automatic deduplication.
use crate::{
    store::Store,
    updates::{self, CheckResult, UpdateRuntime},
    Db,
};
use rusqlite::params;
use tauri::{Emitter, Manager};

fn reveal(d: &Store, result: CheckResult, current: &str, now: i64) -> Result<CheckResult, String> {
    let id = match result.notice_id {
        Some(id) => id,
        None => updates::record_check(d, "unconfigured", current, None, now)?,
    };
    let tx = d.conn.unchecked_transaction().map_err(|e| e.to_string())?;
    // Clearing suppresses automatic offers; an explicit check asks to see the result again.
    tx.execute("DELETE FROM retired_notifications WHERE id=?1", [&id])
        .map_err(|e| e.to_string())?;
    if let Some(version) = id.strip_prefix("update:available:") {
        semver::Version::parse(version).map_err(|e| e.to_string())?;
        tx.execute("INSERT INTO notifications(id,category,title,message,created_at,scheduled_at,state) VALUES(?1,'Updates',?2,'Click to download the update and restart Reprise.',?3,?3,'UpdateAvailable') ON CONFLICT(id) DO UPDATE SET unread=1,created_at=excluded.created_at,interaction_at=NULL,action=NULL", params![id,format!("Reprise v{version} is available"),now]).map_err(|e| e.to_string())?;
    } else {
        tx.execute("UPDATE notifications SET unread=1,created_at=?2,interaction_at=NULL,action=NULL WHERE id=?1",params![id,now]).map_err(|e| e.to_string())?;
    }
    let message: String = tx
        .query_row("SELECT title FROM notifications WHERE id=?1", [&id], |r| {
            r.get(0)
        })
        .map_err(|e| e.to_string())?;
    tx.commit().map_err(|e| e.to_string())?;
    Ok(CheckResult {
        notice_id: Some(id),
        message: Some(message),
    })
}

#[tauri::command]
pub async fn check_updates_now(
    app: tauri::AppHandle,
    runtime: tauri::State<'_, UpdateRuntime>,
) -> Result<CheckResult, String> {
    let checked = updates::check_updates(app.clone(), runtime, Some(false)).await;
    let current = app.package_info().version.to_string();
    let state = app.state::<Db>();
    let d = state.lock().map_err(|e| e.to_string())?;
    let now = chrono::Utc::now().timestamp();
    let result = match checked {
        Ok(result) => result,
        Err(error) => CheckResult {
            notice_id: Some(updates::record_check(
                &d,
                "error",
                &current,
                Some(&error),
                now,
            )?),
            message: None,
        },
    };
    let result = reveal(&d, result, &current, now)?;
    drop(d);
    let _ = app.emit("refresh", ());
    Ok(result)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn manual_checks_restore_cleared_offers_without_changing_automatic_deduplication() {
        let mut d = Store::init(rusqlite::Connection::open_in_memory().unwrap()).unwrap();
        let id = updates::record_check(&d, "available", "3.4.5", None, 100).unwrap();
        d.manage_notices("clear_all", std::slice::from_ref(&id), 101)
            .unwrap();
        assert!(d.notices().unwrap().is_empty());
        updates::record_check(&d, "available", "3.4.5", None, 102).unwrap();
        assert!(d.notices().unwrap().is_empty());
        let result = reveal(
            &d,
            CheckResult {
                notice_id: Some(id.clone()),
                message: None,
            },
            "3.4.4",
            103,
        )
        .unwrap();
        assert_eq!(result.notice_id, Some(id.clone()));
        assert_eq!(d.notices().unwrap().len(), 1);
        assert!(!d.notices().unwrap()[0].read);
        assert_eq!(updates::offer_version(&d, &id).unwrap(), "3.4.5");
        d.manage_notices("read", std::slice::from_ref(&id), 104)
            .unwrap();
        reveal(
            &d,
            CheckResult {
                notice_id: Some(id),
                message: None,
            },
            "3.4.4",
            105,
        )
        .unwrap();
        assert_eq!(d.notices().unwrap().len(), 1);
        assert!(!d.notices().unwrap()[0].read);
    }
    #[test]
    fn manual_unconfigured_and_error_results_are_visible_history_only() {
        let d = Store::init(rusqlite::Connection::open_in_memory().unwrap()).unwrap();
        reveal(
            &d,
            CheckResult {
                notice_id: None,
                message: Some("No feed".into()),
            },
            "3.4.4",
            100,
        )
        .unwrap();
        let id = updates::record_check(&d, "error", "3.4.4", Some("offline"), 101).unwrap();
        reveal(
            &d,
            CheckResult {
                notice_id: Some(id),
                message: None,
            },
            "3.4.4",
            101,
        )
        .unwrap();
        let notices = d.notices().unwrap();
        assert_eq!(notices.len(), 2);
        assert!(notices
            .iter()
            .all(|n| n.category == "Updates" && n.state != "Pending"));
    }
}
