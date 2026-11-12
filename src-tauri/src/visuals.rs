use crate::{domain::Settings, Db};
use serde::{Deserialize, Serialize};
use std::{collections::HashSet, sync::Mutex};
use tauri::{Emitter, Manager};
#[derive(Default)]
pub struct WindowReadiness {
    ready: HashSet<String>,
    capture_requested: bool,
}
pub type ReadyWindows = Mutex<WindowReadiness>;
#[derive(Default, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct VisualPatch {
    pub theme: Option<String>,
    pub theme_family: Option<String>,
    pub density: Option<String>,
    pub material: Option<String>,
    pub glass_coverage: Option<String>,
    pub blur_intensity: Option<u8>,
    pub modal_backdrop: Option<String>,
    pub scrollbars: Option<String>,
    pub accent: Option<String>,
    pub animation: Option<String>,
    pub desktop_glass: Option<bool>,
    pub desktop_material: Option<String>,
    pub desktop_tint: Option<u8>,
}
impl VisualPatch {
    pub fn apply(self, s: &mut Settings) -> Result<(), String> {
        macro_rules! value {
            ($field:ident,$allowed:expr) => {
                if let Some(value) = self.$field {
                    if !$allowed.contains(&value.as_str()) {
                        return Err(format!("Invalid {}", stringify!($field)));
                    }
                    s.$field = value;
                }
            };
        }
        if let Some(value) = self.desktop_glass {
            s.desktop_glass = value;
        }
        if let Some(value) = self.desktop_tint {
            if !(35..=90).contains(&value) {
                return Err("Tint must be 35?90".into());
            }
            s.desktop_tint = value;
        }
        value!(desktop_material, ["clear", "acrylic"]);
        value!(theme, ["system", "light", "dark"]);
        value!(
            accent,
            ["theme", "lavender", "sage", "icy-blue", "rose", "neutral"]
        );
        value!(animation, ["off", "subtle", "expressive"]);
        value!(theme_family, ["classic", "pitch-black", "ashen-white"]);
        value!(density, ["comfortable", "compact"]);
        value!(material, ["flat", "frosted", "glass"]);
        value!(glass_coverage, ["menus", "all", "off"]);
        value!(modal_backdrop, ["dim", "blur", "none"]);
        value!(scrollbars, ["system", "always"]);
        if let Some(value) = self.blur_intensity {
            if !(4..=24).contains(&value) {
                return Err("Blur must be between 4 and 24".into());
            }
            s.blur_intensity = value;
        }
        Ok(())
    }
}
pub fn effective_theme(s: &Settings) -> Option<tauri::Theme> {
    match s.theme_family.as_str() {
        "pitch-black" => Some(tauri::Theme::Dark),
        "ashen-white" => Some(tauri::Theme::Light),
        _ => match s.theme.as_str() {
            "dark" => Some(tauri::Theme::Dark),
            "light" => Some(tauri::Theme::Light),
            _ => None,
        },
    }
}
pub fn native_background(s: &Settings) -> tauri::utils::config::Color {
    use tauri::utils::config::Color;
    match s.theme_family.as_str() {
        "pitch-black" => Color(5, 5, 5, 255),
        "ashen-white" => Color(250, 250, 250, 255),
        _ => match effective_theme(s) {
            Some(tauri::Theme::Light) => Color(245, 246, 242, 255),
            _ => Color(32, 37, 33, 255),
        },
    }
}
#[derive(Serialize)]
pub struct SystemVisuals {
    auto_hide_scrollbars: Option<bool>,
    advanced_effects: Option<bool>,
    animations_enabled: Option<bool>,
}
pub fn system_visuals() -> SystemVisuals {
    #[cfg(windows)]
    {
        match windows::UI::ViewManagement::UISettings::new() {
            Ok(ui) => SystemVisuals {
                auto_hide_scrollbars: ui.AutoHideScrollBars().ok(),
                advanced_effects: ui.AdvancedEffectsEnabled().ok(),
                animations_enabled: ui.AnimationsEnabled().ok(),
            },
            Err(_) => SystemVisuals {
                auto_hide_scrollbars: None,
                advanced_effects: None,
                animations_enabled: None,
            },
        }
    }
    #[cfg(not(windows))]
    {
        SystemVisuals {
            auto_hide_scrollbars: None,
            advanced_effects: None,
            animations_enabled: None,
        }
    }
}
#[tauri::command]
pub fn visual_preferences(
    patch: VisualPatch,
    db: tauri::State<Db>,
    app: tauri::AppHandle,
) -> Result<(), String> {
    let d = db.lock().map_err(|e| e.to_string())?;
    let mut s = d.settings()?;
    patch.apply(&mut s)?;
    d.set_settings(&s)?;
    drop(d);
    app.emit("refresh", ()).map_err(|e| e.to_string())
}
#[tauri::command]
pub fn window_ready(window: tauri::WebviewWindow, app: tauri::AppHandle) -> Result<(), String> {
    let state = app.state::<ReadyWindows>();
    let mut ready = state.lock().map_err(|e| e.to_string())?;
    ready.ready.insert(window.label().to_string());
    let show = window.label() == "main" || (window.label() == "capture" && ready.capture_requested);
    if window.label() == "capture" {
        ready.capture_requested = false;
    }
    drop(ready);
    if show {
        window.show().map_err(|e| e.to_string())?;
        window.set_focus().map_err(|e| e.to_string())?;
    }
    Ok(())
}
pub fn request_capture(app: &tauri::AppHandle) {
    let state = app.state::<ReadyWindows>();
    let mut ready = state.lock().unwrap();
    if !ready.ready.contains("capture") {
        ready.capture_requested = true;
        return;
    }
    drop(ready);
    if let Some(w) = app.get_webview_window("capture") {
        let _ = w.show();
        let _ = w.set_focus();
    }
}
pub fn request_dashboard(app: &tauri::AppHandle) {
    let state = app.state::<ReadyWindows>();
    if !state.lock().unwrap().ready.contains("main") {
        return;
    }
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.show();
        let _ = w.set_focus();
    }
}

