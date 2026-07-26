use std::collections::HashMap;
use std::io::{BufRead, BufReader, Read, Write};
use std::path::PathBuf;
use std::process::{Child, Command, Stdio};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};

use tauri::{AppHandle, Emitter, Manager, State};

use crate::AppState;

/// A running `claude -p` process for one node. Kept in app state so it can be
/// killed when the user cancels or regenerates.
pub struct Generation {
    child: Arc<Mutex<Child>>,
    canceled: Arc<AtomicBool>,
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GenerationRequest {
    session_id: String,
    node_id: String,
    prompt: String,
    /// Model alias or full model name for the CLI; None inherits its default.
    model: Option<String>,
    /// Reasoning effort for the CLI; None inherits its default.
    effort: Option<String>,
}

const EFFORT_LEVELS: [&str; 5] = ["low", "medium", "high", "xhigh", "max"];

fn validate_effort(effort: &str) -> Result<(), String> {
    if EFFORT_LEVELS.contains(&effort) {
        Ok(())
    } else {
        Err(format!("invalid effort level: {effort:?}"))
    }
}

fn validate_model(model: &str) -> Result<(), String> {
    let valid = !model.is_empty()
        && model.len() <= 64
        && !model.starts_with('-')
        && model
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || matches!(c, '-' | '.' | '_' | '[' | ']'));
    if valid {
        Ok(())
    } else {
        Err(format!("invalid model name: {model:?}"))
    }
}

#[derive(Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct LinePayload {
    session_id: String,
    node_id: String,
    line: String,
}

#[derive(Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct ExitPayload {
    session_id: String,
    node_id: String,
    success: bool,
    canceled: bool,
    error: Option<String>,
}

#[derive(Debug, Default, PartialEq, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CliDefaults {
    model: Option<String>,
    effort: Option<String>,
}

/// What "CLI default" actually resolves to, read from the Claude Code user
/// settings. Keys absent there fall through to the CLI's built-in defaults,
/// which vary by version and plan, so they stay None rather than a guess.
fn read_cli_defaults(settings_path: &std::path::Path) -> CliDefaults {
    let Ok(text) = std::fs::read_to_string(settings_path) else {
        return CliDefaults::default();
    };
    let Ok(settings) = serde_json::from_str::<serde_json::Value>(&text) else {
        return CliDefaults::default();
    };
    CliDefaults {
        model: settings["model"].as_str().map(str::to_owned),
        effort: settings["effortLevel"].as_str().map(str::to_owned),
    }
}

#[tauri::command]
pub fn cli_defaults() -> CliDefaults {
    let config_dir = std::env::var_os("CLAUDE_CONFIG_DIR")
        .map(PathBuf::from)
        .or_else(|| std::env::var_os("HOME").map(|home| PathBuf::from(home).join(".claude")));
    match config_dir {
        Some(dir) => read_cli_defaults(&dir.join("settings.json")),
        None => CliDefaults::default(),
    }
}

/// GUI launches don't inherit a login-shell PATH, so probe the usual install
/// locations before falling back to plain `claude`.
fn claude_binary() -> PathBuf {
    let home = std::env::var_os("HOME").map(PathBuf::from);
    let candidates = [
        home.as_ref().map(|home| home.join(".local/bin/claude")),
        home.as_ref().map(|home| home.join(".claude/local/claude")),
        Some(PathBuf::from("/opt/homebrew/bin/claude")),
        Some(PathBuf::from("/usr/local/bin/claude")),
    ];
    for candidate in candidates.into_iter().flatten() {
        if candidate.is_file() {
            return candidate;
        }
    }
    PathBuf::from("claude")
}

fn cancel_entry(generations: &Mutex<HashMap<String, Generation>>, node_id: &str) {
    let entry = generations.lock().unwrap().remove(node_id);
    if let Some(generation) = entry {
        generation.canceled.store(true, Ordering::SeqCst);
        let _ = generation.child.lock().unwrap().kill();
    }
}

