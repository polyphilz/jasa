use std::fs;
use std::path::{Path, PathBuf};

use serde_json::Value;
use tauri::State;

use crate::AppState;

#[derive(Debug, thiserror::Error)]
pub enum Error {
    #[error("io error: {0}")]
    Io(#[from] std::io::Error),
    #[error("invalid session file: {0}")]
    Json(#[from] serde_json::Error),
    #[error("{0}")]
    Invalid(String),
}

impl serde::Serialize for Error {
    fn serialize<S: serde::Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        serializer.serialize_str(&self.to_string())
    }
}

pub fn sessions_dir(data_dir: &Path) -> PathBuf {
    data_dir.join("sessions")
}

fn session_path(state: &AppState, id: &str) -> Result<PathBuf, Error> {
    let valid = !id.is_empty()
        && id.len() <= 64
        && id.chars().all(|c| c.is_ascii_alphanumeric() || c == '-');
    if !valid {
        return Err(Error::Invalid(format!("invalid session id: {id:?}")));
    }
    Ok(sessions_dir(&state.data_dir).join(format!("{id}.json")))
}

#[tauri::command]
pub fn list_sessions(state: State<AppState>) -> Result<Vec<Value>, Error> {
    let mut metas = Vec::new();
    for entry in fs::read_dir(sessions_dir(&state.data_dir))? {
        let path = entry?.path();
        if path.extension().is_none_or(|ext| ext != "json") {
            continue;
        }
        let session: Value = match fs::read_to_string(&path)
            .map_err(Error::from)
            .and_then(|text| serde_json::from_str(&text).map_err(Error::from))
        {
            Ok(session) => session,
            Err(error) => {
                log::warn!("skipping unreadable session {}: {error}", path.display());
                continue;
            }
        };
        metas.push(serde_json::json!({
            "id": session["id"],
            "question": session["question"],
            "updatedAt": session["updatedAt"],
            "nodeCount": session["nodes"].as_array().map_or(0, Vec::len),
        }));
    }
    metas.sort_by(|a, b| {
        let key = |meta: &Value| meta["updatedAt"].as_str().unwrap_or("").to_owned();
        key(b).cmp(&key(a))
    });
    Ok(metas)
}

#[tauri::command]
pub fn load_session(state: State<AppState>, id: String) -> Result<Value, Error> {
    let text = fs::read_to_string(session_path(&state, &id)?)?;
    Ok(serde_json::from_str(&text)?)
}

#[tauri::command]
pub fn save_session(state: State<AppState>, session: Value) -> Result<(), Error> {
    let id = session["id"]
        .as_str()
        .ok_or_else(|| Error::Invalid("session is missing an id".into()))?;
    let path = session_path(&state, id)?;
    let tmp = path.with_extension("json.tmp");
    fs::write(&tmp, serde_json::to_vec_pretty(&session)?)?;
    fs::rename(&tmp, &path)?;
    Ok(())
}

#[tauri::command]
pub fn delete_session(state: State<AppState>, id: String) -> Result<(), Error> {
    fs::remove_file(session_path(&state, &id)?)?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use tauri::Manager;

    #[test]
    fn session_roundtrip() {
        let dir = tempfile::tempdir().unwrap();
        let app = crate::test_support::mock_app(dir.path().to_owned());
        let session = serde_json::json!({
            "id": "abc-123",
            "question": "How does attention work?",
            "updatedAt": "2026-07-26T00:00:00Z",
            "nodes": [{ "id": "n1" }],
        });

        save_session(app.state(), session.clone()).unwrap();
        assert_eq!(load_session(app.state(), "abc-123".into()).unwrap(), session);

        let metas = list_sessions(app.state()).unwrap();
        assert_eq!(metas.len(), 1);
        assert_eq!(metas[0]["id"], "abc-123");
        assert_eq!(metas[0]["nodeCount"], 1);

        delete_session(app.state(), "abc-123".into()).unwrap();
        assert!(list_sessions(app.state()).unwrap().is_empty());
    }

    #[test]
    fn rejects_invalid_session_ids() {
        let dir = tempfile::tempdir().unwrap();
        let app = crate::test_support::mock_app(dir.path().to_owned());
        assert!(load_session(app.state(), "../evil".into()).is_err());
        assert!(delete_session(app.state(), "a/b".into()).is_err());
        assert!(save_session(app.state(), serde_json::json!({ "id": "" })).is_err());
    }
}
