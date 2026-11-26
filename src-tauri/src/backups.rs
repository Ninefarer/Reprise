use crate::{store::Store, Db};
use rusqlite::{Connection, MAIN_DB};
use std::path::Path;
use tauri::Manager;
fn error(e: impl std::fmt::Display) -> String {
    e.to_string()
}

fn check(conn: &Connection) -> Result<(), String> {
    let integrity: String = conn
        .query_row("PRAGMA integrity_check", [], |r| r.get(0))
        .map_err(error)?;
    if integrity != "ok" {
        return Err(format!("Backup integrity check failed: {integrity}"));
    }
    let violations: i64 = conn
        .query_row("SELECT count(*) FROM pragma_foreign_key_check", [], |r| {
            r.get(0)
        })
        .map_err(error)?;
    if violations != 0 {
        return Err("Backup contains broken references".into());
    }
    Ok(())
}
fn has_backup_extension(path: &Path) -> bool {
    path.extension()
        .and_then(|extension| extension.to_str())
        .is_some_and(|extension| extension.eq_ignore_ascii_case("reprise-backup"))
}

fn snapshot(store: &Store, dir: &Path, destination: &Path) -> Result<(), String> {
    if !destination.is_absolute() {
        return Err("Enter an absolute backup path".into());
    }
    if !has_backup_extension(destination) {
        return Err("Choose a .reprise-backup filename".into());
    }
    // Never overwrite an existing file, including the active database.
    let reservation = std::fs::OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(destination)
        .map_err(error)?;
    drop(reservation);
    let result = (|| {
        store
            .conn
            .backup(MAIN_DB, destination, None)
            .map_err(error)?;
        let conn = Connection::open(destination).map_err(error)?;
        conn.execute_batch(
            "CREATE TABLE reprise_backup(format INTEGER NOT NULL, avatar_name TEXT, avatar BLOB);",
        )
        .map_err(error)?;
        let name = store.settings()?.profile_image;
        let bytes = name
            .as_ref()
            .map(|name| {
                if !crate::profile::safe_name(name) {
                    return Err("Unsafe avatar filename".into());
                }
                std::fs::read(dir.join("profile").join(name)).map_err(error)
            })
            .transpose()?;
        conn.execute(
            "INSERT INTO reprise_backup VALUES(1,?1,?2)",
            rusqlite::params![name, bytes],
        )
        .map_err(error)?;
        check(&conn)?;
        conn.execute_batch("PRAGMA wal_checkpoint(TRUNCATE); PRAGMA journal_mode=DELETE;")
            .map_err(error)?;
        drop(conn);
        std::fs::OpenOptions::new()
            .write(true)
            .open(destination)
            .map_err(error)?
            .sync_all()
            .map_err(error)
    })();
    if result.is_err() {
        let _ = std::fs::remove_file(destination);
    }
    result
}

