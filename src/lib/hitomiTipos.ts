export const HITOMI_NOMBRE = "Hitomi.la";
export const HITOMI_WEB = "https://hitomi.la";
export const HITOMI_LTN = "https://ltn.gold-usergeneratedcontent.net";
export const HITOMI_TAGINDEX = "https://tagindex.hitomi.la";

export const HITOMI_IDIOMAS = [
  { id: "todos", label: "Todos", code: "all" },
  { id: "spanish", label: "Español", code: "spanish" },
  { id: "english", label: "Inglés", code: "english" },
  { id: "japanese", label: "Japonés", code: "japanese" },
  { id: "korean", label: "Coreano", code: "korean" },
  { id: "chinese", label: "Chino", code: "chinese" },
  { id: "portuguese", label: "Portugués", code: "portuguese" },
  { id: "french", label: "Francés", code: "french" },
  { id: "german", label: "Alemán", code: "german" },
  { id: "italian", label: "Italiano", code: "italian" },
  { id: "russian", label: "Ruso", code: "russian" },
  { id: "indonesian", label: "Indonesio", code: "indonesian" },
  { id: "vietnamese", label: "Vietnamita", code: "vietnamese" },
  { id: "thai", label: "Tailandés", code: "thai" },
] as const;

export const HITOMI_TIPOS = [
  { id: "todos", label: "Todos" },
  { id: "doujinshi", label: "Doujinshi" },
  { id: "manga", label: "Manga" },
  { id: "artistcg", label: "Artist CG" },
  { id: "gamecg", label: "Game CG" },
  { id: "anime", label: "Anime" },
] as const;

export interface SerieHitomi {
  id: string;
  title: string;
  japanese_title?: string;
  language?: string;
  type?: string;
  thumb: string;
  artists?: string[];
  characters?: string[];
  tags?: string[];
  filecount: number;
  date?: string;
}

export interface FichaHitomi extends SerieHitomi {
  groups?: string[];
  parodys?: string[];
  url_original: string;
}

export interface CatalogoHitomi {
  series: SerieHitomi[];
  pagina: number;
  totalPaginas: number;
  totalResultados: number;
  hayMas: boolean;
}

export interface HitomiTag {
  tag: string;
  label: string;
  categoria: "serie" | "femenino" | "masculino" | "tematica";
  count?: number;
}

/**
 * Catálogo de etiquetas populares de Hitomi.la con sus prefijos oficiales
 * (series:, female:, male:, o etiqueta directa) para filtrado instantáneo.
 */
