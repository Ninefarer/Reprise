//! Read only the data a native window presents. Capture never reads task/history lists.
use crate::{
    domain::{Settings, Task},
    notifications::Notice,
    store::Store,
};

pub struct ViewData {
    pub tasks: Vec<Task>,
    pub settings: Settings,
    pub notifications: Vec<Notice>,
    pub tasks_ms: f64,
    pub settings_ms: f64,
    pub notifications_ms: f64,
}

pub fn read(store: &Store, capture: bool, measure: bool) -> Result<ViewData, String> {
    let start = measure.then(std::time::Instant::now);
    let elapsed = || start.map_or(0.0, |t| t.elapsed().as_secs_f64() * 1000.0);
    let tasks = if capture { vec![] } else { store.tasks()? };
    let tasks_ms = elapsed();
    let settings = store.settings()?;
    let settings_done = elapsed();
    let notifications = if capture { vec![] } else { store.notices()? };
    Ok(ViewData {
        tasks,
        settings,
        notifications,
        tasks_ms,
        settings_ms: settings_done - tasks_ms,
        notifications_ms: elapsed() - settings_done,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn capture_bootstrap_and_creation_do_not_depend_on_list_queries() {
        let mut store = Store::init(rusqlite::Connection::open_in_memory().unwrap()).unwrap();
        let mut settings = store.settings().unwrap();
        settings.theme_family = "pitch-black".into();
        store.set_settings(&settings).unwrap();
        // Valid JSON with deliberately invalid task fields: a full task-list read fails.
        store
            .conn
            .execute("INSERT INTO tasks VALUES('unrelated','{}')", [])
            .unwrap();
        store.conn.execute("INSERT INTO notifications(id,category,title,message,created_at,scheduled_at) VALUES('unrelated','Diagnostic','Unrelated','Unrelated','invalid',1)", []).unwrap();
        assert!(store.tasks().is_err());
        assert!(store.notices().is_err());
        let capture = read(&store, true, true).unwrap();
        assert!(capture.tasks.is_empty());
        assert!(capture.notifications.is_empty());
        assert_eq!(capture.settings.theme_family, "pitch-black");
        let task = store
            .save(Task::new("A new intention".into(), 100), "Created", 100)
            .unwrap();
        assert_eq!(store.task(&task.id).unwrap().title, "A new intention");
        assert!(read(&store, false, false).is_err());
        assert!(read(&store, true, false).unwrap().tasks.is_empty());
    }
}
