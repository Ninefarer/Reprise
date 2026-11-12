use crate::domain::*;
use rusqlite::{params, Connection, OptionalExtension};
use serde_json::{json, Value};
pub type Result<T> = std::result::Result<T, String>;
fn err(e: impl std::fmt::Display) -> String {
    e.to_string()
}
pub struct Store {
    pub conn: Connection,
}
impl Store {
    pub fn sidebar_preferences(
        &self,
        width: Option<u16>,
        collapsed: Option<bool>,
        groups: Option<std::collections::BTreeMap<String, bool>>,
    ) -> Result<()> {
        let mut s = self.settings()?;
        if let Some(w) = width {
            s.sidebar_width = w.clamp(190, 340);
        }
        if let Some(c) = collapsed {
            s.sidebar_collapsed = c;
        }
        if let Some(groups) = groups {
            for (id, expanded) in groups {
                if !["general", "tasks", "history", "app"].contains(&id.as_str()) {
                    return Err("Unknown navigation group".into());
                }
                s.sidebar_groups.insert(id, expanded);
            }
        }
        self.set_settings(&s)
    }
    /// Permanently remove a task and its owned records in one transaction.
    /// Children are retained, with their parent reference cleared.
    pub fn delete_task(&mut self, id: &str, expected_updated_at: i64) -> Result<()> {
        let task = self.task(id)?;
        if task.updated_at != expected_updated_at {
            return Err("This task changed elsewhere. Reload it before deleting.".into());
        }
        let tx = self.conn.transaction().map_err(err)?;
        tx.execute("DELETE FROM events WHERE task_id=?1", [id])
            .map_err(err)?;
        tx.execute("DELETE FROM history WHERE task_id=?1", [id])
            .map_err(err)?;
        tx.execute("DELETE FROM notifications WHERE task_id=?1", [id])
            .map_err(err)?;
        tx.execute("UPDATE tasks SET data=json_set(data,'$.parent_task_id',NULL,'$.updated_at',json_extract(data,'$.updated_at')+1) WHERE json_extract(data,'$.parent_task_id')=?1", [id]).map_err(err)?;
        tx.execute("DELETE FROM tasks WHERE id=?1", [id])
            .map_err(err)?;
        tx.commit().map_err(err)
    }
    pub fn open(path: &std::path::Path) -> Result<Self> {
        let conn = Connection::open(path).map_err(err)?;
        Self::init(conn)
    }
    pub fn init(conn: Connection) -> Result<Self> {
        let version: i64 = conn
            .query_row("PRAGMA user_version", [], |r| r.get(0))
            .map_err(err)?;
        if version > 3 {
            return Err("This database requires a newer Reprise version.".into());
        }
        conn.execute_batch("PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
  BEGIN;
  CREATE TABLE IF NOT EXISTS tasks(id TEXT PRIMARY KEY, data TEXT NOT NULL CHECK(json_valid(data)));
  CREATE TABLE IF NOT EXISTS settings(id INTEGER PRIMARY KEY CHECK(id=1), data TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS events(id TEXT PRIMARY KEY,task_id TEXT REFERENCES tasks(id),category TEXT NOT NULL,at INTEGER NOT NULL,processed INTEGER NOT NULL DEFAULT 0);
  CREATE INDEX IF NOT EXISTS due_events ON events(processed,at);
  CREATE TABLE IF NOT EXISTS history(id INTEGER PRIMARY KEY,task_id TEXT NOT NULL REFERENCES tasks(id),at INTEGER NOT NULL,action TEXT NOT NULL,before_data TEXT,after_data TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS notifications(id TEXT PRIMARY KEY,task_id TEXT REFERENCES tasks(id),category TEXT NOT NULL,title TEXT NOT NULL,message TEXT NOT NULL,created_at INTEGER NOT NULL,scheduled_at INTEGER NOT NULL,submitted_at INTEGER,state TEXT NOT NULL DEFAULT 'Pending',unread INTEGER NOT NULL DEFAULT 1,interaction_at INTEGER,action TEXT);
  COMMIT;").map_err(err)?;
        if version < 2 {
            conn.execute_batch("BEGIN; ALTER TABLE notifications ADD COLUMN error TEXT; PRAGMA user_version=2; COMMIT;").map_err(err)?;
        }
        if version < 3 {
            conn.execute_batch("BEGIN; CREATE TABLE IF NOT EXISTS retired_notifications(id TEXT PRIMARY KEY,at INTEGER NOT NULL); PRAGMA user_version=3; COMMIT;").map_err(err)?;
        }
        Ok(Self { conn })
    }
    pub fn settings(&self) -> Result<Settings> {
        let s: Option<String> = self
            .conn
            .query_row("SELECT data FROM settings WHERE id=1", [], |r| r.get(0))
            .optional()
            .map_err(err)?;
        s.map(|v| serde_json::from_str(&v).map_err(err))
            .unwrap_or(Ok(Settings::default()))
    }
    pub fn set_settings(&self, s: &Settings) -> Result<()> {
        self.conn
            .execute(
                "INSERT OR REPLACE INTO settings VALUES(1,?1)",
                [serde_json::to_string(s).map_err(err)?],
            )
            .map_err(err)?;
        Ok(())
    }
    pub fn tasks(&self) -> Result<Vec<Task>> {
        let mut st = self
            .conn
            .prepare("SELECT data FROM tasks ORDER BY json_extract(data,'$.created_at') DESC")
            .map_err(err)?;
        let rows = st.query_map([], |r| r.get::<_, String>(0)).map_err(err)?;
        rows.map(|r| serde_json::from_str(&r.map_err(err)?).map_err(err))
            .collect()
    }
    pub fn task(&self, id: &str) -> Result<Task> {
        let data: String = self
            .conn
            .query_row("SELECT data FROM tasks WHERE id=?1", [id], |r| r.get(0))
            .map_err(err)?;
        serde_json::from_str(&data).map_err(err)
    }
    pub fn save(&mut self, mut t: Task, action: &str, now: i64) -> Result<Task> {
        t.title = t.title.trim().into();
        t.validate()?;
        let before = self.task(&t.id).ok();
        if let Some(b) = &before {
            if b.updated_at != t.updated_at {
                return Err("This task changed elsewhere. Reload and try again.".into());
            }
            t.created_at = b.created_at;
        }
        t.updated_at = before
            .as_ref()
            .map(|b| (b.updated_at + 1).max(now))
            .unwrap_or(now);
        if action == "Settled" {
            t.settled_at = Some(now);
        } else if action != "Undone" {
            if let Some(b) = &before {
                t.settled_at = b.settled_at;
                t.settlement_mode = b.settlement_mode.clone();
            }
        }
        if action != "Undone" {
            t.completed_at = if t.status == Status::Finished {
                before.as_ref().and_then(|b| b.completed_at).or(Some(now))
            } else {
                None
            };
        }
        if action != "Edited" && action != "Undone" {
            t.review_at = None;
            t.review_reason = None;
        }
        if !matches!(
            t.status,
            Status::Settled | Status::Snoozed | Status::Waiting
        ) {
            t.wake_at = None;
        }
        let restore_notices: Vec<String> = if action == "Undone" {
            let after: String = self
                .conn
                .query_row(
                    "SELECT after_data FROM history WHERE task_id=?1 ORDER BY id DESC LIMIT 1",
                    [&t.id],
                    |r| r.get(0),
                )
                .map_err(err)?;
            serde_json::from_str::<Value>(&after)
                .map_err(err)?
                .get("_cancelled_notice_ids")
                .and_then(|v| serde_json::from_value(v.clone()).ok())
                .unwrap_or_default()
        } else {
            Vec::new()
        };
        let data = serde_json::to_string(&t).map_err(err)?;
        let tx = self.conn.transaction().map_err(err)?;
        tx.execute(
            "INSERT OR REPLACE INTO tasks VALUES(?1,?2)",
            params![t.id, data],
        )
        .map_err(err)?;
        let cancelled_notices: Vec<String> = {
            let mut q=tx.prepare("SELECT id FROM notifications WHERE task_id=?1 AND state='Pending' AND (category IN ('Snoozed','Settled','Waiting') OR ?2 OR (category='Scheduled' AND scheduled_at IS NOT ?3) OR (category='Deadline' AND scheduled_at IS NOT ?4))").map_err(err)?;
            let rows = q
                .query_map(
                    params![
                        t.id,
                        matches!(t.status, Status::Finished | Status::Dropped),
                        t.scheduled_at,
                        t.due_at
                    ],
                    |r| r.get::<_, String>(0),
                )
                .map_err(err)?;
            rows.collect::<std::result::Result<_, _>>().map_err(err)?
        };
        let mut history_data = serde_json::from_str::<Value>(&data).map_err(err)?;
        history_data["_cancelled_notice_ids"] = json!(cancelled_notices);
        tx.execute(
            "INSERT INTO history(task_id,at,action,before_data,after_data) VALUES(?1,?2,?3,?4,?5)",
            params![
                t.id,
                now,
                action,
                before.as_ref().map(|b| serde_json::to_string(b).unwrap()),
                history_data.to_string()
            ],
        )
        .map_err(err)?;
        tx.execute(
            "DELETE FROM events WHERE task_id=?1 AND processed=0",
            [&t.id],
        )
        .map_err(err)?;
        for notice_id in &cancelled_notices {
            tx.execute(
                "UPDATE notifications SET state='Cancelled' WHERE id=?1",
                [notice_id],
            )
            .map_err(err)?;
        }
        // Restore only pending notices cancelled by the transition being undone.
        // Submitted, dismissed and permanently cleared notices must stay untouched.
        for notice_id in restore_notices {
            tx.execute("UPDATE notifications SET state='Pending' WHERE id=?1 AND task_id=?2 AND state='Cancelled' AND id NOT IN (SELECT id FROM retired_notifications)",params![notice_id,t.id]).map_err(err)?;
        }
        if !matches!(t.status, Status::Finished | Status::Dropped) {
            for (category, time) in [
                ("Scheduled", t.scheduled_at),
                ("Deadline", t.due_at),
                (
                    match t.status {
                        Status::Settled => "Settled",
                        Status::Waiting => "Waiting",
                        _ => "Snoozed",
                    },
                    if t.review_at.is_none() {
                        t.wake_at
                    } else {
                        None
                    },
                ),
            ] {
                if let Some(at) = time {
                    let id = if ["Settled", "Snoozed", "Waiting"].contains(&category) {
                        format!("{}:{}:{}:{}", t.id, category, at, t.updated_at)
                    } else {
                        format!("{}:{}:{}", t.id, category, at)
                    };
                    tx.execute(
                        "INSERT OR IGNORE INTO events(id,task_id,category,at) VALUES(?1,?2,?3,?4)",
                        params![id, t.id, category, at],
                    )
                    .map_err(err)?;
                }
            }
        }
        tx.commit().map_err(err)?;
        Ok(t)
    }
    pub fn reconcile(&mut self, now: i64) -> Result<()> {
        let due: Vec<(String, String, String, i64)> = {
            let mut q=self.conn.prepare("SELECT id,task_id,category,at FROM events WHERE processed=0 AND at<=?1 ORDER BY at").map_err(err)?;
            let r = q
                .query_map([now], |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?)))
                .map_err(err)?;
            r.collect::<std::result::Result<_, _>>().map_err(err)?
        };
        for (id, task_id, category, at) in due {
            let mut task = self.task(&task_id)?;
            let before = serde_json::to_string(&task).map_err(err)?;
            let tx = self.conn.transaction().map_err(err)?;
            if ["Snoozed", "Settled", "Waiting"].contains(&category.as_str()) {
                task.review_at = Some(now);
                task.review_reason = Some(format!("{} reminder", category));
                task.updated_at = (task.updated_at + 1).max(now);
                let data = serde_json::to_string(&task).map_err(err)?;
                tx.execute(
                    "UPDATE tasks SET data=?1 WHERE id=?2",
                    params![data, task_id],
                )
                .map_err(err)?;
                tx.execute("INSERT INTO history(task_id,at,action,before_data,after_data) VALUES(?1,?2,'Resurfaced',?3,?4)",params![task_id,now,before,data]).map_err(err)?;
            }
            tx.execute("INSERT OR IGNORE INTO notifications(id,task_id,category,title,message,created_at,scheduled_at) VALUES(?1,?2,?3,?4,?5,?6,?7)",params![id,task_id,category,task.title,"Your intention is ready for another look.",now,at]).map_err(err)?;
            tx.execute("UPDATE events SET processed=1 WHERE id=?1", [id])
                .map_err(err)?;
            tx.commit().map_err(err)?;
        }
        Ok(())
    }
    pub fn history(&self, id: &str) -> Result<Vec<Value>> {
        let mut q=self.conn.prepare("SELECT at,action,before_data,after_data FROM history WHERE task_id=?1 ORDER BY id DESC").map_err(err)?;
        let r=q.query_map([id],|r|Ok(json!({"at":r.get::<_,i64>(0)?,"action":r.get::<_,String>(1)?,"before":r.get::<_,Option<String>>(2)?,"after":r.get::<_,String>(3)?}))).map_err(err)?;
        r.collect::<std::result::Result<_, _>>().map_err(err)
    }
}
