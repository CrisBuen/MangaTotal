// Sin consola detrás de la ventana en la versión final de Windows.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use futures_util::StreamExt;
use std::io::Write;
use tauri::{AppHandle, Emitter, Window};

/// Sitio propio: es el único desde el que se acepta un instalador.
const ORIGEN_PROPIO: &str = "manga-total.vercel.app";

/// Descarga una página desde la conexión del usuario.
///
/// Algunas fuentes (ZonaTMO, Ikigai) rechazan las peticiones que vienen de
/// centros de datos, pero aceptan cualquier cliente desde una conexión
/// hogareña. Como la ventana carga un sitio remoto, el navegador interno no
/// puede pedirlas por su cuenta (CORS), así que lo hace este comando.
#[tauri::command]
async fn traer_pagina(url: String) -> Result<String, String> {
    const PERMITIDOS: [&str; 8] = [
        "leercapitulo.co",
        // CDN donde viven las páginas de LeerCapítulo (lc3-cdn, lc7-cdn, ...)
        "t34798ndc.com",
        "zonatmo.net",
        "cdn.zonatmo.to",
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

    let respuesta = cliente()?
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

fn cliente() -> Result<reqwest::Client, String> {
    reqwest::Client::builder()
        .user_agent(
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 \
             (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        )
        .build()
        .map_err(|e| e.to_string())
}

/// Lo que se le manda a la ventana mientras baja el instalador.
#[derive(Clone, serde::Serialize)]
struct Progreso {
    descargado: u64,
    total: u64,
}

/// Baja el instalador de la versión nueva a una carpeta temporal.
///
/// Va avisando del avance por el evento `actualizacion://progreso`, para que
/// la ventana pueda dibujar la barra. Devuelve la ruta del archivo bajado.
#[tauri::command]
async fn descargar_actualizacion(ventana: Window, url: String) -> Result<String, String> {
    let destino = url::Url::parse(&url).map_err(|e| e.to_string())?;
    if destino.host_str().unwrap_or_default() != ORIGEN_PROPIO {
        return Err("El instalador tiene que venir del sitio de MangaTotal".into());
    }

    let respuesta = cliente()?.get(destino).send().await.map_err(|e| e.to_string())?;
    if !respuesta.status().is_success() {
        return Err(format!(
            "No se pudo descargar la actualización ({})",
            respuesta.status().as_u16()
        ));
    }

    let total = respuesta.content_length().unwrap_or(0);
    let ruta = std::env::temp_dir().join("MangaTotal-actualizacion.exe");
    let mut archivo = std::fs::File::create(&ruta).map_err(|e| e.to_string())?;

    let mut descargado: u64 = 0;
    let mut ultimo_aviso: u64 = 0;
    let mut trozos = respuesta.bytes_stream();

    while let Some(trozo) = trozos.next().await {
        let trozo = trozo.map_err(|e| e.to_string())?;
        archivo.write_all(&trozo).map_err(|e| e.to_string())?;
        descargado += trozo.len() as u64;

        // avisar de a poco: cada 256 KB alcanza para una barra fluida
        if descargado - ultimo_aviso >= 256 * 1024 || descargado == total {
            ultimo_aviso = descargado;
            let _ = ventana.emit("actualizacion://progreso", Progreso { descargado, total });
        }
    }

    archivo.flush().map_err(|e| e.to_string())?;
    Ok(ruta.to_string_lossy().to_string())
}

/// Lanza el instalador bajado y cierra la app para que pueda reemplazarse.
///
/// `/S` lo hace silencioso y `/R` vuelve a abrir MangaTotal al terminar, así
/// que para la persona es un solo clic y la app se reinicia sola.
#[tauri::command]
fn instalar_actualizacion(app: AppHandle, ruta: String) -> Result<(), String> {
    let archivo = std::path::PathBuf::from(&ruta);
    if !archivo.is_file() {
        return Err("No se encontró el instalador descargado".into());
    }

    std::process::Command::new(&archivo)
        .args(["/S", "/R"])
        .spawn()
        .map_err(|e| e.to_string())?;

    app.exit(0);
    Ok(())
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            traer_pagina,
            descargar_actualizacion,
            instalar_actualizacion
        ])
        .run(tauri::generate_context!())
        .expect("no se pudo iniciar MangaTotal");
}