fn restore(store: &mut Store, dir: &Path, source: &Path) -> Result<String, String> {
    if !source.is_absolute() {
        return Err("Enter an absolute backup path".into());
    }
    let staging = dir.join(format!("restore-{}.sqlite", uuid::Uuid::new_v4()));
    let result = (|| {
        let input = Connection::open_with_flags(source, rusqlite::OpenFlags::SQLITE_OPEN_READ_ONLY)
            .map_err(error)?;
        check(&input)?;
        let rows: i64 = input
            .query_row("SELECT count(*) FROM reprise_backup", [], |r| r.get(0))
            .map_err(error)?;
        let oversized: i64 = input
            .query_row(
                "SELECT count(*) FROM reprise_backup WHERE length(avatar)>750000",
                [],
                |r| r.get(0),
            )
            .map_err(error)?;
        if rows != 1 || oversized != 0 {
            return Err("Invalid backup manifest or oversized avatar".into());
        }
        let (format, name, bytes): (i64, Option<String>, Option<Vec<u8>>) = input
            .query_row(
                "SELECT format,avatar_name,avatar FROM reprise_backup",
                [],
                |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)),
            )
            .map_err(error)?;
        if format != 1 {
            return Err("Unsupported backup format".into());
        }
        input.backup(MAIN_DB, &staging, None).map_err(error)?;
        let candidate = Store::open(&staging)?;
        for task in candidate.tasks()? {
            task.validate()?;
        }
        candidate.notices()?;
        let mut settings = candidate.settings()?;
        if settings.profile_image != name || name.is_some() != bytes.is_some() {
            return Err("Backup avatar does not match its settings".into());
        }
        // Write validated assets under a new UUID; existing assets remain recoverable.
        if let Some(bytes) = bytes {
            use base64::Engine;
            let profile = dir.join("profile");
            std::fs::create_dir_all(&profile).map_err(error)?;
            settings.profile_image = Some(crate::profile::write_crop(
                &profile,
                &base64::engine::general_purpose::STANDARD.encode(bytes),
            )?);
        }
        // Startup is machine-specific; a restore must not change OS registration.
        settings.startup = store.settings()?.startup;
        candidate.set_settings(&settings)?;
        candidate
            .conn
            .execute_batch("DROP TABLE reprise_backup;")
            .map_err(error)?;
        check(&candidate.conn)?;
        let safety = dir.join(format!(
            "before-restore-{}.reprise-backup",
            uuid::Uuid::new_v4()
        ));
        snapshot(store, dir, &safety)?;
        // SQLite's backup transaction commits the replacement atomically while the
        // Store mutex excludes scheduling and all application commands.
        let replacement =
            rusqlite::backup::Backup::new(&candidate.conn, &mut store.conn).map_err(error)?;
        replacement
            .run_to_completion(128, std::time::Duration::from_millis(10), None)
            .map_err(error)?;
        drop(replacement);
        Ok(format!("Restored. Safety backup: {}", safety.display()))
    })();
    let _ = std::fs::remove_file(&staging);
    result
}

fn local_destination(dir: &Path) -> Result<std::path::PathBuf, String> {
    let folder = dir.join("backups");
    std::fs::create_dir_all(&folder).map_err(error)?;
    Ok(folder.join(format!(
        "Reprise-{}-{}.reprise-backup",
        chrono::Local::now().format("%Y-%m-%d"),
        uuid::Uuid::new_v4()
    )))
}

#[derive(serde::Serialize)]
pub struct LocalBackup {
    path: String,
    name: String,
    modified: u64,
}

#[tauri::command]
pub fn list_backups(app: tauri::AppHandle) -> Result<Vec<LocalBackup>, String> {
    let dir = app.path().app_data_dir().map_err(error)?.join("backups");
    let entries = match std::fs::read_dir(dir) {
        Ok(entries) => entries,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(Vec::new()),
        Err(e) => return Err(error(e)),
    };
    let mut backups = Vec::new();
    for entry in entries {
        let entry = entry.map_err(error)?;
        let path = entry.path();
        if !has_backup_extension(&path) || !entry.file_type().map_err(error)?.is_file() {
            continue;
        }
        let modified = entry
            .metadata()
            .map_err(error)?
            .modified()
            .map_err(error)?
            .duration_since(std::time::UNIX_EPOCH)
            .map_err(error)?
            .as_secs();
        backups.push(LocalBackup {
            path: path.to_string_lossy().into_owned(),
            name: entry.file_name().to_string_lossy().into_owned(),
            modified,
        });
    }
    backups.sort_by(|a, b| {
        b.modified
            .cmp(&a.modified)
            .then_with(|| a.name.cmp(&b.name))
    });
    Ok(backups)
}

