//! Local notification history and management; Windows delivery belongs to scheduler.
use crate::{
    domain::*,
    store::{Result, Store},
    Db,
};
use rusqlite::params;
use serde::Serialize;
use tauri::Emitter;
fn err(e: impl std::fmt::Display) -> String {
    e.to_string()
}
#[derive(Serialize)]
pub struct Notice {
    pub id: String,
    pub task_id: Option<String>,
    pub category: String,
    pub title: String,
    pub message: String,
    pub created_at: i64,
    pub scheduled_at: i64,
    pub submitted_at: Option<i64>,
    pub state: String,
    pub read: bool,
    pub interaction_at: Option<i64>,
    pub action: Option<String>,
    pub error: Option<String>,
}
impl Store {
    pub fn daily_review(&self, now: i64) -> Result<()> {
        let s = self.settings()?;
        if !s.daily_review {
            return Ok(());
        }
        let local = chrono::DateTime::from_timestamp(now, 0)
            .ok_or("Invalid timestamp")?
            .with_timezone(&chrono::Local);
        let at = local_time(&chrono::Local, local.date_naive(), &s.review_time)?;
        if now < at {
            return Ok(());
        }
        let id = format!("review:{}", local.date_naive());
        let retired: bool = self
            .conn
            .query_row(
                "SELECT EXISTS(SELECT 1 FROM retired_notifications WHERE id=?1)",
                [&id],
                |r| r.get(0),
            )
            .map_err(err)?;
        if retired {
            return Ok(());
        }
        let tasks = self.tasks()?;
        let count = tasks
            .iter()
            .filter(|t| {
                !matches!(t.status, Status::Finished | Status::Dropped)
                    && (t.status == Status::Inbox
                        || t.review_at.is_some()
                        || t.due_at.is_some_and(|d| d < now)
                        || (t.status == Status::Waiting && t.wake_at.is_some_and(|d| d <= now))
                        || t.scheduled_at.is_some_and(|d| {
                            chrono::DateTime::from_timestamp(d, 0).is_some_and(|d| {
                                d.with_timezone(&chrono::Local).date_naive() == local.date_naive()
                            })
                        }))
            })
            .count();
        if count == 0 {
            self.conn
                .execute(
                    "INSERT OR IGNORE INTO retired_notifications(id,at) VALUES(?1,?2)",
                    params![id, now],
                )
                .map_err(err)?;
            return Ok(());
        }
        let noun = if count == 1 { "task" } else { "tasks" };
        self.conn.execute("INSERT OR IGNORE INTO notifications(id,category,title,message,created_at,scheduled_at) VALUES(?1,'DailyReview','A moment to return',?2,?3,?4)",params![id,format!("You have {count} {noun} waiting for your attention."),now,at]).map_err(err)?;
        Ok(())
    }
    pub fn notices(&self) -> Result<Vec<Notice>> {
        let mut q=self.conn.prepare("SELECT id,task_id,category,title,message,created_at,scheduled_at,submitted_at,state,unread,interaction_at,action,error FROM notifications WHERE id NOT IN (SELECT id FROM retired_notifications) ORDER BY created_at DESC").map_err(err)?;
        let r = q
            .query_map([], |r| {
                Ok(Notice {
                    id: r.get(0)?,
                    task_id: r.get(1)?,
                    category: r.get(2)?,
                    title: r.get(3)?,
                    message: r.get(4)?,
                    created_at: r.get(5)?,
                    scheduled_at: r.get(6)?,
                    submitted_at: r.get(7)?,
                    state: r.get(8)?,
                    read: !r.get::<_, bool>(9)?,
                    interaction_at: r.get(10)?,
                    action: r.get(11)?,
                    error: r.get(12)?,
                })
            })
            .map_err(err)?;
        r.collect::<std::result::Result<_, _>>().map_err(err)
    }
    /// Snapshot IDs make bulk confirmation safe against reminders arriving meanwhile.
    pub fn manage_notices(&mut self, action: &str, ids: &[String], now: i64) -> Result<()> {
        if !["read", "dismiss", "clear_read", "clear_all"].contains(&action) {
            return Err("Unknown notification action".into());
        }
        let tx = self.conn.transaction().map_err(err)?;
        for id in ids {
            if action == "read" {
                tx.execute("UPDATE notifications SET unread=0,interaction_at=?2,action='Read' WHERE id=?1 AND id NOT IN (SELECT id FROM retired_notifications)",params![id,now]).map_err(err)?;
            } else {
                let eligible: bool = tx.query_row("SELECT EXISTS(SELECT 1 FROM notifications WHERE id=?1 AND (?2<>'clear_read' OR unread=0))",params![id,action],|r|r.get(0)).map_err(err)?;
                if !eligible {
                    continue;
                }
                let installing: bool = tx.query_row("SELECT state IN ('UpdateDownloading','UpdateInstalling') FROM notifications WHERE id=?1", [id], |r|r.get(0)).map_err(err)?;
                if installing {
                    return Err(
                        "Wait for the update operation to finish before removing its notification."
                            .into(),
                    );
                }
                tx.execute(
                    "INSERT OR IGNORE INTO retired_notifications(id,at) VALUES(?1,?2)",
                    params![id, now],
                )
                .map_err(err)?;
                if action != "dismiss" {
                    tx.execute("DELETE FROM notifications WHERE id=?1", [id])
                        .map_err(err)?;
                }
            }
        }
        tx.commit().map_err(err)
    }
}
#[tauri::command]
pub fn manage_notifications(
    app: tauri::AppHandle,
    db: tauri::State<Db>,
    action: String,
    ids: Vec<String>,
) -> Result<()> {
    db.lock()
        .map_err(err)?
        .manage_notices(&action, &ids, chrono::Utc::now().timestamp())?;
    app.emit("refresh", ()).map_err(err)
}
