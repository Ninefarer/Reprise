//! Opt-in measurements of existing Store APIs, not an application latency test.
use crate::{domain::Task, store::Store};
use rusqlite::{params, Connection};
use std::{hint::black_box, time::Instant};

fn percentile(samples: &[f64], p: usize) -> f64 {
    let mut values = samples.to_vec();
    values.sort_by(f64::total_cmp);
    values[(values.len() * p).div_ceil(100).saturating_sub(1)]
}

#[test]
#[ignore = "Manual release-mode synthetic Store benchmark; no real profile or timing assertions"]
fn snapshot_path_baseline() {
    println!("tasks,notices,bytes,tasks_median_ms,notices_median_ms,value_median_ms,encoding_median_ms,total_median_ms,total_p95_ms");
    for (tasks_count, notices_count) in [(100, 0), (1_000, 1_000), (10_000, 10_000)] {
        let mut store = Store::init(Connection::open_in_memory().unwrap()).unwrap();
        let tx = store.conn.transaction().unwrap();
        {
            let mut task_insert = tx
                .prepare("INSERT INTO tasks(id,data) VALUES(?1,?2)")
                .unwrap();
            let mut notice_insert = tx.prepare("INSERT INTO notifications(id,category,title,message,created_at,scheduled_at,state) VALUES(?1,'Diagnostic','Synthetic reminder',?2,?3,?3,'Submitted')").unwrap();
            for i in 0..tasks_count {
                let mut task = Task::new(format!("Synthetic task {i}"), 1_700_000_000 + i);
                task.description = "Synthetic context for repeatable measurements. ".repeat(8);
                task_insert
                    .execute(params![task.id, serde_json::to_string(&task).unwrap()])
                    .unwrap();
            }
            for i in 0..notices_count {
                notice_insert
                    .execute(params![
                        format!("perf:{i}"),
                        "Synthetic reminder text. ".repeat(4),
                        1_700_000_000_i64 + i as i64
                    ])
                    .unwrap();
            }
        }
        tx.commit().unwrap();
        let mut task_times = vec![];
        let mut notice_times = vec![];
        let mut packing_times = vec![];
        let mut encoding_times = vec![];
        let mut total_times = vec![];
        let mut payload_bytes = 0;
        for pass in 0..17 {
            let start = Instant::now();
            let tasks = store.tasks().unwrap();
            let task_done = start.elapsed().as_secs_f64() * 1_000.0;
            let settings = store.settings().unwrap();
            let settings_done = start.elapsed().as_secs_f64() * 1_000.0;
            let notifications = store.notices().unwrap();
            let notices_done = start.elapsed().as_secs_f64() * 1_000.0;
            assert_eq!(tasks.len(), tasks_count as usize);
            assert_eq!(notifications.len(), notices_count as usize);
            let value = serde_json::json!({
                "tasks": tasks, "settings": settings, "notifications": notifications
            });
            let packed = start.elapsed().as_secs_f64() * 1_000.0;
            let payload = serde_json::to_vec(&value).unwrap();
            payload_bytes = payload.len();
            black_box(payload);
            let total = start.elapsed().as_secs_f64() * 1_000.0;
            if pass >= 2 {
                task_times.push(task_done);
                notice_times.push(notices_done - settings_done);
                packing_times.push(packed - notices_done);
                encoding_times.push(total - packed);
                total_times.push(total);
            }
        }
        println!(
            "{tasks_count},{notices_count},{payload_bytes},{:.3},{:.3},{:.3},{:.3},{:.3},{:.3}",
            percentile(&task_times, 50),
            percentile(&notice_times, 50),
            percentile(&packing_times, 50),
            percentile(&encoding_times, 50),
            percentile(&total_times, 50),
            percentile(&total_times, 95)
        );
    }
}
