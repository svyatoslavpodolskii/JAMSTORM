# Разработка на другом ПК

Актуальное продолжение: [HANDOFF.md](HANDOFF.md). Этот документ намеренно вынесен из пользовательской главной страницы.

## Чистый Windows x64

Нужны Git, Node.js 22 LTS и npm. JDK 21 нужен только для дополнительной проверки совместимости с Java, не для сборки приложения.

```powershell
git clone https://github.com/svyatoslavpodolskii/JAMSTORM.git
cd JAMSTORM
npm ci
npm run tunnel:fetch
npm run check
npm test
npm run smoke
npm start
```

Не переносите node_modules, dist или Electron-профиль с другого компьютера. npm ci восстанавливает закреплённые зависимости. tunnel:fetch получает закреплённый cloudflared и проверяет SHA-256. Профиль, вход Google и секреты не входят в git.

```powershell
npm run ui:review
npm run icons
npm run build
```

Portable: dist/JAMSTORM-0.6.0-portable.exe. UI-review использует управляемые данные и создаёт снимки в artifacts/ui-review; исходные картинки публикации — .github/media. Публичные снимки содержат собственную обложку/текст. Изменение источника assets/icon-source.svg требует npm run icons.

Если среда выставляет ELECTRON_RUN_AS_NODE, используйте npm-команды: scripts/run.cjs и electron-task.cjs удаляют переменную перед запуском GUI. Обычный node scripts/ui-review.cjs не запускает Electron.

## Проверки

- npm run check — синтаксис JS/CJS.
- npm test — протокол, нативная очередь, политика Explicit/гостей, криптография, HTTP-комната и отображение поверхностей.
- npm run smoke — IPC, навигация TV→Music, отсутствие наложений, геометрия TV, F11.
- npm run ui:review — 40 комбинаций короткого окна, 25 снимков, запуск анимаций, русский Ctrl K, винил, drag & drop, полный экран.
- npm run smoke:live — реальный TV→Music, первая песня, нативная очередь через гостевые HTTP-команды, тексты, HQ-обложка, уровень аудио и фоновое воспроизведение. Требует сети и доступности YouTube/LRCLIB, использует отдельный профиль jam-desktop-smoke и тестовую комнату. Это не тест физического телефона.

Дополнительный Java-тест берёт исходники Jam-Layer из upstream/Jam-Layer и выполняется при наличии JDK. Не включайте APK и чужое дерево исходников в сборку.

## Архитектура

main.cjs владеет одним BrowserWindow и одним sandboxed WebContentsView YouTube. Локальная сцена — единый DOM. Каталог и TV показывают отдельную нативную поверхность. surface-layout.js определяет видимость; fullscreen оставляет 48px под навигацию. Привилегированный preload доступен только каноническому index.html; удалённая страница не получает Node API.

player.cjs сериализует операции. native-queue.cjs читает и изменяет настоящую очередь Music, проверяя результат. policy.cjs сериализует проверку квот и Explicit перед мутациями. session.cjs передаёт доверенную идентичность Android отдельным контекстом; room.cjs использует подписанную cookie, а не входящий клиентский идентификатор. Не берите actor/explicit из присланных гостем fields.

UI: stage.js — сцена, текст, drag & drop, временные панели; player-effects.js — винил и смена фонового света; app.js — страницы, комнаты, настройки; polish.css — последний слой эффектов/компактных контролов. page-hooks.js выполняется в основном мире YouTube без Node; music-preload.cjs передаёт только ограниченные события и анализирует независимую копию аудиопотока, не меняя вывод звука.

## Релиз

Обновить версии package.json, только корневые версии package-lock.json и scripts/portable.nsi; никогда не заменять номер версии по всему lockfile. Выполнить проверки, собрать EXE и отдельно запустить готовый EXE с --smoke-test. Создать SHA256SUMS, коммит и тег. Загрузить EXE и SHA в GitHub Release. Публикация — из учётной записи разработчика; токены не сохраняются в репозитории. Скрипт публикации конкретного рабочего окружения не является обязательным для продолжения: можно использовать GitHub UI или gh release create.
