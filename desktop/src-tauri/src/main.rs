// Sin consola detrás de la ventana en la versión final de Windows.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use futures_util::StreamExt;
use sha2::{Digest, Sha256};
use std::collections::HashMap;
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::Duration;
use tauri::{AppHandle, Emitter, Manager, WebviewUrl, WebviewWindowBuilder, Window};

/// El mismo user agent para la ventana de verificación y para los pedidos:
/// Cloudflare ata su permiso al navegador que lo resolvió, así que si no
/// coinciden, el permiso no sirve.
const UA_NAVEGADOR: &str = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

/// Permisos de Cloudflare ya obtenidos, uno por dominio.
#[derive(Default)]
struct Permisos(Mutex<HashMap<String, String>>);

/// La web nunca decide qué binario ejecuta. El puente nativo consulta este
/// manifiesto fijo, valida su ruta y su SHA-256 y recién entonces lo recuerda.
const MANIFIESTO_ACTUALIZACION: &str = "https://www.mangatotal.com/descargas/windows-version.json";
const RUTA_INSTALADOR: &str = "/descargas/MangaTotal-windows-setup.exe";
const MAX_INSTALADOR_BYTES: u64 = 100 * 1024 * 1024;

#[derive(Default)]
struct ActualizacionPendiente(Mutex<Option<ActualizacionVerificada>>);

struct ActualizacionVerificada {
    ruta: PathBuf,
    sha256: String,
}

#[derive(serde::Deserialize)]
struct ManifiestoActualizacion {
    #[serde(rename = "installerUrl")]
    installer_url: String,
    sha256: String,
}

