mod agent;
mod sessions;

use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Mutex;

use tauri::Manager;

pub struct AppState {
    pub data_dir: PathBuf,
    pub generations: Mutex<HashMap<String, agent::Generation>>,
}

#[cfg(test)]
pub(crate) mod test_support {
    use super::AppState;
    use std::collections::HashMap;
    use std::path::PathBuf;
    use std::sync::Mutex;
    use tauri::Manager;

    pub fn mock_app(data_dir: PathBuf) -> tauri::App<tauri::test::MockRuntime> {
        let app = tauri::test::mock_builder()
            .build(tauri::test::mock_context(tauri::test::noop_assets()))
            .expect("failed to build mock app");
        std::fs::create_dir_all(crate::sessions::sessions_dir(&data_dir)).unwrap();
        app.manage(AppState {
            data_dir,
            generations: Mutex::new(HashMap::new()),
        });
        app
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            let data_dir = match std::env::var_os("JASA_DATA_DIR") {
                Some(dir) => PathBuf::from(dir),
                None => app.path().app_data_dir()?,
            };
            std::fs::create_dir_all(sessions::sessions_dir(&data_dir))?;
            app.manage(AppState {
                data_dir,
                generations: Mutex::new(HashMap::new()),
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            sessions::list_sessions,
            sessions::load_session,
            sessions::save_session,
            sessions::delete_session,
            agent::start_generation,
            agent::cancel_generation,
            agent::cli_defaults,
        ])
        .run(tauri::generate_context!())
        .expect("error while running jasa");
}