#[derive(Serialize)]
pub struct NativeGlassResult {
    mode: String,
    error: Option<String>,
}
#[tauri::command]
pub fn native_glass(
    window: tauri::WebviewWindow,
    db: tauri::State<Db>,
    dark: bool,
    allow: bool,
) -> Result<NativeGlassResult, String> {
    let s = db.lock().map_err(|e| e.to_string())?.settings()?;
    let allowed = system_visuals().advanced_effects != Some(false);
    let contrast = windows::UI::ViewManagement::AccessibilitySettings::new()
        .and_then(|v| v.HighContrast())
        .unwrap_or(true);
    let enabled = s.desktop_glass && allowed && !contrast && allow;
    window
        .set_effects(None::<tauri::utils::config::WindowEffectsConfig>)
        .map_err(|e| e.to_string())?;
    if enabled {
        window
            .set_background_color(Some(tauri::utils::config::Color(0, 0, 0, 0)))
            .map_err(|e| e.to_string())?;
        if s.desktop_material == "acrylic" {
            if let Err(error) = window.set_effects(tauri::utils::config::WindowEffectsConfig {
                effects: vec![tauri::utils::WindowEffect::Acrylic],
                ..Default::default()
            }) {
                window
                    .set_background_color(Some(native_background(&s)))
                    .map_err(|e| e.to_string())?;
                return Ok(NativeGlassResult {
                    mode: "off".into(),
                    error: Some(error.to_string()),
                });
            }
        }
        Ok(NativeGlassResult {
            mode: s.desktop_material,
            error: None,
        })
    } else {
        let mut s = s;
        s.theme = if dark { "dark".into() } else { "light".into() };
        window
            .set_background_color(Some(native_background(&s)))
            .map_err(|e| e.to_string())?;
        Ok(NativeGlassResult {
            mode: "off".into(),
            error: if s.desktop_glass {
                Some("Windows or accessibility preferences require opaque surfaces.".into())
            } else {
                None
            },
        })
    }
}