const DOMINIOS_FUENTES: [&str; 10] = [
    "newcatharsis.dig-it.info",
    // donde Catharsis guarda sus imágenes (direct-new-catha, ...)
    "catharsisfood.com",
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

fn validar_url_fuente(valor: &str) -> Result<url::Url, String> {
    let destino = url::Url::parse(valor).map_err(|e| e.to_string())?;
    let host = destino.host_str().unwrap_or_default();
    let host_permitido = DOMINIOS_FUENTES
        .iter()
        .any(|p| host == *p || host.ends_with(&format!(".{p}")));
    let segura = destino.scheme() == "https"
        && destino.port_or_known_default() == Some(443)
        && destino.username().is_empty()
        && destino.password().is_none();

    if !host_permitido || !segura {
        return Err(format!("Dirección externa no permitida: {host}"));
    }
    Ok(destino)
}

/// Descarga una página desde la conexión del usuario.
///
/// Algunas fuentes (ZonaTMO, Ikigai) rechazan las peticiones que vienen de
/// centros de datos, pero aceptan cualquier cliente desde una conexión
/// hogareña. Como la ventana carga un sitio remoto, el navegador interno no
/// puede pedirlas por su cuenta (CORS), así que lo hace este comando.
#[tauri::command]
async fn traer_pagina(
    app: AppHandle,
    url: String,
    user_agent: Option<String>,
) -> Result<String, String> {
    let mut destino = validar_url_fuente(&url)?;
    let http = cliente_sin_redirecciones(ua_de(&user_agent))?;

    // Se siguen pocas redirecciones y se vuelve a validar cada destino.
    // Ikigai usa una redirección legítima entre dos dominios autorizados.
    for _ in 0..=5 {
        let host = destino.host_str().unwrap_or_default().to_string();
        let permiso = app
            .state::<Permisos>()
            .0
            .lock()
            .map_err(|_| "no se pudo leer el permiso".to_string())?
            .get(&host)
            .cloned();

        let mut pedido = http
            .get(destino.clone())
            .header("Accept-Language", "es-ES,es;q=0.9");
        if let Some(cookie) = permiso {
            pedido = pedido.header("Cookie", cookie);
        }

        let respuesta = pedido.send().await.map_err(|e| e.to_string())?;
        if respuesta.status().is_redirection() {
            let ubicacion = respuesta
                .headers()
                .get(reqwest::header::LOCATION)
                .ok_or_else(|| "La fuente redirigió sin indicar destino".to_string())?
                .to_str()
                .map_err(|_| "La fuente devolvió una redirección inválida".to_string())?;
            let siguiente = destino.join(ubicacion).map_err(|e| e.to_string())?;
            destino = validar_url_fuente(siguiente.as_str())?;
            continue;
        }

        let estado = respuesta.status().as_u16();
        if !respuesta.status().is_success() {
            // Cloudflare pide verificar que hay una persona: la ventana la abre
            // el frontend llamando a resolver_desafio.
            if estado == 403 || estado == 503 {
                return Err(format!("DESAFIO:{host}"));
            }
            return Err(format!("La fuente respondió {estado}"));
        }
        return respuesta.text().await.map_err(|e| e.to_string());
    }

    Err("La fuente hizo demasiadas redirecciones".into())
}

/// Abre una ventana para que la persona resuelva el "no soy un robot" de
/// Cloudflare, y guarda el permiso que este entrega.
///
/// Es lo mismo que hace Mihon: la verificación la resuelve una persona de
/// verdad en un navegador de verdad; acá solo se recuerda el resultado para
/// los pedidos siguientes. El permiso vence solo, y entonces se vuelve a
/// pedir.
#[tauri::command]
async fn resolver_desafio(
    app: AppHandle,
    url: String,
    user_agent: Option<String>,
) -> Result<bool, String> {
    let destino = validar_url_fuente(&url)?;
    let host = destino.host_str().unwrap_or_default().to_string();

    // si ya hay una ventana abierta, no se abre otra
    if app.get_webview_window("desafio").is_some() {
        return Ok(false);
    }

    let ventana = WebviewWindowBuilder::new(&app, "desafio", WebviewUrl::External(destino.clone()))
        .title("Verificación del sitio — tocá la casilla para continuar")
        .inner_size(560.0, 680.0)
        .user_agent(ua_de(&user_agent))
        .on_navigation(|url| validar_url_fuente(url.as_str()).is_ok())
        .center()
        .build()
        .map_err(|e| e.to_string())?;

    // hasta tres minutos: es lo que puede tardar alguien en verla y tocarla
    for _ in 0..180 {
        tokio::time::sleep(Duration::from_secs(1)).await;

        // si la cerró a mano, se corta
        if app.get_webview_window("desafio").is_none() {
            return Ok(false);
        }

        if let Ok(cookies) = ventana.cookies_for_url(destino.clone()) {
            if let Some(c) = cookies.iter().find(|c| c.name() == "cf_clearance") {
                if let Ok(mut guardados) = app.state::<Permisos>().0.lock() {
                    guardados.insert(host, format!("cf_clearance={}", c.value()));
                }
                let _ = ventana.close();
                return Ok(true);
            }
        }
    }

    let _ = ventana.close();
    Ok(false)
}

/// El user agent a usar: el que eligió la persona, o el nuestro.
fn ua_de(elegido: &Option<String>) -> &str {
    match elegido {
        Some(u) if !u.trim().is_empty() => u.as_str(),
        _ => UA_NAVEGADOR,
    }
}

/// Las fuentes necesitan seguir sus redirecciones conocidas. El actualizador
/// no: una redirección permitiría abandonar el dominio recién validado.
fn cliente_sin_redirecciones(ua: &str) -> Result<reqwest::Client, String> {
    reqwest::Client::builder()
        .user_agent(ua)
        .redirect(reqwest::redirect::Policy::none())
        .build()
        .map_err(|e| e.to_string())
}

fn destino_instalador(valor: &str) -> Result<url::Url, String> {
    let base = url::Url::parse("https://www.mangatotal.com").map_err(|e| e.to_string())?;
    let destino = base.join(valor).map_err(|e| e.to_string())?;

    let valido = destino.scheme() == "https"
        && destino.host_str() == Some("www.mangatotal.com")
        && destino.port_or_known_default() == Some(443)
        && destino.username().is_empty()
        && destino.password().is_none()
        && destino.path() == RUTA_INSTALADOR
        && destino.query().is_none()
        && destino.fragment().is_none();

    if !valido {
        return Err("El manifiesto indicó un instalador fuera del sitio oficial".into());
    }
    Ok(destino)
}

fn sha256_archivo(ruta: &Path) -> Result<String, String> {
    let mut archivo = std::fs::File::open(ruta).map_err(|e| e.to_string())?;
    let mut hash = Sha256::new();
    let mut bloque = [0_u8; 64 * 1024];
    loop {
        let leidos = archivo.read(&mut bloque).map_err(|e| e.to_string())?;
        if leidos == 0 {
            break;
        }
        hash.update(&bloque[..leidos]);
    }
    Ok(format!("{:x}", hash.finalize()))
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
async fn descargar_actualizacion(
    app: AppHandle,
    ventana: Window,
    // Se conserva para que el frontend siga siendo compatible con las apps
    // anteriores. La versión segura la ignora y usa el manifiesto fijo.
    url: Option<String>,
) -> Result<String, String> {
    drop(url);
    let http = cliente_sin_redirecciones(UA_NAVEGADOR)?;
    let manifiesto_respuesta = http
        .get(MANIFIESTO_ACTUALIZACION)
        .send()
        .await
        .map_err(|e| e.to_string())?;
    if !manifiesto_respuesta.status().is_success() {
        return Err(format!(
            "No se pudo comprobar la actualización ({})",
            manifiesto_respuesta.status().as_u16()
        ));
    }
    let manifiesto: ManifiestoActualizacion = serde_json::from_str(
        &manifiesto_respuesta
            .text()
            .await
            .map_err(|e| e.to_string())?,
    )
    .map_err(|_| "El manifiesto de actualización no es válido".to_string())?;
    let esperado = manifiesto.sha256.trim().to_ascii_lowercase();
    if esperado.len() != 64 || !esperado.bytes().all(|b| b.is_ascii_hexdigit()) {
        return Err("El manifiesto no contiene una huella SHA-256 válida".into());
    }
    let destino = destino_instalador(&manifiesto.installer_url)?;

    let respuesta = http.get(destino).send().await.map_err(|e| e.to_string())?;
    if !respuesta.status().is_success() {
        return Err(format!(
            "No se pudo descargar la actualización ({})",
            respuesta.status().as_u16()
        ));
    }

    let total = respuesta.content_length().unwrap_or(0);
    if total > MAX_INSTALADOR_BYTES {
        return Err("El instalador supera el tamaño máximo permitido".into());
    }
    let ruta = std::env::temp_dir().join("MangaTotal-actualizacion.exe");
    let mut archivo = std::fs::File::create(&ruta).map_err(|e| e.to_string())?;

    let mut descargado: u64 = 0;
    let mut ultimo_aviso: u64 = 0;
    let mut hash = Sha256::new();
    let mut trozos = respuesta.bytes_stream();

    while let Some(trozo) = trozos.next().await {
        let trozo = trozo.map_err(|e| e.to_string())?;
        if descargado + trozo.len() as u64 > MAX_INSTALADOR_BYTES {
            drop(archivo);
            let _ = std::fs::remove_file(&ruta);
            return Err("El instalador supera el tamaño máximo permitido".into());
        }
        archivo.write_all(&trozo).map_err(|e| e.to_string())?;
        hash.update(&trozo);
        descargado += trozo.len() as u64;

        // avisar de a poco: cada 256 KB alcanza para una barra fluida
        if descargado - ultimo_aviso >= 256 * 1024 || descargado == total {
            ultimo_aviso = descargado;
            let _ = ventana.emit("actualizacion://progreso", Progreso { descargado, total });
        }
    }

    archivo.flush().map_err(|e| e.to_string())?;
    drop(archivo);
    if descargado == 0 || (total > 0 && descargado != total) {
        let _ = std::fs::remove_file(&ruta);
        return Err("La descarga del instalador quedó incompleta".into());
    }
    let recibido = format!("{:x}", hash.finalize());
    if recibido != esperado {
        let _ = std::fs::remove_file(&ruta);
        return Err("La huella del instalador no coincide; no se ejecutó".into());
    }

    let mut cabecera = [0_u8; 2];
    std::fs::File::open(&ruta)
        .and_then(|mut f| f.read_exact(&mut cabecera))
        .map_err(|e| e.to_string())?;
    if cabecera != *b"MZ" {
        let _ = std::fs::remove_file(&ruta);
        return Err("El archivo descargado no es un instalador de Windows".into());
    }

    let estado_actualizacion = app.state::<ActualizacionPendiente>();
    let mut pendiente = estado_actualizacion
        .0
        .lock()
        .map_err(|_| "No se pudo guardar la actualización".to_string())?;
    *pendiente = Some(ActualizacionVerificada {
        ruta: ruta.clone(),
        sha256: esperado,
    });
    Ok(ruta.to_string_lossy().to_string())
}

/// Lanza el instalador bajado y cierra la app para que pueda reemplazarse.
///
/// `/S` lo hace silencioso y `/R` vuelve a abrir MangaTotal al terminar, así
/// que para la persona es un solo clic y la app se reinicia sola.
#[tauri::command]
fn instalar_actualizacion(app: AppHandle, ruta: Option<String>) -> Result<(), String> {
    // Nunca se ejecuta la ruta recibida desde JavaScript. Solo el archivo que
    // este mismo proceso descargó y verificó en el paso anterior.
    drop(ruta);
    let estado_actualizacion = app.state::<ActualizacionPendiente>();
    let verificada = estado_actualizacion
        .0
        .lock()
        .map_err(|_| "No se pudo leer la actualización".to_string())?
        .take()
        .ok_or_else(|| "No hay una actualización verificada para instalar".to_string())?;
    let archivo = verificada.ruta;
    if !archivo.is_file() {
        return Err("No se encontró el instalador descargado".into());
    }
    if sha256_archivo(&archivo)? != verificada.sha256 {
        let _ = std::fs::remove_file(&archivo);
        return Err("El instalador cambió después de verificarse; no se ejecutó".into());
    }

    std::process::Command::new(&archivo)
        .args(["/S", "/R"])
        .spawn()
        .map_err(|e| e.to_string())?;

    app.exit(0);
    Ok(())
}

/// Borra el permiso guardado y los datos del navegador interno.
///
/// Es la salida cuando la verificación queda trabada: sin esto, un permiso
/// vencido o a medias dejaría la fuente inservible sin forma de reintentar.
#[tauri::command]
async fn limpiar_verificacion(app: AppHandle) -> Result<(), String> {
    if let Ok(mut guardados) = app.state::<Permisos>().0.lock() {
        guardados.clear();
    }

    // los datos del navegador se limpian desde cualquiera de sus ventanas
    if let Some(v) = app
        .get_webview_window("desafio")
        .or_else(|| app.get_webview_window("main"))
    {
        v.clear_all_browsing_data().map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::{destino_instalador, validar_url_fuente};

    #[test]
    fn el_instalador_solo_puede_ser_el_oficial() {
        assert!(destino_instalador("/descargas/MangaTotal-windows-setup.exe").is_ok());
        assert!(destino_instalador(
            "http://www.mangatotal.com/descargas/MangaTotal-windows-setup.exe"
        )
        .is_err());
        assert!(destino_instalador("https://www.mangatotal.com/otro.exe").is_err());
        assert!(destino_instalador("https://evil.example/MangaTotal-windows-setup.exe").is_err());
    }

    #[test]
    fn las_fuentes_exigen_https_y_un_dominio_realmente_permitido() {
        assert!(validar_url_fuente("https://leercapitulo.co/serie").is_ok());
        assert!(validar_url_fuente("https://lc3-cdn.t34798ndc.com/pagina.webp").is_ok());
        assert!(validar_url_fuente("http://leercapitulo.co/serie").is_err());
        assert!(validar_url_fuente("https://leercapitulo.co.evil.example/serie").is_err());
        assert!(validar_url_fuente("https://user@leercapitulo.co/serie").is_err());
    }
}

fn main() {
    tauri::Builder::default()
        .manage(Permisos::default())
        .manage(ActualizacionPendiente::default())
        .invoke_handler(tauri::generate_handler![
            traer_pagina,
            resolver_desafio,
            limpiar_verificacion,
            descargar_actualizacion,
            instalar_actualizacion
        ])
        .run(tauri::generate_context!())
        .expect("no se pudo iniciar MangaTotal");
}