#[tauri::command]
pub fn create_backup(
    path: Option<String>,
    db: tauri::State<Db>,
    app: tauri::AppHandle,
) -> Result<String, String> {
    let dir = app.path().app_data_dir().map_err(error)?;
    let destination = match path {
        Some(path) => std::path::PathBuf::from(path),
        None => local_destination(&dir)?,
    };
    let store = db.lock().map_err(error)?;
    snapshot(&store, &dir, &destination)?;
    Ok(format!("Backup saved: {}", destination.display()))
}
#[tauri::command]
pub fn restore_backup(
    path: String,
    db: tauri::State<Db>,
    app: tauri::AppHandle,
) -> Result<String, String> {
    let mut store = db.lock().map_err(error)?;
    let _result = restore(
        &mut store,
        &app.path().app_data_dir().map_err(error)?,
        Path::new(&path),
    )?;
    // Destroy all stale editor drafts and updater state before the restored
    // database becomes available to another frontend command.
    app.restart()
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn round_trip_and_invalid_restore_preserve_data() {
        let dir =
            std::env::temp_dir().join(format!("reprise-backup-test-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&dir).unwrap();
        let mut store = Store::open(&dir.join("live.sqlite")).unwrap();
        let profile = dir.join("profile");
        std::fs::create_dir_all(&profile).unwrap();
        let mut png = std::io::Cursor::new(Vec::new());
        image::DynamicImage::new_rgba8(256, 256)
            .write_to(&mut png, image::ImageFormat::Png)
            .unwrap();
        use base64::Engine;
        let original_name = crate::profile::write_crop(
            &profile,
            &base64::engine::general_purpose::STANDARD.encode(png.get_ref()),
        )
        .unwrap();
        let mut settings = store.settings().unwrap();
        settings.profile_image = Some(original_name.clone());
        store.set_settings(&settings).unwrap();
        store
            .save(
                crate::domain::Task::new("Original".into(), 100),
                "Created",
                100,
            )
            .unwrap();
        let backup = local_destination(&dir).unwrap();
        assert_eq!(backup.parent().unwrap(), dir.join("backups"));
        assert_ne!(backup, local_destination(&dir).unwrap());
        snapshot(&store, &dir, &backup).unwrap();
        assert!(snapshot(&store, &dir, &backup).is_err());
        let export = dir.join("Takeout.REPRISE-BACKUP");
        snapshot(&store, &dir, &export).unwrap();
        store
            .save(
                crate::domain::Task::new("Later".into(), 101),
                "Created",
                101,
            )
            .unwrap();
        restore(&mut store, &dir, &export).unwrap();
        assert_eq!(store.tasks().unwrap().len(), 1);
        let restored_name = store.settings().unwrap().profile_image.unwrap();
        assert_ne!(restored_name, original_name);
        assert_eq!(
            std::fs::read(profile.join(&restored_name)).unwrap(),
            *png.get_ref()
        );
        assert!(profile.join(&original_name).exists());
        let safety = std::fs::read_dir(&dir)
            .unwrap()
            .map(|e| e.unwrap().path())
            .find(|p| {
                p.file_name()
                    .unwrap()
                    .to_string_lossy()
                    .starts_with("before-restore")
            })
            .unwrap();
        restore(&mut store, &dir, &safety).unwrap();
        assert_eq!(store.tasks().unwrap().len(), 2);
        let fixture = Connection::open(&backup).unwrap();
        fixture.execute_batch("PRAGMA user_version=99;").unwrap();
        drop(fixture);
        assert!(restore(&mut store, &dir, &backup).is_err());
        assert_eq!(store.tasks().unwrap().len(), 2);
        let fixture = Connection::open(&backup).unwrap();
        fixture
            .execute_batch("PRAGMA user_version=2; DROP TABLE retired_notifications;")
            .unwrap();
        drop(fixture);
        restore(&mut store, &dir, &backup).unwrap();
        let version: i64 = store
            .conn
            .query_row("PRAGMA user_version", [], |r| r.get(0))
            .unwrap();
        assert_eq!(version, 3);
        assert_eq!(store.tasks().unwrap().len(), 1);
        let bad = dir.join("bad.reprise-backup");
        std::fs::write(&bad, b"invalid").unwrap();
        assert!(restore(&mut store, &dir, &bad).is_err());
        assert_eq!(store.tasks().unwrap().len(), 1);
        drop(store);
        std::fs::remove_dir_all(dir).unwrap();
    }
}
