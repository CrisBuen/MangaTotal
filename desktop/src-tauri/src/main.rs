// Sin consola detrás de la ventana en la versión final de Windows.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_http::init())
        .run(tauri::generate_context!())
        .expect("no se pudo iniciar MangaTotal");
}
