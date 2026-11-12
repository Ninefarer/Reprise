//! Durable reminder reconciliation and Windows submission. No frontend timers.
use crate::{diagnostics, domain::quiet, Db};
use tauri::{Emitter, Manager};
fn tick(handle: &tauri::AppHandle, now: i64) -> Result<(), String> {
    let state = handle.state::<Db>();
    let mut db = state.lock().map_err(|e| e.to_string())?;
    db.reconcile(now)?;
    db.daily_review(now)?;
    let s = db.settings()?;
    let time = chrono::Local::now().format("%H:%M").to_string();
    if !s.notifications || s.paused || quiet(&time, &s.quiet_start, &s.quiet_end) {
        return Ok(());
    }
    // Old review summaries remain in history but must not be delivered on a later day.
    let today = chrono::Local::now().date_naive();
    for n in db
        .notices()?
        .into_iter()
        .filter(|n| n.state == "Pending" && n.category == "DailyReview")
    {
        if chrono::DateTime::from_timestamp(n.scheduled_at, 0)
            .is_some_and(|d| d.with_timezone(&chrono::Local).date_naive() != today)
        {
            db.conn
                .execute(
                    "UPDATE notifications SET state='Cancelled' WHERE id=?1",
                    [n.id],
                )
                .map_err(|e| e.to_string())?;
        }
    }
    let pending: Vec<_> = db
        .notices()?
        .into_iter()
        .filter(|n| n.state == "Pending" && s.categories.contains(&n.category))
        .collect();
    if pending.is_empty() {
        return Ok(());
    }
    let content = crate::toasts::content(&pending, &db.tasks()?);
    let result = crate::toasts::send(
        handle,
        &content,
        pending.iter().map(|n| n.id.clone()).collect(),
        pending.iter().any(|n| n.category == "DailyReview"),
        if pending.len() == 1 {
            pending[0].task_id.clone()
        } else {
            None
        },
    );
    let tx = db.conn.transaction().map_err(|e| e.to_string())?;
    for n in pending {
        tx.execute(
            "UPDATE notifications SET state=?1,submitted_at=?2,error=?4 WHERE id=?3",
            rusqlite::params![
                if result.is_ok() {
                    "Submitted"
                } else {
                    "Failed"
                },
                if result.is_ok() { Some(now) } else { None },
                n.id,
                result.as_ref().err().map(|e| e.to_string())
            ],
        )
        .map_err(|e| e.to_string())?;
    }
    tx.commit().map_err(|e| e.to_string())
}
pub fn start(handle: tauri::AppHandle) {
    std::thread::spawn(move || loop {
        let now = chrono::Utc::now().timestamp();
        let result = tick(&handle, now);
        if let Ok(mut health) = handle.state::<diagnostics::RuntimeHealth>().lock() {
            health.heartbeat = Some(now);
            health.scheduler_error = result.err();
        }
        let _ = handle.emit("refresh", ());
        std::thread::sleep(std::time::Duration::from_secs(15));
    });
}

/// A genuine native activation is an interaction, never an inferred delivery receipt.
pub fn activate(app: &tauri::AppHandle, ids: &[String], review: bool, task_id: Option<String>) {
    if let Ok(db) = app.state::<Db>().lock() {
        for id in ids {
            if let Err(error)=db.conn.execute("UPDATE notifications SET state='Opened',unread=0,interaction_at=?2,action='Opened' WHERE id=?1 AND id NOT IN (SELECT id FROM retired_notifications)",rusqlite::params![id,chrono::Utc::now().timestamp()]) {eprintln!("Notification interaction: {error}");}
        }
    }
    crate::visuals::request_dashboard(app);
    let _ = app.emit(
        "notification-route",
        serde_json::json!({"review":review,"task_id":task_id}),
    );
    let _ = app.emit("refresh", ());
}
