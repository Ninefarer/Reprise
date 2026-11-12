use crate::{domain::*, store::Store};
use chrono::{TimeZone, Timelike};
#[test]
fn visual_preferences_preserve_classic_mode_and_survive_restart() {
    let d = db();
    let mut s = d.settings().unwrap();
    assert_eq!(s.theme_family, "classic");
    assert_eq!(s.material, "flat");
    assert_eq!(s.glass_coverage, "menus");
    crate::visuals::VisualPatch {
        theme_family: Some("pitch-black".into()),
        material: Some("glass".into()),
        glass_coverage: Some("off".into()),
        blur_intensity: Some(24),
        modal_backdrop: Some("blur".into()),
        accent: Some("lavender".into()),
        animation: Some("expressive".into()),
        desktop_glass: Some(true),
        desktop_material: Some("acrylic".into()),
        desktop_tint: Some(70),
        ..Default::default()
    }
    .apply(&mut s)
    .unwrap();
    assert_eq!(s.theme, "system");
    assert_eq!(
        crate::visuals::effective_theme(&s),
        Some(tauri::Theme::Dark)
    );
    s.last_seen_release = Some("0.2.0".into());
    assert!(!s.notification_panel_pinned);
    s.notification_panel_pinned = true;
    d.set_settings(&s).unwrap();
    let d = Store::init(d.conn).unwrap();
    let s = d.settings().unwrap();
    assert_eq!(s.theme_family, "pitch-black");
    assert_eq!(s.material, "glass");
    assert_eq!(s.glass_coverage, "off");
    assert_eq!(s.blur_intensity, 24);
    assert_eq!(s.modal_backdrop, "blur");
    assert_eq!(s.last_seen_release.as_deref(), Some("0.2.0"));
    assert!(s.notification_panel_pinned);
    assert_eq!(s.accent, "lavender");
    assert_eq!(s.animation, "expressive");
    assert!(s.desktop_glass);
    assert_eq!(s.desktop_material, "acrylic");
    assert_eq!(s.desktop_tint, 70);
}
#[test]
fn invalid_visual_preferences_are_rejected() {
    for json in [
        r#"{"theme_family":"rainbow"}"#,
        r#"{"glass_coverage":"entire-app"}"#,
        r#"{"blur_intensity":25}"#,
        r#"{"blur_intensity":3}"#,
        r#"{"material":"acrylic"}"#,
        r#"{"accent":"neon"}"#,
        r#"{"animation":"constant"}"#,
        r#"{"desktop_material":"fake"}"#,
        r#"{"desktop_tint":0}"#,
    ] {
        let patch: crate::visuals::VisualPatch = serde_json::from_str(json).unwrap();
        assert!(patch.apply(&mut Settings::default()).is_err());
    }
    assert!(serde_json::from_str::<crate::visuals::VisualPatch>(r#"{"unknown":true}"#).is_err());
}
#[test]
fn release_precedence_handles_prereleases_downgrades_and_build_metadata() {
    use crate::releases::should_show;
    assert!(should_show("0.2.0", None));
    assert!(should_show("0.2.0", Some("0.1.0")));
    assert!(should_show("0.2.0", Some("0.2.0-rc.1")));
    assert!(should_show("0.2.0-rc.2", Some("0.2.0-rc.1")));
    assert!(!should_show("0.2.0-rc.1", Some("0.2.0")));
    assert!(!should_show("0.2.0+new", Some("0.2.0+old")));
    assert!(!should_show("0.1.0", Some("0.2.0")));
    assert!(!should_show("0.2.0", Some("0.2.0")));
    assert!(!should_show("invalid", None));
    assert!(should_show("0.2.0", Some("invalid")));
}
#[test]
fn first_install_does_not_interrupt_onboarding_but_existing_users_get_notes() {
    let mut s = Settings::default();
    assert!(crate::releases::baseline_first_install(&mut s, "0.2.0"));
    assert!(!crate::releases::should_show(
        "0.2.0",
        s.last_seen_release.as_deref()
    ));
    assert!(!crate::releases::baseline_first_install(&mut s, "0.3.0"));
    let mut existing = Settings::default();
    existing.onboarded = true;
    assert!(!crate::releases::baseline_first_install(
        &mut existing,
        "0.2.0"
    ));
    assert!(crate::releases::should_show(
        "0.2.0",
        existing.last_seen_release.as_deref()
    ));
}
#[test]
fn sidebar_group_patches_persist_independently_and_preserve_space() {
    let d = db();
    let mut settings = d.settings().unwrap();
    settings.workspace = "Quiet studio".into();
    d.set_settings(&settings).unwrap();
    d.sidebar_preferences(
        Some(290),
        Some(true),
        Some([("tasks".into(), false)].into()),
    )
    .unwrap();
    d.sidebar_preferences(None, None, Some([("history".into(), false)].into()))
        .unwrap();
    let d = Store::init(d.conn).unwrap();
    let s = d.settings().unwrap();
    assert_eq!(s.workspace, "Quiet studio");
    assert_eq!(s.sidebar_width, 290);
    assert!(s.sidebar_collapsed);
    assert_eq!(s.sidebar_groups.get("tasks"), Some(&false));
    assert_eq!(s.sidebar_groups.get("history"), Some(&false));
    assert!(d
        .sidebar_preferences(Some(220), None, Some([("unknown".into(), false)].into()))
        .is_err());
    assert_eq!(d.settings().unwrap().sidebar_width, 290);
    d.sidebar_preferences(None, Some(false), None).unwrap();
    assert_eq!(d.settings().unwrap().sidebar_width, 290);
}
#[test]
fn undo_early_wake_rearms_timer_without_replaying_processed_event() {
    let mut d = db();
    let mut t = Task::new("Undo wake".into(), 100);
    t.status = Status::Snoozed;
    t.wake_at = Some(1000);
    let t = d.save(t, "Created", 100).unwrap();
    let t = d.surface_now(&t.id, t.updated_at, 200).unwrap();
    let t = d.undo(&t.id, t.updated_at, 210).unwrap();
    assert_eq!(t.review_at, None);
    assert_eq!(t.wake_at, Some(1000));
    d.reconcile(1001).unwrap();
    d.reconcile(1002).unwrap();
    assert_eq!(d.notices().unwrap().len(), 1);
    assert!(d.task(&t.id).unwrap().review_at.is_some());
}
#[test]
fn editing_returned_task_does_not_rearm_expired_wake() {
    let mut d = db();
    let mut t = Task::new("Already returned".into(), 100);
    t.status = Status::Settled;
    t.wake_at = Some(200);
    let t = d.save(t, "Created", 100).unwrap();
    d.reconcile(300).unwrap();
    let t = d.task(&t.id).unwrap();
    d.save(t, "Edited", 301).unwrap();
    d.reconcile(302).unwrap();
    assert_eq!(d.notices().unwrap().len(), 1);
}
#[test]
fn early_wake_keeps_review_separate_and_consumes_timer() {
    for status in [Status::Settled, Status::Snoozed] {
        let mut d = db();
        let mut t = Task::new("Return early".into(), 100);
        t.status = status.clone();
        t.wake_at = Some(1000);
        t.scheduled_at = Some(2000);
        t.due_at = Some(3000);
        let t = d.save(t, "Created", 100).unwrap();
        let t = d.surface_now(&t.id, t.updated_at, 200).unwrap();
        assert_eq!(t.status, status);
        assert_eq!(t.wake_at, None);
        assert_eq!(t.review_at, Some(200));
        assert_eq!(t.scheduled_at, Some(2000));
        assert_eq!(t.due_at, Some(3000));
        assert!(d.surface_now(&t.id, t.updated_at, 201).is_err());
        d.reconcile(1100).unwrap();
        assert!(d.notices().unwrap().is_empty());
        assert_eq!(d.history(&t.id).unwrap().len(), 2);
    }
}
#[test]
fn resume_restores_previous_plan_instead_of_starting() {
    let mut d = db();
    let mut t = Task::new("Planned".into(), 100);
    t.status = Status::Scheduled;
    t.scheduled_at = Some(5000);
    let mut t = d.save(t, "Created", 100).unwrap();
    t.status = Status::Settled;
    t.wake_at = Some(1000);
    let t = d.save(t, "Settled", 200).unwrap();
    let t = d.resume(&t.id, t.updated_at, 300).unwrap();
    assert_eq!(t.status, Status::Scheduled);
    assert_eq!(t.wake_at, None);
    assert_eq!(t.review_at, None);
    assert_eq!(t.scheduled_at, Some(5000));
}
#[test]
fn resume_legacy_falls_back_to_inbox() {
    let mut d = db();
    let mut t = Task::new("Waiting".into(), 100);
    t.status = Status::Waiting;
    let t = d.save(t, "Created", 100).unwrap();
    let t = d.resume(&t.id, t.updated_at, 200).unwrap();
    assert_eq!(t.status, Status::Inbox);
}
#[test]
fn undo_is_persisted_and_guarded() {
    let mut d = db();
    let mut t = d
        .save(Task::new("Undo finish".into(), 100), "Created", 100)
        .unwrap();
    t.status = Status::Finished;
    let t = d.save(t, "Finished", 200).unwrap();
    let t = d.undo(&t.id, t.updated_at, 210).unwrap();
    assert_eq!(t.status, Status::Inbox);
    assert_eq!(t.completed_at, None);
    assert_eq!(d.history(&t.id).unwrap()[0]["action"], "Undone");
    assert!(d.undo(&t.id, t.updated_at, 211).is_err());
    let mut t = t;
    t.status = Status::Dropped;
    let t = d.save(t, "Dropped", 220).unwrap();
    assert!(d.undo(&t.id, t.updated_at, 251).is_err());
    let changed = d.save(t.clone(), "Edited", 221).unwrap();
    assert!(d.undo(&t.id, t.updated_at, 222).is_err());
    assert!(d.undo(&changed.id, changed.updated_at, 222).is_err());
}
#[test]
fn profile_and_sidebar_settings_survive_reopen() {
    let d = db();
    let mut s = d.settings().unwrap();
    s.name = "Dim".into();
    s.workspace = "Studio".into();
    s.profile_image = Some("local.png".into());
    s.sidebar_width = 300;
    s.sidebar_collapsed = true;
    s.command_shortcut = "Ctrl+Shift+P".into();
    d.set_settings(&s).unwrap();
    let d = Store::init(d.conn).unwrap();
    let s = d.settings().unwrap();
    assert_eq!(s.name, "Dim");
    assert_eq!(s.sidebar_width, 300);
    assert!(s.sidebar_collapsed);
    assert_eq!(s.profile_image.as_deref(), Some("local.png"));
}
#[test]
fn migration_from_v1_preserves_tasks_and_adds_error_history() {
    let d = db();
    let conn = d.conn;
    conn.execute_batch("ALTER TABLE notifications DROP COLUMN error; PRAGMA user_version=1;")
        .unwrap();
    let mut d = Store::init(conn).unwrap();
    let t = d
        .save(Task::new("Migrated".into(), 100), "Created", 100)
        .unwrap();
    let d = Store::init(d.conn).unwrap();
    assert_eq!(d.task(&t.id).unwrap().title, "Migrated");
    assert!(d.notices().unwrap().is_empty());
}
#[test]
fn permanent_delete_removes_owned_records_and_preserves_other_tasks() {
    let mut d = db();
    let mut t = Task::new("Remove completely".into(), 100);
    t.status = Status::Snoozed;
    t.wake_at = Some(200);
    t.description = "Private notes".into();
    let t = d.save(t, "Created", 100).unwrap();
    d.reconcile(300).unwrap();
    let t = d.task(&t.id).unwrap();
    let mut child = Task::new("Keep child".into(), 100);
    child.parent_task_id = Some(t.id.clone());
    let child = d.save(child, "Created", 100).unwrap();
    d.delete_task(&t.id, t.updated_at).unwrap();
    assert!(d.task(&t.id).is_err());
    assert!(d.notices().unwrap().is_empty());
    assert!(d.history(&t.id).unwrap().is_empty());
    assert_eq!(
        d.conn
            .query_row(
                "SELECT count(*) FROM events WHERE task_id=?1",
                [&t.id],
                |r| r.get::<_, i64>(0)
            )
            .unwrap(),
        0
    );
    let kept = d.task(&child.id).unwrap();
    assert_eq!(kept.parent_task_id, None);
    assert!(kept.updated_at > child.updated_at);
    assert_eq!(d.history(&child.id).unwrap().len(), 1);
    let d = Store::init(d.conn).unwrap();
    assert_eq!(d.tasks().unwrap().len(), 1);
}
#[test]
fn permanent_delete_rejects_stale_confirmation() {
    let mut d = db();
    let t = d
        .save(Task::new("Changed task".into(), 100), "Created", 100)
        .unwrap();
    d.save(t.clone(), "Edited", 200).unwrap();
    assert!(d.delete_task(&t.id, t.updated_at).is_err());
    assert!(d.task(&t.id).is_ok());
}
#[test]
fn permanent_delete_rolls_back_all_records_on_failure() {
    let mut d = db();
    let mut t = Task::new("Keep on failure".into(), 100);
    t.status = Status::Snoozed;
    t.wake_at = Some(200);
    let t = d.save(t, "Created", 100).unwrap();
    d.reconcile(300).unwrap();
    let t = d.task(&t.id).unwrap();
    d.conn.execute_batch("CREATE TRIGGER fail_delete BEFORE DELETE ON tasks BEGIN SELECT RAISE(ABORT,'test failure'); END;").unwrap();
    assert!(d.delete_task(&t.id, t.updated_at).is_err());
    assert!(d.task(&t.id).is_ok());
    assert_eq!(d.notices().unwrap().len(), 1);
    assert_eq!(d.history(&t.id).unwrap().len(), 2);
    assert_eq!(
        d.conn
            .query_row("SELECT count(*) FROM events", [], |r| r.get::<_, i64>(0))
            .unwrap(),
        1
    );
}
#[test]
fn settlement_metadata_survives_edits_and_restarts() {
    let mut d = db();
    let mut t = Task::new("Pause".into(), 100);
    t.status = Status::Settled;
    t.wake_at = Some(86500);
    t.settlement_mode = Some("24h".into());
    let t = d.save(t, "Settled", 100).unwrap();
    assert_eq!(t.settled_at, Some(100));
    let mut edited = t;
    edited.description = "Context".into();
    let t = d.save(edited, "Edited", 200).unwrap();
    assert_eq!(t.settled_at, Some(100));
    assert_eq!(t.settlement_mode.as_deref(), Some("24h"));
    let mut d = Store::init(d.conn).unwrap();
    d.reconcile(86501).unwrap();
    let t = d.task(&t.id).unwrap();
    assert_eq!(t.settled_at, Some(100));
    assert!(t.review_at.is_some());
}
#[test]
fn legacy_task_json_remains_readable() {
    let t = Task::new("Older task".into(), 100);
    let mut value = serde_json::to_value(t).unwrap();
    value.as_object_mut().unwrap().remove("settled_at");
    value.as_object_mut().unwrap().remove("settlement_mode");
    let parsed: Task = serde_json::from_value(value).unwrap();
    assert_eq!(parsed.settled_at, None);
    assert_eq!(parsed.settlement_mode, None);
}
#[test]
fn persistence_survives_reopening() {
    let path = std::env::temp_dir().join(format!("reprise-test-{}.sqlite", uuid::Uuid::new_v4()));
    let id;
    {
        let mut d = Store::open(&path).unwrap();
        id = d
            .save(Task::new("Keep me".into(), 100), "Created", 100)
            .unwrap()
            .id;
    }
    {
        let d = Store::open(&path).unwrap();
        assert_eq!(d.task(&id).unwrap().title, "Keep me");
    }
    std::fs::remove_file(path).unwrap();
}
fn db() -> Store {
    Store::init(rusqlite::Connection::open_in_memory().unwrap()).unwrap()
}
#[test]
fn snooze_reconciles_once_and_preserves_dates() {
    let mut d = db();
    let mut t = Task::new("Return".into(), 100);
    t.status = Status::Snoozed;
    t.scheduled_at = Some(500);
    t.due_at = Some(900);
    t.wake_at = Some(200);
    let t = d.save(t, "Snoozed", 100).unwrap();
    d.reconcile(300).unwrap();
    d.reconcile(400).unwrap();
    let t = d.task(&t.id).unwrap();
    assert_eq!(t.status, Status::Snoozed);
    assert_eq!(t.scheduled_at, Some(500));
    assert_eq!(t.due_at, Some(900));
    assert_eq!(t.review_at, Some(300));
    assert_eq!(d.notices().unwrap().len(), 1);
}
#[test]
fn waiting_does_not_resolve_dependency() {
    let mut d = db();
    let mut t = Task::new("Response".into(), 100);
    t.status = Status::Waiting;
    t.wake_at = Some(200);
    let t = d.save(t, "Waiting", 100).unwrap();
    d.reconcile(500).unwrap();
    assert_eq!(d.task(&t.id).unwrap().status, Status::Waiting);
}
#[test]
fn completion_and_reopening() {
    let mut d = db();
    let t = d
        .save(Task::new("Work".into(), 100), "Created", 100)
        .unwrap();
    let mut t = t;
    t.status = Status::Finished;
    let mut t = d.save(t, "Finished", 200).unwrap();
    assert_eq!(t.completed_at, Some(200));
    t.status = Status::Inbox;
    let t = d.save(t, "Reopened", 300).unwrap();
    assert_eq!(t.completed_at, None);
    assert_eq!(d.history(&t.id).unwrap().len(), 3);
}
#[test]
fn stale_edits_are_rejected() {
    let mut d = db();
    let t = d
        .save(Task::new("Work".into(), 100), "Created", 100)
        .unwrap();
    d.save(t.clone(), "Edited", 101).unwrap();
    assert!(d.save(t, "Edited", 102).is_err());
}
#[test]
fn settlement_dst() {
    let tz = chrono_tz::America::New_York;
    let now = tz
        .with_ymd_and_hms(2026, 3, 7, 9, 0, 0)
        .unwrap()
        .timestamp();
    assert_eq!(settlement(&tz, now, "24h", "09:00").unwrap(), now + 86400);
    assert_eq!(
        settlement(&tz, now, "next_day", "09:00").unwrap(),
        now + 23 * 3600
    );
    let gap = local_time(
        &tz,
        chrono::NaiveDate::from_ymd_opt(2026, 3, 8).unwrap(),
        "02:30",
    )
    .unwrap();
    assert_eq!(tz.timestamp_opt(gap, 0).unwrap().hour(), 3);
}
#[test]
fn daily_review_deduplicates() {
    let mut d = db();
    d.save(Task::new("Review me".into(), 100), "Created", 100)
        .unwrap();
    let now = chrono::Local::now()
        .date_naive()
        .and_hms_opt(23, 59, 0)
        .unwrap()
        .and_local_timezone(chrono::Local)
        .earliest()
        .unwrap()
        .timestamp();
    d.daily_review(now).unwrap();
    d.daily_review(now).unwrap();
    assert_eq!(d.notices().unwrap().len(), 1);
}
#[test]
fn migrations_repeat_safely() {
    let d = db();
    assert_eq!(
        d.conn
            .query_row("PRAGMA user_version", [], |r| r.get::<_, i32>(0))
            .unwrap(),
        3
    );
    let d = Store::init(d.conn).unwrap();
    assert!(d.tasks().unwrap().is_empty());
}
#[test]
fn quiet_hours_cross_midnight() {
    assert!(quiet("23:00", "22:00", "08:00"));
    assert!(quiet("07:00", "22:00", "08:00"));
    assert!(!quiet("12:00", "22:00", "08:00"));
}

#[test]
fn notification_management_is_durable_and_does_not_resurface_tasks() {
    let mut d = db();
    let mut t = Task::new("Pause".into(), 100);
    t.status = Status::Snoozed;
    t.wake_at = Some(200);
    let t = d.save(t, "Snoozed", 100).unwrap();
    d.reconcile(201).unwrap();
    let id = d.notices().unwrap()[0].id.clone();
    d.manage_notices("dismiss", &[id.clone()], 202).unwrap();
    let mut d = Store::init(d.conn).unwrap();
    d.reconcile(300).unwrap();
    assert!(d.notices().unwrap().is_empty());
    assert!(d.task(&t.id).unwrap().review_at.is_some());
    assert_eq!(
        d.conn
            .query_row("SELECT state FROM notifications WHERE id=?1", [id], |r| {
                r.get::<_, String>(0)
            })
            .unwrap(),
        "Pending"
    );
}
#[test]
fn notification_bulk_operations_and_confirmation_snapshot_are_distinct() {
    let mut d = db();
    for (id, unread) in [("a", 0), ("b", 1), ("incoming", 1)] {
        d.conn.execute("INSERT INTO notifications(id,category,title,message,created_at,scheduled_at,unread) VALUES(?1,'Diagnostic','test','body',1,1,?2)",rusqlite::params![id,unread]).unwrap();
    }
    d.manage_notices("clear_read", &["a".into(), "b".into()], 10)
        .unwrap();
    assert_eq!(d.notices().unwrap().len(), 2);
    d.manage_notices("read", &["b".into()], 11).unwrap();
    assert!(
        d.notices()
            .unwrap()
            .iter()
            .find(|n| n.id == "b")
            .unwrap()
            .read
    );
    d.manage_notices("clear_all", &["b".into()], 12).unwrap();
    assert_eq!(d.notices().unwrap()[0].id, "incoming");
    assert!(d
        .manage_notices("unknown", &["incoming".into()], 13)
        .is_err());
}
#[test]
fn daily_review_grammar_empty_day_and_clear_do_not_recreate() {
    let mut d = db();
    let mut s = d.settings().unwrap();
    s.review_time = "00:00".into();
    d.set_settings(&s).unwrap();
    let now = chrono::Utc::now().timestamp();
    d.daily_review(now).unwrap();
    assert!(d.notices().unwrap().is_empty());
    d.save(Task::new("Inbox".into(), now), "Created", now)
        .unwrap();
    d.daily_review(now).unwrap();
    assert!(d.notices().unwrap().is_empty());
    d.conn
        .execute("DELETE FROM retired_notifications", [])
        .unwrap();
    d.daily_review(now).unwrap();
    let n = d.notices().unwrap().remove(0);
    assert_eq!(n.message, "You have 1 task waiting for your attention.");
    d.manage_notices("clear_all", &[n.id], now).unwrap();
    let d = Store::init(d.conn).unwrap();
    d.daily_review(now + 1).unwrap();
    assert!(d.notices().unwrap().is_empty());
}
#[test]
fn notification_management_rolls_back_on_failure() {
    let mut d = db();
    for id in ["a", "b"] {
        d.conn.execute("INSERT INTO notifications(id,category,title,message,created_at,scheduled_at) VALUES(?1,'Diagnostic','test','body',1,1)",[id]).unwrap();
    }
    d.conn.execute_batch("CREATE TRIGGER fail_clear BEFORE DELETE ON notifications WHEN OLD.id='b' BEGIN SELECT RAISE(ABORT,'test failure'); END;").unwrap();
    assert!(d
        .manage_notices("clear_all", &["a".into(), "b".into()], 2)
        .is_err());
    assert_eq!(d.notices().unwrap().len(), 2);
}
