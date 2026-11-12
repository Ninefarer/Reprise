//! Windows toast content and acknowledged native submission, independent of local history UI.
use crate::{domain::Task, notifications::Notice};
use chrono::{DateTime, Local};
pub struct Content {
    pub title: String,
    pub body: String,
}
fn clean(value: &str, limit: usize) -> String {
    let text = value.split_whitespace().collect::<Vec<_>>().join(" ");
    if text.chars().count() <= limit {
        text
    } else {
        text.chars().take(limit - 1).collect::<String>() + "\u{2026}"
    }
}
fn date(at: i64) -> String {
    DateTime::from_timestamp(at, 0)
        .map(|d| {
            d.with_timezone(&Local)
                .format("%b %-d at %-I:%M %p")
                .to_string()
        })
        .unwrap_or_else(|| "the planned time".into())
}
fn category(category: &str) -> &str {
    match category {
        "Scheduled" => "Scheduled",
        "Snoozed" => "Snooze ended",
        "Settled" => "Ready to revisit",
        "Waiting" => "Follow-up",
        "Deadline" => "Deadline",
        "DailyReview" => "Daily Review",
        _ => "Reminder",
    }
}
pub fn content(notices: &[Notice], tasks: &[Task]) -> Content {
    if notices.len() != 1 {
        let mut lines: Vec<String> = notices
            .iter()
            .take(3)
            .map(|n| {
                format!(
                    "{}: {}",
                    category(&n.category),
                    clean(
                        if n.category == "DailyReview" {
                            &n.message
                        } else {
                            &n.title
                        },
                        80
                    )
                )
            })
            .collect();
        if notices.len() > 3 {
            lines.push(format!(
                "And {} more. Open Reprise to review.",
                notices.len() - 3
            ));
        }
        return Content {
            title: format!("{} reminders to review", notices.len()),
            body: lines.join("\n"),
        };
    }
    let n = &notices[0];
    let task = tasks.iter().find(|t| Some(&t.id) == n.task_id.as_ref());
    let heading = clean(&n.title, 100);
    let (title, mut body) = match n.category.as_str() {
        "Scheduled" => (
            format!("Time to start: {heading}"),
            format!(
                "Planned for {}. Start when you're ready.",
                date(n.scheduled_at)
            ),
        ),
        "Snoozed" => (
            format!("Snooze ended: {heading}"),
            "This task has returned for review. Choose its next step in Reprise.".into(),
        ),
        "Settled" => (
            format!("Ready to revisit: {heading}"),
            "Your settled task has returned for review. Pick up where you left off.".into(),
        ),
        "Waiting" => (
            format!("Follow up: {heading}"),
            "Your follow-up is due. The dependency is still marked as waiting.".into(),
        ),
        "Deadline" => (
            format!("Deadline to review: {heading}"),
            format!(
                "Due {}. Review, reschedule or finish this task in Reprise.",
                date(n.scheduled_at)
            ),
        ),
        "DailyReview" => ("Your daily review".into(), n.message.clone()),
        _ => (heading, n.message.clone()),
    };
    if let Some(t) = task {
        if n.category == "Waiting" && !t.reason.trim().is_empty() {
            body.push_str(&format!(" Waiting on: {}.", clean(&t.reason, 100)));
        }
        if n.category != "Deadline" {
            if let Some(at) = t.due_at {
                body.push_str(&format!(" Deadline: {}.", date(at)));
            }
        }
    }
    Content { title, body }
}
fn escape(value: &str) -> String {
    value.chars().filter(|c|matches!(*c, '\u{9}' | '\u{a}' | '\u{d}' | '\u{20}'..='\u{d7ff}' | '\u{e000}'..='\u{fffd}' | '\u{10000}'..='\u{10ffff}')).collect::<String>()
        .replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('\"', "&quot;")
        .replace('\'', "&apos;")
}
fn xml(content: &Content) -> String {
    format!("<toast><visual><binding template=\"ToastGeneric\"><text>{}</text><text>{}</text></binding></visual></toast>",escape(&content.title),escape(&content.body))
}
#[cfg(windows)]
mod native {
    use super::*;
    use std::{collections::VecDeque, sync::Mutex};
    use tauri::{Emitter, Manager};
    use windows::{
        core::{IInspectable, HSTRING},
        Data::Xml::Dom::XmlDocument,
        Foundation::TypedEventHandler,
        UI::Notifications::{
            NotificationSetting, ToastFailedEventArgs, ToastNotification, ToastNotificationManager,
        },
    };
    struct Active {
        toast: ToastNotification,
        activated: i64,
        failed: i64,
    }
    #[derive(Default)]
    pub struct Runtime(Mutex<VecDeque<Active>>);
    pub fn send(
        app: &tauri::AppHandle,
        content: &Content,
        ids: Vec<String>,
        review: bool,
        task_id: Option<String>,
    ) -> Result<(), String> {
        let notifier = ToastNotificationManager::CreateToastNotifierWithId(&HSTRING::from(
            &app.config().identifier,
        ))
        .map_err(|e| e.to_string())?;
        let setting = notifier.Setting().map_err(|e| e.to_string())?;
        if setting != NotificationSetting::Enabled {
            return Err(format!("Windows notifications are disabled (setting {}). Check Windows notification settings for Reprise.",setting.0));
        }
        let doc = XmlDocument::new().map_err(|e| e.to_string())?;
        doc.LoadXml(&HSTRING::from(xml(content)))
            .map_err(|e| e.to_string())?;
        let toast = ToastNotification::CreateToastNotification(&doc).map_err(|e| e.to_string())?;
        toast
            .SetTag(&HSTRING::from(
                &uuid::Uuid::new_v4().simple().to_string()[..16],
            ))
            .map_err(|e| e.to_string())?;
        toast
            .SetGroup(&HSTRING::from("reprise-reminders"))
            .map_err(|e| e.to_string())?;
        let handle = app.clone();
        let activation_ids = ids.clone();
        let activated = toast
            .Activated(&TypedEventHandler::<ToastNotification, IInspectable>::new(
                move |_, _| {
                    crate::scheduler::activate(&handle, &activation_ids, review, task_id.clone());
                    Ok(())
                },
            ))
            .map_err(|e| e.to_string())?;
        let handle = app.clone();
        let failed = toast.Failed(&TypedEventHandler::<ToastNotification, ToastFailedEventArgs>::new(move |_, args| {
            let error = args.as_ref().and_then(|a| a.ErrorCode().ok()).map(|code| format!("Windows toast failed: {code:?}")).unwrap_or_else(|| "Windows toast failed".into());
            let handle = handle.clone(); let ids = ids.clone();
            // Do not block native Show while the scheduler holds the DB lock.
            std::thread::spawn(move || {
                if let Ok(db) = handle.state::<crate::Db>().lock() {
                    for id in ids {
                        if let Err(failure) = db.conn.execute("UPDATE notifications SET state='Failed',error=?2 WHERE id=?1", rusqlite::params![id,error]) {eprintln!("Recording toast failure: {failure}");}
                    }
                }
                let _ = handle.emit("refresh", ());
            });
            Ok(())
        })).map_err(|e| e.to_string())?;
        notifier.Show(&toast).map_err(|e| e.to_string())?;
        let state = app.state::<Runtime>();
        let mut active = state.0.lock().map_err(|e| e.to_string())?;
        active.push_back(Active {
            toast,
            activated,
            failed,
        });
        while active.len() > 32 {
            if let Some(old) = active.pop_front() {
                let _ = old.toast.RemoveActivated(old.activated);
                let _ = old.toast.RemoveFailed(old.failed);
            }
        }
        Ok(())
    }
}
#[cfg(windows)]
pub use native::{send, Runtime};
#[cfg(not(windows))]
#[derive(Default)]
pub struct Runtime;
#[cfg(not(windows))]
pub fn send(
    app: &tauri::AppHandle,
    content: &Content,
    _ids: Vec<String>,
    _review: bool,
    _task_id: Option<String>,
) -> Result<(), String> {
    use tauri_plugin_notification::NotificationExt;
    app.notification()
        .builder()
        .title(&content.title)
        .body(&content.body)
        .show()
        .map_err(|e| e.to_string())
}
#[cfg(test)]
mod tests {
    use super::*;
    fn notice(category: &str) -> Notice {
        Notice {
            id: "event".into(),
            task_id: Some("task".into()),
            category: category.into(),
            title: "Review the garden plan".into(),
            message: "You have 1 task waiting for your attention.".into(),
            created_at: 100,
            scheduled_at: 100,
            submitted_at: None,
            state: "Pending".into(),
            read: false,
            interaction_at: None,
            action: None,
            error: None,
        }
    }
    #[test]
    fn each_reminder_explains_why_it_arrived() {
        for (c, heading) in [
            ("Scheduled", "Time to start"),
            ("Snoozed", "Snooze ended"),
            ("Settled", "Ready to revisit"),
            ("Waiting", "Follow up"),
            ("Deadline", "Deadline to review"),
        ] {
            let v = content(&[notice(c)], &[]);
            assert!(v.title.starts_with(heading));
            assert!(v.title.contains("garden plan"));
            assert!(!v.body.is_empty());
        }
    }
    #[test]
    fn daily_review_and_grouped_reminders_keep_real_details() {
        assert_eq!(
            content(&[notice("DailyReview")], &[]).body,
            "You have 1 task waiting for your attention."
        );
        let v = content(
            &[
                notice("Scheduled"),
                notice("Waiting"),
                notice("Snoozed"),
                notice("Settled"),
            ],
            &[],
        );
        assert!(v.body.contains("Follow-up: Review the garden plan"));
        assert!(v.body.contains("And 1 more"));
        assert!(!v.body.contains("needs attention"));
    }
    #[test]
    fn xml_escapes_task_text_and_titles_are_bounded() {
        let v = Content {
            title: "A&B <garden>".into(),
            body: "Use \"quotes\" and 'apostrophes'".into(),
        };
        let x = xml(&v);
        assert!(x.contains("A&amp;B &lt;garden&gt;"));
        assert!(x.contains("&quot;"));
        assert!(x.contains("&apos;"));
        assert!(clean(&"a".repeat(300), 100).chars().count() <= 100);
    }
}
