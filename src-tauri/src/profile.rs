use crate::{store::Store, Db};
use base64::{engine::general_purpose::STANDARD, Engine};
use tauri::{Emitter, Manager};

#[tauri::command]
pub async fn profile_completion_count(db: tauri::State<'_, Db>) -> Result<i64, String> {
    db.lock()
        .map_err(|e| e.to_string())?
        .profile_completion_count()
}

impl Store {
    fn profile_completion_count(&self) -> Result<i64, String> {
        // An Undo always follows the transition it reverses in the task's history.
        // Include currently finished tasks so older records without history also count.
        self.conn
            .query_row(
                "WITH transitions AS (
                     SELECT task_id, json_extract(before_data, '$.status') AS before_status,
                            json_extract(after_data, '$.status') AS after_status,
                            LEAD(action, 1, '') OVER (PARTITION BY task_id ORDER BY id) AS next_action
                     FROM history
                 )
                 SELECT COUNT(*) FROM (
                     SELECT id FROM tasks WHERE json_extract(data, '$.status') = 'Finished'
                     UNION
                     SELECT task_id FROM transitions
                     WHERE after_status = 'Finished'
                       AND before_status IS NOT 'Finished'
                       AND next_action != 'Undone'
                 )",
                [],
                |row| row.get(0),
            )
            .map_err(|e| e.to_string())
    }
}

pub fn avatar(app: &tauri::AppHandle, name: &Option<String>) -> Option<String> {
    let name = name.as_ref()?;
    if !safe_name(name) {
        return None;
    }
    let bytes = std::fs::read(app.path().app_data_dir().ok()?.join("profile").join(name)).ok()?;
    Some(format!("data:image/png;base64,{}", STANDARD.encode(bytes)))
}
pub(crate) fn safe_name(name: &str) -> bool {
    name.ends_with(".png") && uuid::Uuid::parse_str(name.trim_end_matches(".png")).is_ok()
}
#[tauri::command]
pub fn save_avatar(
    png_base64: Option<String>,
    app: tauri::AppHandle,
    db: tauri::State<Db>,
) -> Result<(), String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("profile");
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let new_name = if let Some(encoded) = png_base64 {
        Some(write_crop(&dir, &encoded)?)
    } else {
        None
    };
    let d = db.lock().map_err(|e| e.to_string())?;
    let mut settings = d.settings()?;
    let old = settings.profile_image.clone();
    settings.profile_image = new_name.clone();
    if let Err(e) = d.set_settings(&settings) {
        if let Some(n) = new_name {
            let _ = std::fs::remove_file(dir.join(n));
        }
        return Err(e);
    }
    drop(d);
    if let Some(name) = old {
        if safe_name(&name) {
            let _ = std::fs::remove_file(dir.join(name));
        }
    }
    app.emit("refresh", ()).map_err(|e| e.to_string())
}

pub(crate) fn write_crop(dir: &std::path::Path, encoded: &str) -> Result<String, String> {
    if encoded.len() > 750_000 {
        return Err("Image is too large".into());
    }
    let bytes = STANDARD
        .decode(encoded)
        .map_err(|_| "Invalid image encoding")?;
    let mut reader =
        image::ImageReader::with_format(std::io::Cursor::new(&bytes), image::ImageFormat::Png);
    let mut limits = image::Limits::default();
    limits.max_image_width = Some(512);
    limits.max_image_height = Some(512);
    limits.max_alloc = Some(8 * 1024 * 1024);
    reader.limits(limits);
    let img = reader
        .decode()
        .map_err(|_| "Choose a valid cropped PNG image")?;
    if img.width() != 256 || img.height() != 256 {
        return Err("Profile images must be cropped to 256 × 256".into());
    }
    let name = format!("{}.png", uuid::Uuid::new_v4());
    std::fs::write(dir.join(&name), bytes).map_err(|e| e.to_string())?;
    Ok(name)
}
#[cfg(test)]
mod tests {
    use super::*;
    use crate::domain::{Status, Task};

    #[test]
    fn completion_count_uses_retained_history_and_respects_undo() {
        let mut store = Store::init(rusqlite::Connection::open_in_memory().unwrap()).unwrap();
        let mut first = store
            .save(Task::new("First task".into(), 100), "Created", 100)
            .unwrap();
        let mut second = store
            .save(Task::new("Second task".into(), 101), "Created", 101)
            .unwrap();
        assert_eq!(store.profile_completion_count().unwrap(), 0);

        first.status = Status::Finished;
        first = store.save(first, "Finished", 102).unwrap();
        first.status = Status::Inbox;
        first = store.save(first, "Reopened", 103).unwrap();
        assert_eq!(store.profile_completion_count().unwrap(), 1);
        first.status = Status::Finished;
        first = store.save(first, "Finished", 104).unwrap();
        assert_eq!(store.profile_completion_count().unwrap(), 1);

        second.status = Status::Finished;
        second = store.save(second, "Finished", 105).unwrap();
        assert_eq!(store.profile_completion_count().unwrap(), 2);
        store.undo(&second.id, second.updated_at, 106).unwrap();
        assert_eq!(store.profile_completion_count().unwrap(), 1);

        store
            .delete_with_receipt(&first.id, first.updated_at, Some("undo"))
            .unwrap();
        assert_eq!(store.profile_completion_count().unwrap(), 0);
        store.restore_deletion("undo").unwrap();
        assert_eq!(store.profile_completion_count().unwrap(), 1);

        // A finished task can predate the available history.
        store
            .conn
            .execute("DELETE FROM history WHERE task_id = ?1", [&first.id])
            .unwrap();
        assert_eq!(store.profile_completion_count().unwrap(), 1);
    }

    #[test]
    fn managed_crop_is_validated_and_persists_independently() {
        let dir =
            std::env::temp_dir().join(format!("reprise-avatar-test-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir(&dir).unwrap();
        let img = image::DynamicImage::new_rgba8(256, 256);
        let mut cursor = std::io::Cursor::new(Vec::new());
        img.write_to(&mut cursor, image::ImageFormat::Png).unwrap();
        let encoded = STANDARD.encode(cursor.into_inner());
        let name = write_crop(&dir, &encoded).unwrap();
        assert!(safe_name(&name));
        let saved = std::fs::read(dir.join(&name)).unwrap();
        assert_eq!(image::load_from_memory(&saved).unwrap().width(), 256);
        assert!(write_crop(&dir, "not an image").is_err());
        assert!(!safe_name("../../avatar.png"));
        assert!(!safe_name("C:/outside.png"));
        let small = image::DynamicImage::new_rgba8(2, 2);
        let mut cursor = std::io::Cursor::new(Vec::new());
        small
            .write_to(&mut cursor, image::ImageFormat::Png)
            .unwrap();
        assert!(write_crop(&dir, &STANDARD.encode(cursor.into_inner())).is_err());
        std::fs::remove_file(dir.join(name)).unwrap();
        std::fs::remove_dir(dir).unwrap();
    }
}
