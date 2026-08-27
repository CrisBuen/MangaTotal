// Sin consola detrás de la ventana en la versión final de Windows.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

/// Descarga una página desde la conexión del usuario.
///
/// Algunas fuentes (ZonaTMO, Ikigai) rechazan las peticiones que vienen de
/// centros de datos, pero aceptan cualquier cliente desde una conexión
/// hogareña. Como la ventana carga un sitio remoto, el navegador interno no
/// puede pedirlas por su cuenta (CORS), así que lo hace este comando.
#[tauri::command]
async fn traer_pagina(url: String) -> Result<String, String> {
    const PERMITIDOS: [&str; 6] = [
        "zonatmo.org",
        "storage2.zonatmo.org",
        "visorikigai.gettocaboca.com",
        "viralikigai.radiot.space",
        "image2.ikigaimangas.cloud",
        "image3.ikigaimangas.cloud",
    ];

    let destino = url::Url::parse(&url).map_err(|e| e.to_string())?;
    let host = destino.host_str().unwrap_or_default().to_string();
    if !PERMITIDOS.iter().any(|p| host == *p || host.ends_with(&format!(".{p}"))) {
        return Err(format!("Dominio no permitido: {host}"));
    }

    let cliente = reqwest::Client::builder()
        .user_agent(
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 \
             (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        )
        .build()
        .map_err(|e| e.to_string())?;

    let respuesta = cliente
        .get(destino)
        .header("Accept-Language", "es-ES,es;q=0.9")
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !respuesta.status().is_success() {
        return Err(format!("La fuente respondió {}", respuesta.status().as_u16()));
    }

    respuesta.text().await.map_err(|e| e.to_string())
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![traer_pagina])
        .run(tauri::generate_context!())
        .expect("no se pudo iniciar MangaTotal");
}