#[tauri::command]
pub fn start_generation<R: tauri::Runtime>(
    app: AppHandle<R>,
    state: State<'_, AppState>,
    request: GenerationRequest,
) -> Result<(), String> {
    cancel_entry(&state.generations, &request.node_id);

    let workdir = state.data_dir.join("workdir");
    std::fs::create_dir_all(&workdir).map_err(|error| error.to_string())?;

    let mut command = Command::new(claude_binary());
    command.args([
        "-p",
        "--output-format",
        "stream-json",
        "--verbose",
        "--include-partial-messages",
        "--tools",
        "WebSearch,WebFetch",
        "--allowed-tools",
        "WebSearch,WebFetch",
    ]);
    if let Some(model) = &request.model {
        validate_model(model)?;
        command.args(["--model", model]);
    }
    if let Some(effort) = &request.effort {
        validate_effort(effort)?;
        command.args(["--effort", effort]);
    }
    let mut child = command
        .current_dir(&workdir)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|error| format!("failed to launch the claude CLI: {error}"))?;

    let stdin = child.stdin.take();
    let stdout = child.stdout.take().expect("stdout is piped");
    let mut stderr = child.stderr.take().expect("stderr is piped");

    let child = Arc::new(Mutex::new(child));
    let canceled = Arc::new(AtomicBool::new(false));
    state.generations.lock().unwrap().insert(
        request.node_id.clone(),
        Generation {
            child: child.clone(),
            canceled: canceled.clone(),
        },
    );

    let prompt = request.prompt;
    std::thread::spawn(move || {
        if let Some(mut stdin) = stdin {
            let _ = stdin.write_all(prompt.as_bytes());
        }
    });

    let stderr_collector = std::thread::spawn(move || {
        let mut text = String::new();
        let _ = stderr.read_to_string(&mut text);
        text
    });

    let GenerationRequest {
        session_id, node_id, ..
    } = request;
    std::thread::spawn(move || {
        for line in BufReader::new(stdout).lines() {
            let Ok(line) = line else { break };
            if line.trim().is_empty() {
                continue;
            }
            let _ = app.emit(
                "agent-line",
                LinePayload {
                    session_id: session_id.clone(),
                    node_id: node_id.clone(),
                    line,
                },
            );
        }
        let status = child.lock().unwrap().wait();
        let stderr_text = stderr_collector.join().unwrap_or_default();
        let success = status.as_ref().is_ok_and(std::process::ExitStatus::success);
        let was_canceled = canceled.load(Ordering::SeqCst);

        let generations = &app.state::<AppState>().generations;
        let mut generations = generations.lock().unwrap();
        // Only clear our own entry: a cancel + regenerate may already have
        // replaced it with a newer generation for the same node.
        if generations
            .get(&node_id)
            .is_some_and(|current| Arc::ptr_eq(&current.canceled, &canceled))
        {
            generations.remove(&node_id);
        }
        drop(generations);

        let error = if success || was_canceled {
            None
        } else {
            let detail = stderr_text.trim();
            let mut start = detail.len().saturating_sub(800);
            while !detail.is_char_boundary(start) {
                start -= 1;
            }
            let detail = &detail[start..];
            Some(if detail.is_empty() {
                "the claude CLI exited with an error".to_owned()
            } else {
                detail.to_owned()
            })
        };
        let _ = app.emit(
            "agent-exit",
            ExitPayload {
                session_id,
                node_id,
                success,
                canceled: was_canceled,
                error,
            },
        );
    });

    Ok(())
}

#[tauri::command]
pub fn cancel_generation(state: State<'_, AppState>, node_id: String) {
    cancel_entry(&state.generations, &node_id);
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::mpsc;
    use std::time::Duration;
    use tauri::{Listener, Manager};

    #[test]
    fn model_validation() {
        assert!(validate_model("sonnet").is_ok());
        assert!(validate_model("haiku").is_ok());
        assert!(validate_model("claude-fable-5").is_ok());
        assert!(validate_model("sonnet[1m]").is_ok());
        assert!(validate_model("").is_err());
        assert!(validate_model("bad model").is_err());
        assert!(validate_model("--dangerously-skip-permissions").is_err());
    }

    #[test]
    fn cli_defaults_from_settings_file() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("settings.json");

        assert_eq!(read_cli_defaults(&path), CliDefaults::default());

        std::fs::write(&path, r#"{ "model": "claude-fable-5[1m]", "effortLevel": "xhigh" }"#)
            .unwrap();
        assert_eq!(
            read_cli_defaults(&path),
            CliDefaults {
                model: Some("claude-fable-5[1m]".to_owned()),
                effort: Some("xhigh".to_owned()),
            }
        );

        std::fs::write(&path, r#"{ "permissions": {} }"#).unwrap();
        assert_eq!(read_cli_defaults(&path), CliDefaults::default());

        std::fs::write(&path, "not json").unwrap();
        assert_eq!(read_cli_defaults(&path), CliDefaults::default());
    }

    #[test]
    fn effort_validation() {
        for level in EFFORT_LEVELS {
            assert!(validate_effort(level).is_ok());
        }
        assert!(validate_effort("").is_err());
        assert!(validate_effort("default").is_err());
        assert!(validate_effort("--verbose").is_err());
    }

    /// Exercises the full pipeline against the real claude CLI: spawn,
    /// stream-json lines emitted as `agent-line`, then a successful
    /// `agent-exit`. Needs the CLI installed and authenticated, so it is
    /// ignored by default; run with `cargo test -- --ignored`.
    #[test]
    #[ignore]
    fn generation_pipeline_streams_and_completes() {
        let dir = tempfile::tempdir().unwrap();
        let app = crate::test_support::mock_app(dir.path().to_owned());

        let (line_tx, line_rx) = mpsc::channel::<String>();
        let (exit_tx, exit_rx) = mpsc::channel::<String>();
        app.listen_any("agent-line", move |event| {
            let _ = line_tx.send(event.payload().to_owned());
        });
        app.listen_any("agent-exit", move |event| {
            let _ = exit_tx.send(event.payload().to_owned());
        });

        start_generation(
            app.handle().clone(),
            app.state(),
            GenerationRequest {
                session_id: "test-session".to_owned(),
                node_id: "test-node".to_owned(),
                prompt: "Reply with exactly the word OK and nothing else.".to_owned(),
                model: Some("haiku".to_owned()),
                effort: Some("low".to_owned()),
            },
        )
        .expect("start_generation failed");

        let exit = exit_rx
            .recv_timeout(Duration::from_secs(120))
            .expect("no agent-exit event");
        let exit: serde_json::Value = serde_json::from_str(&exit).unwrap();
        assert_eq!(exit["success"], true, "exit payload: {exit}");
        assert_eq!(exit["nodeId"], "test-node");

        let result = line_rx
            .try_iter()
            .find_map(|payload| {
                let value: serde_json::Value = serde_json::from_str(&payload).ok()?;
                assert_eq!(value["sessionId"], "test-session");
                let line: serde_json::Value =
                    serde_json::from_str(value["line"].as_str()?).ok()?;
                (line["type"] == "result").then_some(line)
            })
            .expect("no result line was emitted");
        assert_eq!(result["subtype"], "success");
        assert!(
            result["result"]
                .as_str()
                .unwrap_or_default()
                .contains("OK"),
            "unexpected result: {result}"
        );
    }
}
