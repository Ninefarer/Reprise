use crate::{
    domain::{Status, Task, AUTO_SETTLED_MODE},
    store::{Result, Store},
};
use rusqlite::params;

fn err(error: impl std::fmt::Display) -> String {
    error.to_string()
}

impl Store {
    fn auto_settle_candidates(&self, cutoff: i64) -> Result<Vec<Task>> {
        let mut query = self.conn.prepare(
            "SELECT t.data FROM tasks t
             JOIN history h ON h.id = (
                SELECT id FROM history WHERE task_id=t.id ORDER BY id DESC LIMIT 1
             )
             WHERE json_extract(t.data,'$.status')='Inbox' AND h.at<=?1
               AND (h.action='Created' OR (
                    h.action='Resumed' AND json_extract(h.before_data,'$.settlement_mode')='auto'
               ))
               AND NOT EXISTS(SELECT 1 FROM events WHERE task_id=t.id AND processed=0)
               AND NOT EXISTS(SELECT 1 FROM notifications WHERE task_id=t.id AND state='Pending' AND category<>'AutoSettled')",
        ).map_err(err)?;
        let rows = query
            .query_map([cutoff], |row| row.get::<_, String>(0))
            .map_err(err)?;
        let mut tasks = Vec::new();
        for row in rows {
            let task: Task = serde_json::from_str(&row.map_err(err)?).map_err(err)?;
            if task.scheduled_at.is_none()
                && task.due_at.is_none()
                && task.wake_at.is_none()
                && task.review_at.is_none()
                && task.recurrence.is_empty()
            {
                tasks.push(task);
            }
        }
        Ok(tasks)
    }

    pub fn auto_settle_preview(&self) -> Result<usize> {
        Ok(self.auto_settle_candidates(i64::MAX)?.len())
    }

    /// The scheduler holds the Store mutex throughout candidate selection and commit.
    pub fn auto_settle(&mut self, now: i64) -> Result<()> {
        let settings = self.settings()?;
        let days = settings.auto_settle_days;
        let Some(since) = settings.auto_settle_since else {
            return Ok(());
        };
        if ![3, 5, 7].contains(&days) {
            return Ok(());
        }
        let cutoff = now.saturating_sub(i64::from(days) * 86_400);
        if cutoff < since {
            return Ok(());
        }
        let tasks = self.auto_settle_candidates(cutoff)?;
        if tasks.is_empty() {
            return Ok(());
        }

        let tx = self.conn.transaction().map_err(err)?;
        for mut task in tasks.iter().cloned() {
            let before = serde_json::to_string(&task).map_err(err)?;
            task.status = Status::Settled;
            task.settlement_mode = Some(AUTO_SETTLED_MODE.into());
            task.settled_at = Some(now);
            task.updated_at = (task.updated_at + 1).max(now);
            let after = serde_json::to_string(&task).map_err(err)?;
            tx.execute(
                "UPDATE tasks SET data=?1 WHERE id=?2",
                params![after, task.id],
            )
            .map_err(err)?;
            let mut history = serde_json::to_value(&task).map_err(err)?;
            history["_auto_settle_days"] = days.into();
            tx.execute(
                "INSERT INTO history(task_id,at,action,before_data,after_data)
                 VALUES(?1,?2,'AutoSettled',?3,?4)",
                params![task.id, now, before, history.to_string()],
            )
            .map_err(err)?;
        }

        let (title, task_id) = if let [task] = tasks.as_slice() {
            (
                format!("Auto-settled: {}", task.title),
                Some(task.id.as_str()),
            )
        } else {
            (format!("{} tasks auto-settled", tasks.len()), None)
        };
        let mut message = format!("Moved to Settled after {days} days without a next step.");
        if !settings.auto_settle_explained {
            message.push_str(" Open Settled and choose Resume to bring a task back. Change Auto-Settle in Settings under Reminders.");
            tx.execute("UPDATE settings SET data=json_set(data,'$.auto_settle_explained',json('true')) WHERE id=1", []).map_err(err)?;
        }
        tx.execute(
            "INSERT INTO notifications(id,task_id,category,title,message,created_at,scheduled_at)
             VALUES(?1,?2,'AutoSettled',?3,?4,?5,?5)",
            params![
                format!("auto-settle:{}", uuid::Uuid::new_v4()),
                task_id,
                title,
                message,
                now
            ],
        )
        .map_err(err)?;
        tx.commit().map_err(err)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::domain::Settings;

    #[test]
    fn batches_only_eligible_tasks_after_grace_and_resumes_with_a_fresh_window() {
        let mut store = Store::init(rusqlite::Connection::open_in_memory().unwrap()).unwrap();
        let window = 3 * 86_400;
        let first = store
            .save(Task::new("First".into(), 1), "Created", 1)
            .unwrap();
        let second = store
            .save(Task::new("Second".into(), 2), "Created", 2)
            .unwrap();
        let mut edited = store
            .save(Task::new("Edited".into(), 1), "Created", 1)
            .unwrap();
        edited.description = "Keep in Inbox".into();
        let edited = store.save(edited, "Edited", 2).unwrap();
        let mut dated = Task::new("Dated".into(), 1);
        dated.due_at = Some(window * 4);
        let dated = store.save(dated, "Created", 1).unwrap();

        store.auto_settle(window).unwrap();
        assert_eq!(store.task(&first.id).unwrap().status, Status::Inbox);
        store
            .set_settings(&Settings {
                auto_settle_days: 3,
                auto_settle_since: Some(100),
                ..Settings::default()
            })
            .unwrap();
        assert_eq!(store.auto_settle_preview().unwrap(), 2);
        let now = 100 + window;
        store.auto_settle(now - 1).unwrap();
        assert!(store.notices().unwrap().is_empty());

        store.auto_settle(now).unwrap();
        store.auto_settle(now).unwrap();
        let paused = store.task(&first.id).unwrap();
        assert!(paused.is_auto_settled());
        assert_eq!(paused.wake_at, None);
        assert!(store.task(&second.id).unwrap().is_auto_settled());
        assert_eq!(
            store.history(&first.id).unwrap()[0]["action"],
            "AutoSettled"
        );
        assert_eq!(store.task(&edited.id).unwrap().status, Status::Inbox);
        assert_eq!(store.task(&dated.id).unwrap().status, Status::Inbox);
        let notices = store.notices().unwrap();
        assert_eq!(notices.len(), 1);
        assert_eq!(notices[0].title, "2 tasks auto-settled");
        assert!(notices[0].message.contains("Resume"));
        assert!(store
            .surface_now(&first.id, paused.updated_at, now)
            .is_err());
        let resumed = store.resume(&first.id, paused.updated_at, now + 1).unwrap();
        assert_eq!(resumed.status, Status::Inbox);
        assert_eq!(resumed.settlement_mode, None);
        store.auto_settle(now + window).unwrap();
        assert_eq!(store.task(&first.id).unwrap().status, Status::Inbox);
        store.auto_settle(now + window + 1).unwrap();
        assert!(store.task(&first.id).unwrap().is_auto_settled());
        assert_eq!(store.notices().unwrap().len(), 2);
        assert!(store
            .notices()
            .unwrap()
            .iter()
            .any(|n| n.title.starts_with("Auto-settled:") && !n.message.contains("Resume")));
    }
}
