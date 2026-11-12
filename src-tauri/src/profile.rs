use crate::Db;
use base64::{engine::general_purpose::STANDARD, Engine};
use tauri::{Emitter, Manager};
pub fn avatar(app: &tauri::AppHandle, name: &Option<String>) -> Option<String> {
    let name = name.as_ref()?;
    if !safe_name(name) {
        return None;
    }
    let bytes = std::fs::read(app.path().app_data_dir().ok()?.join("profile").join(name)).ok()?;
    Some(format!("data:image/png;base64,{}", STANDARD.encode(bytes)))
}
fn safe_name(name: &str) -> bool {
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

fn write_crop(dir: &std::path::Path, encoded: &str) -> Result<String, String> {
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