export const HITOMI_POPULAR_TAGS: HitomiTag[] = [
  // Series / Parodias populares en Hitomi.la
  { tag: "series:original", label: "Original", categoria: "serie" },
  { tag: "series:blue archive", label: "Blue Archive", categoria: "serie" },
  { tag: "series:fate/grand order", label: "Fate/Grand Order", categoria: "serie" },
  { tag: "series:genshin impact", label: "Genshin Impact", categoria: "serie" },
  { tag: "series:honkai: star rail", label: "Honkai: Star Rail", categoria: "serie" },
  { tag: "series:zenless zone zero", label: "Zenless Zone Zero", categoria: "serie" },
  { tag: "series:touhou project", label: "Touhou Project", categoria: "serie" },
  { tag: "series:kantai collection", label: "Kantai Collection", categoria: "serie" },
  { tag: "series:the idolmaster", label: "The Idolmaster", categoria: "serie" },
  { tag: "series:azur lane", label: "Azur Lane", categoria: "serie" },
  { tag: "series:nikke: goddess of victory", label: "NIKKE: Goddess of Victory", categoria: "serie" },
  { tag: "series:hololive", label: "Hololive", categoria: "serie" },
  { tag: "series:granblue fantasy", label: "Granblue Fantasy", categoria: "serie" },
  { tag: "series:pokemon", label: "Pokémon", categoria: "serie" },
  { tag: "series:naruto", label: "Naruto", categoria: "serie" },
  { tag: "series:one piece", label: "One Piece", categoria: "serie" },
  { tag: "series:bleach", label: "Bleach", categoria: "serie" },
  { tag: "series:dragon ball", label: "Dragon Ball", categoria: "serie" },
  { tag: "series:kimetsu no yaiba", label: "Demon Slayer", categoria: "serie" },
  { tag: "series:boku no hero academia", label: "My Hero Academia", categoria: "serie" },
  { tag: "series:jujutsu kaisen", label: "Jujutsu Kaisen", categoria: "serie" },
  { tag: "series:chainsaw man", label: "Chainsaw Man", categoria: "serie" },
  { tag: "series:spy x family", label: "Spy x Family", categoria: "serie" },
  { tag: "series:sousou no frieren", label: "Frieren", categoria: "serie" },
  { tag: "series:dandadan", label: "Dandadan", categoria: "serie" },
  { tag: "series:oshi no ko", label: "Oshi no Ko", categoria: "serie" },
  { tag: "series:bocchi the rock!", label: "Bocchi the Rock!", categoria: "serie" },
  { tag: "series:sono bisque doll wa koi wo suru", label: "My Dress-Up Darling", categoria: "serie" },
  { tag: "series:sword art online", label: "Sword Art Online", categoria: "serie" },
  { tag: "series:neon genesis evangelion", label: "Evangelion", categoria: "serie" },
  { tag: "series:nier:automata", label: "NieR:Automata", categoria: "serie" },

  // Femenino
  { tag: "female:big breasts", label: "Pechos grandes", categoria: "femenino" },
  { tag: "female:huge breasts", label: "Pechos gigantes", categoria: "femenino" },
  { tag: "female:small breasts", label: "Pechos pequeños", categoria: "femenino" },
  { tag: "female:sole female", label: "Mujer única", categoria: "femenino" },
  { tag: "female:schoolgirl uniform", label: "Uniforme escolar", categoria: "femenino" },
  { tag: "female:stockings", label: "Medias / Pantimedias", categoria: "femenino" },
  { tag: "female:milf", label: "MILF", categoria: "femenino" },
  { tag: "female:maid", label: "Sirvienta (Maid)", categoria: "femenino" },
  { tag: "female:swimsuit", label: "Traje de baño", categoria: "femenino" },
  { tag: "female:bikini", label: "Bikini", categoria: "femenino" },
  { tag: "female:glasses", label: "Lentes / Anteojos", categoria: "femenino" },
  { tag: "female:nakadashi", label: "Nakadashi", categoria: "femenino" },
  { tag: "female:blowjob", label: "Oral (Blowjob)", categoria: "femenino" },
  { tag: "female:paizuri", label: "Paizuri", categoria: "femenino" },
  { tag: "female:ahegao", label: "Ahegao", categoria: "femenino" },
  { tag: "female:bondage", label: "Bondage", categoria: "femenino" },
  { tag: "female:yuri", label: "Yuri", categoria: "femenino" },
  { tag: "female:femdom", label: "Femdom", categoria: "femenino" },
  { tag: "female:lingerie", label: "Lencería", categoria: "femenino" },
  { tag: "female:netorare", label: "Netorare (NTR)", categoria: "femenino" },
  { tag: "female:cheating", label: "Infidelidad (Cheating)", categoria: "femenino" },
  { tag: "female:collar", label: "Collar", categoria: "femenino" },
  { tag: "female:dark skin", label: "Piel morena", categoria: "femenino" },
  { tag: "female:gyaru", label: "Gyaru", categoria: "femenino" },
  { tag: "female:tanlines", label: "Líneas de bronceado", categoria: "femenino" },
  { tag: "female:elf", label: "Elfa", categoria: "femenino" },
  { tag: "female:bunnygirl", label: "Chica conejo (Bunnygirl)", categoria: "femenino" },
  { tag: "female:catgirl", label: "Chica gato (Nekomimi)", categoria: "femenino" },
  { tag: "female:kemonomimi", label: "Orejas de animal (Kemonomimi)", categoria: "femenino" },
  { tag: "female:fox girl", label: "Chica zorro (Kitsunemimi)", categoria: "femenino" },
  { tag: "female:demon girl", label: "Chica demonio / Súcubo", categoria: "femenino" },
  { tag: "female:monster girl", label: "Chica monstruo", categoria: "femenino" },
  { tag: "female:vampire", label: "Vampiresa", categoria: "femenino" },
  { tag: "female:twintails", label: "Coletas (Twintails)", categoria: "femenino" },
  { tag: "female:ponytail", label: "Cola de caballo (Ponytail)", categoria: "femenino" },
  { tag: "female:tomboy", label: "Tomboy", categoria: "femenino" },
  { tag: "female:tall girl", label: "Chica alta", categoria: "femenino" },
  { tag: "female:muscle", label: "Musculosa", categoria: "femenino" },
  { tag: "female:mind break", label: "Mind Break", categoria: "femenino" },
  { tag: "female:mind control", label: "Control mental", categoria: "femenino" },
  { tag: "female:hypnosis", label: "Hipnosis", categoria: "femenino" },
  { tag: "female:teacher", label: "Profesora", categoria: "femenino" },
  { tag: "female:nurse", label: "Enfermera", categoria: "femenino" },
  { tag: "female:office lady", label: "Oficinista (OL)", categoria: "femenino" },
  { tag: "female:nun", label: "Monja", categoria: "femenino" },
  { tag: "female:miko", label: "Sacerdotisa (Miko)", categoria: "femenino" },
  { tag: "female:kunoichi", label: "Ninja / Kunoichi", categoria: "femenino" },
  { tag: "female:cheerleader", label: "Porrista (Cheerleader)", categoria: "femenino" },
  { tag: "female:waitress", label: "Camarera / Mesera", categoria: "femenino" },
  { tag: "female:defloration", label: "Primera vez (Defloration)", categoria: "femenino" },
  { tag: "female:impregnation", label: "Impregnación", categoria: "femenino" },
  { tag: "female:pregnant", label: "Embarazo", categoria: "femenino" },
  { tag: "female:lactation", label: "Lactancia", categoria: "femenino" },
  { tag: "female:x-ray", label: "Rayos X", categoria: "femenino" },
  { tag: "female:big ass", label: "Trasero grande (Big Ass)", categoria: "femenino" },
  { tag: "female:anal", label: "Anal", categoria: "femenino" },
  { tag: "female:double penetration", label: "Doble penetración", categoria: "femenino" },
  { tag: "female:deepthroat", label: "Garganta profunda", categoria: "femenino" },
  { tag: "female:cunnilingus", label: "Oral femenino (Cunnilingus)", categoria: "femenino" },
  { tag: "female:fingering", label: "Dedos (Fingering)", categoria: "femenino" },
  { tag: "female:masturbation", label: "Masturbación", categoria: "femenino" },
  { tag: "female:footjob", label: "Pies (Footjob)", categoria: "femenino" },
  { tag: "female:facesitting", label: "Facesitting", categoria: "femenino" },
  { tag: "female:exhibitionism", label: "Exhibicionismo", categoria: "femenino" },
  { tag: "female:cosplay", label: "Cosplay", categoria: "femenino" },
  { tag: "female:kimono", label: "Kimono / Yukata", categoria: "femenino" },
  { tag: "female:apron", label: "Delantal", categoria: "femenino" },
  { tag: "female:sleeping", label: "Dormida", categoria: "femenino" },
  { tag: "female:drunk", label: "Ebria", categoria: "femenino" },
  { tag: "female:sweating", label: "Sudor", categoria: "femenino" },
  { tag: "female:harem", label: "Harén femenino", categoria: "femenino" },

  // Masculino
  { tag: "male:sole male", label: "Hombre único", categoria: "masculino" },
  { tag: "male:shotacon", label: "Shotacon", categoria: "masculino" },
  { tag: "male:yaoi", label: "Yaoi / BL", categoria: "masculino" },
  { tag: "male:dilf", label: "DILF / Maduro", categoria: "masculino" },
  { tag: "male:crossdressing", label: "Crossdressing / Femboy", categoria: "masculino" },
  { tag: "male:tomgirl", label: "Tomgirl", categoria: "masculino" },
  { tag: "male:dark skin", label: "Hombre piel morena", categoria: "masculino" },
  { tag: "male:muscle", label: "Musculoso", categoria: "masculino" },
  { tag: "male:glasses", label: "Hombre con lentes", categoria: "masculino" },
  { tag: "male:teacher", label: "Profesor", categoria: "masculino" },
  { tag: "male:bbm", label: "BBM", categoria: "masculino" },
  { tag: "male:monster", label: "Monstruo", categoria: "masculino" },
  { tag: "male:tentacles", label: "Tentáculos", categoria: "masculino" },

  // Temáticas y formatos generales
  { tag: "full color", label: "A todo color (Full Color)", categoria: "tematica" },
  { tag: "uncensored", label: "Sin censura (Uncensored)", categoria: "tematica" },
  { tag: "webtoon", label: "Webtoon / Manhwa", categoria: "tematica" },
  { tag: "tankoubon", label: "Tomo recopilatorio (Tankoubon)", categoria: "tematica" },
  { tag: "anthology", label: "Antología", categoria: "tematica" },
  { tag: "story arc", label: "Arco argumental", categoria: "tematica" },
  { tag: "ffm threesome", label: "Trío (FFM)", categoria: "tematica" },
  { tag: "mmf threesome", label: "Trío (MMF)", categoria: "tematica" },
  { tag: "group", label: "Grupal (Group)", categoria: "tematica" },
  { tag: "incest", label: "Incesto", categoria: "tematica" },
  { tag: "inbese", label: "Romance / Vanilla", categoria: "tematica" },
  { tag: "time stop", label: "Detener el tiempo", categoria: "tematica" },
  { tag: "mosaic censorship", label: "Censura con mosaico", categoria: "tematica" },
];

export function buscarEtiquetasHitomi(termino: string): HitomiTag[] {
  const q = termino.trim().toLowerCase();
  if (!q) return HITOMI_POPULAR_TAGS;

  return HITOMI_POPULAR_TAGS.filter(
    (t) =>
      t.tag.toLowerCase().includes(q) ||
      t.label.toLowerCase().includes(q)
  );
}

