import type { Metadata } from "next";
import Link from "next/link";
import { SectionHeading, Surface } from "@/components/ui/Surface";

export const metadata: Metadata = {
  title: "Política de privacidad · MangaTotal",
  description:
    "Qué datos guarda MangaTotal, para qué se usan y cómo pedir que se borren.",
};

/**
 * Página pública y sin sesión: Google Play exige una URL accesible para
 * cualquiera, y desde ahí se completa el formulario de Seguridad de los datos.
 * Lo que dice acá tiene que coincidir con lo que la app realmente guarda; si
 * se agrega un dato nuevo, se actualiza esta página y la fecha de abajo.
 */
const ACTUALIZADA = "3 de septiembre de 2026";
const CONTACTO = "nyckswork@gmail.com";

function Bloque({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <Surface className="space-y-4 p-6 sm:p-8">
      <h2 className="font-display text-2xl font-bold tracking-[-0.02em] text-ink">{titulo}</h2>
      <div className="space-y-4 text-sm leading-7 text-subtle">{children}</div>
    </Surface>
  );
}

export default function PrivacidadPage() {
  return (
    <div className="space-y-8" data-od-id="privacy-page">
      <SectionHeading
        eyebrow="Legal"
        title="Política de privacidad"
        description={`Qué guardamos, para qué, y cómo pedir que se borre. Última actualización: ${ACTUALIZADA}.`}
      />

      <Bloque titulo="Resumen">
        <p>
          MangaTotal guarda lo mínimo para que tu cuenta funcione: quién sos, qué guardaste y por
          dónde ibas leyendo. No vendemos ni compartimos tus datos con nadie, no mostramos
          publicidad y no usamos rastreadores de terceros.
        </p>
      </Bloque>

      <Bloque titulo="Qué datos guardamos">
        <p>
          <strong className="text-ink">Los que nos das al crear la cuenta.</strong> Tu apodo y tu
          contraseña, que nunca se guarda tal cual sino cifrada con bcrypt: ni nosotros podemos
          leerla. El correo electrónico es opcional y sirve para verificar la cuenta y recuperar el
          acceso si perdés la contraseña; sin correo la cuenta funciona igual, pero no hay forma de
          recuperarla. La fecha de nacimiento también es opcional y solo se usa para las
          preferencias de la cuenta.
        </p>
        <p>
          <strong className="text-ink">Lo que generás usando la app.</strong> Tu biblioteca y
          favoritos, el progreso de lectura (qué capítulo y en qué página quedaste), tu historial
          reciente, las series y animes que seguís, y tus preferencias: modo de lectura, y si
          activaste o no las secciones opcionales.
        </p>
        <p>
          <strong className="text-ink">Tu foto de perfil</strong>, si subís una. Se guarda
          recortada y podés quitarla cuando quieras desde tu perfil.
        </p>
        <p>
          <strong className="text-ink">Estadísticas de uso anónimas.</strong> La app cuenta cuánta
          gente hay conectada y qué secciones se abren, usando un identificador aleatorio que se
          genera en tu dispositivo y no está asociado a tu cuenta ni a tu nombre. Sirve para saber
          qué partes se usan y cuáles no. No guardamos tu dirección IP junto a esos datos.
        </p>
        <p>
          <strong className="text-ink">Protección contra intentos automatizados.</strong> Para
          frenar ataques al inicio de sesión guardamos un contador temporal. La dirección IP no se
          almacena: se convierte antes en un código irreversible que no permite reconstruirla, y
          esos contadores se borran solos a las 48 horas.
        </p>
        <p>
          <strong className="text-ink">Si nos escribís por soporte</strong>, recibimos lo que
          escribas, los archivos que adjuntes y datos técnicos de tu dispositivo (sistema y versión
          de la app) para poder reproducir el problema.
        </p>
      </Bloque>

      <Bloque titulo="Qué NO hacemos">
        <p>
          No vendemos, alquilamos ni compartimos tus datos con terceros. No mostramos publicidad ni
          incluimos redes de anuncios. No usamos Google Analytics, Facebook Pixel ni ningún
          rastreador externo: las estadísticas son propias y anónimas. No accedemos a tus contactos,
          tu ubicación, tu cámara ni tu micrófono. La app solo pide permiso de internet.
        </p>
      </Bloque>

      <Bloque titulo="Contenido de otros sitios">
        <p>
          Parte del catálogo proviene de sitios integrados con permiso, que se nombran en{" "}
          <Link href="/acerca-de" className="text-ink underline underline-offset-4">
            Acerca de
          </Link>
          . Cuando abrís uno de esos capítulos o episodios, tu navegador pide las imágenes o el
          video directamente a ese sitio, así que esa conexión se rige por la privacidad de ellos.
          Nosotros no les enviamos tu apodo, tu correo ni ningún dato de tu cuenta.
        </p>
      </Bloque>

      <Bloque titulo="Dónde se guarda y por cuánto tiempo">
        <p>
          Los datos se guardan en una base de datos alojada por nuestro proveedor de infraestructura
          y viajan siempre cifrados por HTTPS. Tu información se conserva mientras la cuenta exista.
          Si la borrás, se elimina junto con ella. Las estadísticas anónimas, al no estar asociadas
          a ninguna cuenta, se conservan de forma agregada.
        </p>
      </Bloque>

      <Bloque titulo="Tus derechos y cómo borrar tu cuenta">
        <p>
          Podés ver y cambiar tus datos en cualquier momento desde tu perfil y tus ajustes: apodo,
          foto, correo, contraseña y preferencias.
        </p>
        <p>
          <strong className="text-ink">Para pedir la eliminación de tu cuenta</strong>, escribinos
          desde{" "}
          <Link href="/consulta" className="text-ink underline underline-offset-4">
            Consulta y errores
          </Link>{" "}
          dentro de la app, o por correo a{" "}
          <a
            href={`mailto:${CONTACTO}`}
            className="text-ink underline underline-offset-4"
          >
            {CONTACTO}
          </a>
          , indicando tu apodo. Se borra la cuenta con todo lo asociado —biblioteca, favoritos,
          progreso, historial y foto— dentro de los 30 días. La baja es definitiva y no se puede
          revertir.
        </p>
        <p>
          También podés pedirnos una copia de los datos que tenemos sobre vos por la misma vía.
        </p>
      </Bloque>

      <Bloque titulo="Menores de edad">
        <p>
          MangaTotal no está dirigida a menores de 13 años y no recopilamos datos de forma
          consciente de ellos. Las secciones para adultos vienen desactivadas y solo puede
          activarlas manualmente una persona mayor de edad desde sus ajustes; en la versión
          publicada en Google Play ese contenido no está disponible en absoluto.
        </p>
      </Bloque>

      <Bloque titulo="Cambios y contacto">
        <p>
          Si esta política cambia, se actualiza esta página junto con su fecha. Si el cambio es
          importante, además lo avisamos dentro de la app.
        </p>
        <p>
          Por cualquier duda sobre tus datos:{" "}
          <a href={`mailto:${CONTACTO}`} className="text-ink underline underline-offset-4">
            {CONTACTO}
          </a>
        </p>
      </Bloque>
    </div>
  );
}
