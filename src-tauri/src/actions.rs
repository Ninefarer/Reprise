use crate::{
    domain::*,
    store::{Result, Store},
};
use rusqlite::params;
impl Store {
    pub fn resume(&mut self, id: &str, revision: i64, now: i64) -> Result<Task> {
        let current = self.task(id)?;
        if current.updated_at != revision {
            return Err("Task changed. Reopen it and try again.".into());
        }
        if !matches!(current.status, Status::Settled | Status::Waiting) {
            return Err("Only Settled and Waiting tasks can be resumed.".into());
        }
        let mut task = current.clone();
        task.status = Status::Inbox;
        for h in self.history(id)? {
            if let Some(raw) = h["before"].as_str() {
                if let Ok(old) = serde_json::from_str::<Task>(raw) {
                    if matches!(
                        old.status,
                        Status::Inbox | Status::DoNow | Status::Scheduled
                    ) {
                        task.status =
                            if old.status == Status::Scheduled && task.scheduled_at.is_none() {
                                Status::Inbox
                            } else {
                                old.status
                            };
                        break;
                    }
                }
            }
        }
        self.save(task, "Resumed", now)
    }
    pub fn surface_now(&mut self, id: &str, revision: i64, now: i64) -> Result<Task> {
        let mut task = self.task(id)?;
        if task.updated_at != revision {
            return Err("Task changed. Reopen it and try again.".into());
        }
        if !matches!(task.status, Status::Settled | Status::Snoozed) || task.review_at.is_some() {
            return Err("This task is not awaiting a return time.".into());
        }
        let before = serde_json::to_string(&task).map_err(|e| e.to_string())?;
        let category = if task.status == Status::Settled {
            "Settled"
        } else {
            "Snoozed"
        };
        task.wake_at = None;
        task.review_at = Some(now);
        task.review_reason = Some(
            if category == "Settled" {
                "Returned early from settlement"
            } else {
                "Woken early from snooze"
            }
            .into(),
        );
        task.updated_at = (task.updated_at + 1).max(now);
        let after = serde_json::to_string(&task).map_err(|e| e.to_string())?;
        let tx = self.conn.transaction().map_err(|e| e.to_string())?;
        tx.execute("UPDATE tasks SET data=?1 WHERE id=?2", params![after, id])
            .map_err(|e| e.to_string())?;
        tx.execute(
            "UPDATE events SET processed=1 WHERE task_id=?1 AND category=?2 AND processed=0",
            params![id, category],
        )
        .map_err(|e| e.to_string())?;
        tx.execute("UPDATE notifications SET state='Cancelled' WHERE task_id=?1 AND category=?2 AND state='Pending'",params![id,category]).map_err(|e|e.to_string())?;
        tx.execute(
            "INSERT INTO history(task_id,at,action,before_data,after_data) VALUES(?1,?2,?3,?4,?5)",
            params![
                id,
                now,
                if category == "Settled" {
                    "ResurfaceNow"
                } else {
                    "WakeNow"
                },
                before,
                after
            ],
        )
        .map_err(|e| e.to_string())?;
        tx.commit().map_err(|e| e.to_string())?;
        Ok(task)
    }
    pub fn undo(&mut self, id: &str, revision: i64, now: i64) -> Result<Task> {
        let current = self.task(id)?;
        if current.updated_at != revision {
            return Err("This task changed again; undo is no longer available.".into());
        }
        let (at,action,before):(i64,String,Option<String>)=self.conn.query_row("SELECT at,action,before_data FROM history WHERE task_id=?1 ORDER BY id DESC LIMIT 1",[id],|r|Ok((r.get(0)?,r.get(1)?,r.get(2)?))).map_err(|e|e.to_string())?;
        if now < at
            || now - at > 30
            || ["Edited", "Created", "Undone", "Resurfaced"].contains(&action.as_str())
        {
            return Err("Undo is no longer available.".into());
        }
        let mut old: Task = serde_json::from_str(&before.ok_or("No previous task state")?)
            .map_err(|e| e.to_string())?;
        old.updated_at = revision;
        self.save(old, "Undone", now)
    }
}
