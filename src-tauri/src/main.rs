#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
mod actions;
mod diagnostics;
mod domain;
mod notifications;
mod profile;
mod releases;
mod scheduler;
mod store;
#[cfg(test)]
mod tests;
mod toasts;
mod updates;
mod visuals;
use domain::*;
use std::sync::Mutex;
use tauri::{Emitter, Manager};
type Db = Mutex<store::Store>;
#[tauri::command]
fn task_action(
    id: String,
    revision: i64,
    action: String,
    db: tauri::State<Db>,
    app: tauri::AppHandle,
) -> Result<Task, String> {
    let mut d = db.lock().map_err(|e| e.to_string())?;
    let now = chrono::Utc::now().timestamp();
    let task = match action.as_str() {
        "Resume" => d.resume(&id, revision, now)?,
        "Surface" => d.surface_now(&id, revision, now)?,
        _ => return Err("Unknown task action".into()),
    };
    drop(d);
    let _ = app.emit("refresh", ());
    Ok(task)
}
#[tauri::command]
fn undo_task(
    id: String,
    revision: i64,
    db: tauri::State<Db>,
    app: tauri::AppHandle,
) -> Result<Task, String> {
    let task = db.lock().map_err(|e| e.to_string())?.undo(
        &id,
        revision,
        chrono::Utc::now().timestamp(),
    )?;
    let _ = app.emit("refresh", ());
    Ok(task)
}
#[tauri::command]
fn quit_app(app: tauri::AppHandle) {
    app.exit(0)
}
#[tauri::command]
fn notification_panel_preferences(
    pinned: bool,
    db: tauri::State<Db>,
    app: tauri::AppHandle,
) -> Result<(), String> {
    let d = db.lock().map_err(|e| e.to_string())?;
    let mut settings = d.settings()?;
    settings.notification_panel_pinned = pinned;
    d.set_settings(&settings)?;
    drop(d);
    app.emit("refresh", ()).map_err(|e| e.to_string())
}
#[tauri::command]
fn sidebar_preferences(
    width: Option<u16>,
    collapsed: Option<bool>,
    groups: Option<std::collections::BTreeMap<String, bool>>,
    db: tauri::State<Db>,
    app: tauri::AppHandle,
) -> Result<(), String> {
    let d = db.lock().map_err(|e| e.to_string())?;
    d.sidebar_preferences(width, collapsed, groups)?;
    drop(d);
    app.emit("refresh", ()).map_err(|e| e.to_string())
}
#[tauri::command]
fn delete_task(
    id: String,
    expected_updated_at: i64,
    db: tauri::State<Db>,
    app: tauri::AppHandle,
) -> Result<(), String> {
    db.lock()
        .map_err(|e| e.to_string())?
        .delete_task(&id, expected_updated_at)?;
    app.emit("refresh", ()).map_err(|e| e.to_string())
}
#[tauri::command]
fn snapshot(db: tauri::State<Db>, app: tauri::AppHandle) -> Result<serde_json::Value, String> {
    let d = db.lock().map_err(|e| e.to_string())?;
    Ok(
        serde_json::json!({"tasks":d.tasks()?,"settings":d.settings()?,"notifications":d.notices()?,"avatar":profile::avatar(&app,&d.settings()?.profile_image),"system_visuals":visuals::system_visuals(),"release":{"version":app.package_info().version.to_string(),"acknowledged":d.settings()?.last_seen_release,"should_show":releases::should_show(&app.package_info().version.to_string(),d.settings()?.last_seen_release.as_deref())}}),
    )
}
#[tauri::command]
fn capture(title: String, db: tauri::State<Db>) -> Result<Task, String> {
    let now = chrono::Utc::now().timestamp();
    db.lock()
        .unwrap()
        .save(Task::new(title, now), "Created", now)
}
#[tauri::command]
fn save_task(mut task: Task, action: String, db: tauri::State<Db>) -> Result<Task, String> {
    let now = chrono::Utc::now().timestamp();
    let mut d = db.lock().unwrap();
    // An editor left open in another window must never recreate a deleted task.
    d.task(&task.id)?;
    if action == "Settled" {
        let s = d.settings()?;
        task.status = Status::Settled;
        task.settlement_mode = Some(s.settlement_mode.clone());
        task.wake_at = Some(settlement(
            &chrono::Local,
            now,
            &s.settlement_mode,
            &s.return_time,
        )?)
    }
    d.save(task, &action, now)
}
#[tauri::command]
fn save_settings(
    mut settings: Settings,
    db: tauri::State<Db>,
    app: tauri::AppHandle,
) -> Result<(), String> {
    settings.name = settings.name.trim().to_string();
    settings.workspace = settings.workspace.trim().to_string();
    if settings.name.chars().count() > 100 || settings.workspace.chars().count() > 120 {
        return Err("Use a shorter profile or workspace name".into());
    }
    if !["system", "light", "dark"].contains(&settings.theme.as_str()) {
        return Err("Choose System, Light or Dark".into());
    }
    if !["Ctrl+K", "Ctrl+Shift+P"].contains(&settings.command_shortcut.as_str()) {
        return Err("Choose a supported command shortcut".into());
    }
    let d = db.lock().map_err(|e| e.to_string())?;
    let current = d.settings()?;
    settings.profile_image = current.profile_image;
    settings.sidebar_width = current.sidebar_width;
    settings.sidebar_collapsed = current.sidebar_collapsed;
    settings.sidebar_groups = current.sidebar_groups;
    settings.notification_panel_pinned = current.notification_panel_pinned;
    settings.accent = current.accent;
    settings.animation = current.animation;
    settings.desktop_glass = current.desktop_glass;
    settings.desktop_material = current.desktop_material;
    settings.desktop_tint = current.desktop_tint;
    settings.theme = current.theme;
    settings.theme_family = current.theme_family;
    settings.density = current.density;
    settings.material = current.material;
    settings.glass_coverage = current.glass_coverage;
    settings.blur_intensity = current.blur_intensity;
    settings.modal_backdrop = current.modal_backdrop;
    settings.scrollbars = current.scrollbars;
    settings.last_seen_release = current.last_seen_release;
    d.set_settings(&settings)?;
    drop(d);
    app.emit("refresh", ()).map_err(|e| e.to_string())
}
#[tauri::command]
fn task_history(id: String, db: tauri::State<Db>) -> Result<Vec<serde_json::Value>, String> {
    db.lock().unwrap().history(&id)
}
#[tauri::command]
fn read_notice(id: String, db: tauri::State<Db>) -> Result<(), String> {
    db.lock().map_err(|e| e.to_string())?.manage_notices(
        "read",
        &[id],
        chrono::Utc::now().timestamp(),
    )
}
fn main() {
    tauri::Builder::default()
        .manage(diagnostics::RuntimeHealth::default())
        .manage(toasts::Runtime::default())
        .manage(visuals::ReadyWindows::default())
        .manage(updates::UpdateRuntime::default())
        .plugin(tauri_plugin_single_instance::init(|app, _, _| {
            visuals::request_dashboard(app);
        }))
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_autostart::Builder::new().build())
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(|app, _, event| {
                    if event.state() == tauri_plugin_global_shortcut::ShortcutState::Pressed {
                        visuals::request_capture(app);
                    }
                })
                .build(),
        )
        .invoke_handler(tauri::generate_handler![
            notifications::manage_notifications,
            visuals::native_glass,
            updates::check_updates,
            updates::install_update,
            notification_panel_preferences,
            snapshot,
            capture,
            save_task,
            save_settings,
            task_history,
            read_notice,
            delete_task,
            task_action,
            undo_task,
            quit_app,
            sidebar_preferences,
            profile::save_avatar,
            diagnostics::diagnostics,
            diagnostics::test_notification,
            visuals::visual_preferences,
            visuals::window_ready,
            releases::acknowledge_release
        ])
        .setup(|app| {
            let dir = app.path().app_data_dir()?;
            std::fs::create_dir_all(&dir)?;
            app.manage(Mutex::new(store::Store::open(&dir.join("reprise.sqlite"))?));
            {
                let state = app.state::<Db>();
                let d = state.lock().unwrap();
                updates::reconcile(&d, &app.package_info().version.to_string())?;
            }
            // Create webviews only after the database is managed: a frontend can invoke immediately.
            let initial = {
                let state = app.state::<Db>();
                let d = state.lock().unwrap();
                let mut s = d.settings()?;
                if releases::baseline_first_install(&mut s, &app.package_info().version.to_string())
                {
                    d.set_settings(&s)?;
                }
                s
            };
            for config in &app.config().app.windows {
                tauri::WebviewWindowBuilder::from_config(app, config)?
                    .transparent(true)
                    .theme(visuals::effective_theme(&initial))
                    .background_color(visuals::native_background(&initial))
                    .build()?;
            }
            use tauri_plugin_global_shortcut::GlobalShortcutExt;
            if let Err(e) = app.global_shortcut().register("Ctrl+Shift+Space") {
                app.state::<diagnostics::RuntimeHealth>()
                    .lock()
                    .unwrap()
                    .shortcut_error = Some(e.to_string());
            }
            let menu = tauri::menu::Menu::with_items(
                app,
                &[
                    &tauri::menu::MenuItem::with_id(
                        app,
                        "open",
                        "Open Reprise",
                        true,
                        None::<&str>,
                    )?,
                    &tauri::menu::MenuItem::with_id(
                        app,
                        "capture",
                        "Quick capture",
                        true,
                        None::<&str>,
                    )?,
                    &tauri::menu::MenuItem::with_id(
                        app,
                        "quit",
                        "Quit completely",
                        true,
                        None::<&str>,
                    )?,
                ],
            )?;
            let icon = tauri::image::Image::new_owned([70, 125, 110, 255].repeat(32 * 32), 32, 32);
            tauri::tray::TrayIconBuilder::new()
                .icon(icon)
                .menu(&menu)
                .on_menu_event(|app, e| {
                    if e.id.as_ref() == "quit" {
                        app.exit(0)
                    } else if e.id.as_ref() == "capture" {
                        visuals::request_capture(app);
                    } else {
                        visuals::request_dashboard(app);
                    }
                })
                .build(app)?;
            app.state::<diagnostics::RuntimeHealth>()
                .lock()
                .unwrap()
                .tray_running = true;
            crate::scheduler::start(app.handle().clone());
            Ok(())
        })
        .on_window_event(|w, e| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = e {
                let close = w.label() == "capture"
                    || w.state::<Db>()
                        .lock()
                        .unwrap()
                        .settings()
                        .map(|s| s.close_to_tray)
                        .unwrap_or(true);
                if close {
                    api.prevent_close();
                    let _ = w.hide();
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("Unable to run Reprise");
}
