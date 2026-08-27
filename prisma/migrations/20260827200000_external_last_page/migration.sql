-- Página por la que va la lectura dentro del último capítulo abierto.
-- Es opcional: las filas que ya existían siguen valiendo, solo que
-- retoman desde el principio del capítulo hasta que se vuelva a leer.
ALTER TABLE "external_series" ADD COLUMN "last_page_number" INTEGER;
