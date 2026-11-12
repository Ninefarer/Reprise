use chrono::{DateTime, Duration, LocalResult, NaiveTime, TimeZone, Utc};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum Status {
    Inbox,
    DoNow,
    Scheduled,
    Snoozed,
    Settled,
    Waiting,
    Finished,
    Dropped,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Task {
    pub id: String,
    pub title: String,
    pub description: String,
    pub status: Status,
    pub priority: u8,
    pub energy: String,
    pub created_at: i64,
    pub updated_at: i64,
    pub scheduled_at: Option<i64>,
    pub due_at: Option<i64>,
    pub wake_at: Option<i64>,
    pub completed_at: Option<i64>,
    pub project: String,
    pub tags: String,
    pub parent_task_id: Option<String>,
    pub recurrence: String,
    pub reason: String,
    pub review_at: Option<i64>,
    pub review_reason: Option<String>,
    #[serde(default)]
    pub settled_at: Option<i64>,
    #[serde(default)]
    pub settlement_mode: Option<String>,
}
impl Task {
    pub fn new(title: String, now: i64) -> Self {
        Self {
            id: uuid::Uuid::new_v4().to_string(),
            title,
            description: String::new(),
            status: Status::Inbox,
            priority: 0,
            energy: String::new(),
            created_at: now,
            updated_at: now,
            scheduled_at: None,
            due_at: None,
            wake_at: None,
            completed_at: None,
            project: String::new(),
            tags: String::new(),
            parent_task_id: None,
            recurrence: String::new(),
            reason: String::new(),
            review_at: None,
            review_reason: None,
            settled_at: None,
            settlement_mode: None,
        }
    }
    pub fn validate(&self) -> Result<(), String> {
        if self.title.trim().is_empty() || self.title.len() > 500 {
            return Err("Title must contain 1–500 characters".into());
        }
        if self.description.len() > 100_000 || self.priority > 3 {
            return Err("Invalid task fields".into());
        }
        if self.status == Status::Scheduled && self.scheduled_at.is_none() {
            return Err("Choose a scheduled date".into());
        }
        if matches!(self.status, Status::Snoozed | Status::Settled)
            && self.wake_at.is_none()
            && self.review_at.is_none()
        {
            return Err("Choose a return time".into());
        }
        if !["", "daily", "weekly"].contains(&self.recurrence.as_str()) {
            return Err("Unsupported recurrence".into());
        }
        Ok(())
    }
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct Settings {
    pub name: String,
    pub workspace: String,
    pub theme: String,
    pub density: String,
    pub onboarded: bool,
    pub settlement_mode: String,
    pub return_time: String,
    pub review_time: String,
    pub daily_review: bool,
    pub quiet_start: String,
    pub quiet_end: String,
    pub notifications: bool,
    pub categories: Vec<String>,
    pub close_to_tray: bool,
    pub startup: bool,
    pub shortcut: String,
    pub paused: bool,
    pub profile_image: Option<String>,
    pub sidebar_width: u16,
    pub sidebar_collapsed: bool,
    pub sidebar_groups: std::collections::BTreeMap<String, bool>,
    pub command_shortcut: String,
    pub theme_family: String,
    pub material: String,
    pub glass_coverage: String,
    pub blur_intensity: u8,
    pub modal_backdrop: String,
    pub scrollbars: String,
    pub last_seen_release: Option<String>,
    pub notification_panel_pinned: bool,
    pub accent: String,
    pub animation: String,
    pub desktop_glass: bool,
    pub desktop_material: String,
    pub desktop_tint: u8,
}
impl Default for Settings {
    fn default() -> Self {
        Self {
            name: String::new(),
            workspace: String::new(),
            theme: "system".into(),
            density: "comfortable".into(),
            onboarded: false,
            settlement_mode: "next_day".into(),
            return_time: "09:00".into(),
            review_time: "09:00".into(),
            daily_review: true,
            quiet_start: "22:00".into(),
            quiet_end: "08:00".into(),
            notifications: true,
            categories: vec![
                "Scheduled".into(),
                "Deadline".into(),
                "Snoozed".into(),
                "Settled".into(),
                "Waiting".into(),
                "DailyReview".into(),
            ],
            close_to_tray: true,
            startup: false,
            shortcut: "Ctrl+Shift+Space".into(),
            paused: false,
            profile_image: None,
            sidebar_width: 224,
            sidebar_collapsed: false,
            sidebar_groups: std::collections::BTreeMap::new(),
            command_shortcut: "Ctrl+K".into(),
            theme_family: "classic".into(),
            material: "flat".into(),
            glass_coverage: "menus".into(),
            blur_intensity: 12,
            modal_backdrop: "dim".into(),
            scrollbars: "system".into(),
            last_seen_release: None,
            notification_panel_pinned: false,
            accent: "theme".into(),
            animation: "subtle".into(),
            desktop_glass: false,
            desktop_material: "clear".into(),
            desktop_tint: 65,
        }
    }
}
pub fn local_time<T: TimeZone>(tz: &T, date: chrono::NaiveDate, time: &str) -> Result<i64, String> {
    let t = NaiveTime::parse_from_str(time, "%H:%M").map_err(|_| "Invalid local time")?;
    let mut local = date.and_time(t);
    // Gaps advance to the first valid minute; folds choose the earlier instant.
    for _ in 0..180 {
        match tz.from_local_datetime(&local) {
            LocalResult::Single(v) => return Ok(v.timestamp()),
            LocalResult::Ambiguous(a, b) => return Ok(a.timestamp().min(b.timestamp())),
            LocalResult::None => local += Duration::minutes(1),
        }
    }
    Err("Unable to resolve local time".into())
}
pub fn settlement<T: TimeZone>(tz: &T, now: i64, mode: &str, time: &str) -> Result<i64, String> {
    if mode == "24h" {
        return Ok(now + 86400);
    }
    let date = DateTime::<Utc>::from_timestamp(now, 0)
        .ok_or("Invalid timestamp")?
        .with_timezone(tz)
        .date_naive()
        .succ_opt()
        .ok_or("Invalid date")?;
    local_time(tz, date, time)
}
pub fn quiet(time: &str, start: &str, end: &str) -> bool {
    if start == end {
        false
    } else if start < end {
        time >= start && time < end
    } else {
        time >= start || time < end
    }
}
