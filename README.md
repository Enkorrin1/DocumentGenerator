Document Generator
=================

Веб-приложение строит форму по плейсхолдерам Carbone из DOCX и генерирует
готовый документ (DOCX/PDF).

## Как грузятся шаблоны

1) Готовые шаблоны

- Описаны в `server/builtInTemplates.cjs` как список `BUILT_IN_TEMPLATES`.
- При первом выборе (`POST /api/template-library/:slug/select`) backend берёт файл
  из `templates/library`, парсит его через `parseTemplate(...)` и кладёт результат в
  in-memory-кеш `templates` Map.
- Затем возвращает JSON со структурой полей и схемой для рендера.

2) Пользовательские шаблоны

- Загруженный файл попадает в `POST /api/templates` (Multer, память → `file.buffer`).
- Сервер парсит `DOCX` без открытия Word: `templateParser.cjs`:
  - распаковывает документ (ZIP),
  - достаёт теги `{...}`,
  - собирает `schema` и `fields` по путям `d.*`,
  - сохраняет `id` → `path` в `server/uploads`.
- По этому пути файл позже отдаётся в `carbone.render(templatePath, data, options)`.

## Как работает `d` в шаблоне

`d` — это корень JSON-данных, который вы отправляете в API.  
Пример:

```
{d.employee.fullName}
{d.request.date}
{d.documents[0].number}
```

После рендера на сервере в `Carbone` приходит тот же объект JSON в `render`,
и шаблон подставляет соответствующие значения.

## Быстрый запуск в Docker

### Сборка и запуск

```bash
npm run docker:build
npm run docker:up
```

или

```bash
docker compose up --build
```

Открывать: [http://localhost:5173](http://localhost:5173).

### Что внутри контейнера важно

- Установлен `libreoffice` для конвертации в PDF (`carbone.render(..., {convertTo:'pdf'})`).
- `server` и собранный клиент находятся в одном контейнере.
- Шаблоны/сгенерированные файлы вынесены в тома:
  - `server/uploads`
  - `server/generated`

## Полезные команды

- `npm run dev` — локальная разработка (отдельно клиент на 5173, API на 3001).
- `npm run start` — запуск только API.
- `npm run docker:down` — остановка контейнера и удаление томов.
