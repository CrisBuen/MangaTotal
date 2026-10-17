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
