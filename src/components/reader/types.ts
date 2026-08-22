export interface ReaderPage {
  pageNumber: number;
  url: string;
  width: number;
  height: number;
}

export interface ReaderChapter {
  id: number;
  number: number;
  title: string | null;
  pageCount: number;
}

export interface ChapterLink {
  id: number;
  number: number;
}

export type ReadingMode = "cascade" | "rtl";
