//! Transactional deletion receipts, private to the running app's Undo notices.
use crate::store::{Result, Store};
use rusqlite::{params, Connection};
use serde_json::{json, Value};
fn err(e: impl std::fmt::Display) -> String {
    e.to_string()
}
fn columns(db: &Connection, table: &str) -> Result<Vec<String>> {
    let mut q = db
        .prepare(&format!("PRAGMA table_info({table})"))
        .map_err(err)?;
    let rows = q.query_map([], |r| r.get(1)).map_err(err)?;
    rows.collect::<std::result::Result<_, _>>().map_err(err)
}
pub fn capture(db: &Connection, id: &str) -> Result<Value> {
    let mut receipt = json!({});
    for table in ["tasks", "events", "history", "notifications"] {
        let cols = columns(db, table)?;
        let filter = if table == "tasks" { "id" } else { "task_id" };
        let query = format!(
            "SELECT json_array({}) FROM {table} WHERE {filter}=?1 ORDER BY rowid",
            cols.join(",")
        );
        let mut q = db.prepare(&query).map_err(err)?;
        let rows = q.query_map([id], |r| r.get::<_, String>(0)).map_err(err)?;
        let data = rows
            .map(|r| serde_json::from_str::<Value>(&r.map_err(err)?).map_err(err))
            .collect::<Result<Vec<_>>>()?;
        receipt[table] = json!({"columns":cols,"rows":data});
    }
    let mut q = db
        .prepare("SELECT data FROM tasks WHERE json_extract(data,'$.parent_task_id')=?1")
        .map_err(err)?;
    let children = q.query_map([id], |r| r.get::<_, String>(0)).map_err(err)?;
    receipt["children"] = json!(children
        .collect::<std::result::Result<Vec<_>, _>>()
        .map_err(err)?);
    Ok(receipt)
}
pub fn capture_detached(db: &Connection, receipt: &mut Value) -> Result<()> {
    let mut detached = Vec::new();
    for child in receipt["children"].as_array().ok_or("Invalid children")? {
        let before: Value =
            serde_json::from_str(child.as_str().ok_or("Invalid child")?).map_err(err)?;
        let after: String = db
            .query_row(
                "SELECT data FROM tasks WHERE id=?1",
                [before["id"].as_str().ok_or("Invalid child id")?],
                |r| r.get(0),
            )
            .map_err(err)?;
        detached.push(json!({"before":child,"after":after}));
    }
    receipt["children"] = json!(detached);
    Ok(())
}
impl Store {
    pub fn restore_deletion(&mut self, token: &str) -> Result<()> {
        let tx = self.conn.transaction().map_err(err)?;
        let data: String = tx
            .query_row(
                "SELECT data FROM deletion_undo WHERE token=?1",
                [token],
                |r| r.get(0),
            )
            .map_err(|_| "Deletion can no longer be undone.".to_string())?;
        let receipt: Value = serde_json::from_str(&data).map_err(err)?;
        for table in ["tasks", "events", "history", "notifications"] {
            let cols: Vec<String> =
                serde_json::from_value(receipt[table]["columns"].clone()).map_err(err)?;
            let fields: Vec<_> = cols
                .iter()
                .enumerate()
                .filter(|(_, c)| !(table == "history" && *c == "id"))
                .collect();
            let names = fields
                .iter()
                .map(|(_, c)| c.as_str())
                .collect::<Vec<_>>()
                .join(",");
            let values = fields
                .iter()
                .map(|(i, _)| format!("json_extract(?1,'$[{i}]')"))
                .collect::<Vec<_>>()
                .join(",");
            for row in receipt[table]["rows"]
                .as_array()
                .ok_or("Invalid deletion receipt")?
            {
                let sql = if table == "notifications" {
                    format!("INSERT INTO {table}({names}) SELECT {values} WHERE json_extract(?1,'$[0]') NOT IN (SELECT id FROM retired_notifications)")
                } else {
                    format!("INSERT INTO {table}({names}) VALUES({values})")
                };
                tx.execute(&sql, [row.to_string()]).map_err(err)?;
            }
        }
        // Only reattach untouched children. Never overwrite edits made while detached.
        for child in receipt["children"].as_array().ok_or("Invalid children")? {
            tx.execute("UPDATE tasks SET data=json_set(?1,'$.updated_at',json_extract(data,'$.updated_at')+1) WHERE data=?2", params![child["before"].as_str(),child["after"].as_str()]).map_err(err)?;
        }
        let task_id = receipt["tasks"]["rows"][0][0]
            .as_str()
            .ok_or("Invalid task id")?;
        tx.execute("UPDATE tasks SET data=json_set(data,'$.updated_at',max(json_extract(data,'$.updated_at')+1,?2)) WHERE id=?1",params![task_id,chrono::Utc::now().timestamp()]).map_err(err)?;
        tx.execute("DELETE FROM deletion_undo WHERE token=?1", [token])
            .map_err(err)?;
        tx.commit().map_err(err)
    }
}
