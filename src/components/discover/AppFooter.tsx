import Link from "next/link";

/** Sin enlaces de muestra: cada opción tiene su destino real en MangaTotal. */
export function AppFooter() {
  return <footer className="od-footer" data-od-id="site-footer">
    <div><h2>MangaTotal</h2><p>Tus historias, en un solo lugar. Biblioteca, lecturas y seguimiento de anime con tu progreso guardado.</p></div>
    <div><h3>Descubrir</h3><nav aria-label="Descubrir en el pie"><Link href="/explorar">Explorar las fuentes</Link><Link href="/fuentes">Mi biblioteca por fuente</Link><Link href="/anime">Catálogo AniList</Link><Link href="/noticias">Noticias</Link></nav></div>
    <div><h3>Tu cuenta</h3><nav aria-label="Cuenta en el pie"><Link href="/biblioteca">Biblioteca e historial</Link><a href="/biblioteca?f=favoritos">Favoritos</a><Link href="/perfil">Perfil</Link><Link href="/ajustes">Ajustes</Link></nav></div>
    <div><h3>MangaTotal</h3><nav aria-label="Ayuda en el pie"><Link href="/acerca-de">Acerca de</Link><Link href="/mas">Aplicaciones y más</Link><Link href="/consulta">Ayuda y contacto</Link><Link href="/privacidad">Privacidad</Link></nav></div>
    <p className="od-footer-note">Las fuentes conservan su autoría y sus enlaces originales. MangaTotal no aloja los vídeos externos.</p>
  </footer>;
}
