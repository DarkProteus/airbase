
<!-- BACKLOG.MD GUIDELINES START -->
<!-- backlog.md-instructions-version: 1.55.3 -->
<CRITICAL_INSTRUCTION>

## Backlog.md Workflow

This project uses Backlog.md for task and project management.

**At the beginning of each conversation in this project, run `backlog instructions overview` before answering or taking action. Re-read it only if you have not read it yet in the current conversation.**

Use the overview to decide whether to search, read, create, or update Backlog tasks.

Before task lifecycle actions, read the matching detailed guide:
- `backlog instructions task-creation` before creating or splitting tasks
- `backlog instructions task-execution` before planning, changing status or assignee, adding a plan or implementation notes, or implementing task work
- `backlog instructions task-finalization` before checking acceptance criteria, writing final summaries, or moving tasks to terminal statuses

Use `backlog <command> --help` before running unfamiliar commands. Help shows options, fields, and examples.

Do not edit Backlog task, draft, document, decision, or milestone markdown files directly. Use the `backlog` CLI so metadata, relationships, and history stay consistent.

</CRITICAL_INSTRUCTION>
<!-- BACKLOG.MD GUIDELINES END -->

## AIRBASE: правила проекта

Дизайн: `docs/design.md`. Стек: TS + Vite, Three.js, React, Zustand, Vitest, npm.

```
src/sim      чистая логика матча (типы, движок, RNG) — headless
src/content  контент как данные: юниты, враги, миссии (TS-конфиги + реестры)
src/render   Three.js: изометрия, фикс. камера; читает снапшот sim
src/ui       React: универсальные компоненты, строятся из конфигов
src/store    Zustand: только UI-состояние и снапшот sim, без логики
```

- **Sim отдельно от рендера.** В `src/sim` запрещены импорты three/react/zustand и
  слоёв render/ui/store (сторожит `src/sim/purity.test.ts`). Мутации матча — только
  командами sim; store и UI логики не содержат.
- **Контент = данные.** Юнит — `UnitConfig`, синергии — теги + `Modifier`. Никаких
  ветвлений по id юнита в движке; карточки и рендер — универсальные, из конфига.
  Сначала переиспользуй существующее, потом пиши новое.
- **Детерминизм.** Фиксированный шаг тика, сидированный RNG из `src/sim/rng.ts`.
  В sim нельзя `Math.random`, `Date.now`, `performance.now`; время в тиках.
- **Тесты.** `npm run check` (= `tsc --noEmit` + `vitest run`) — перед каждым
  коммитом, его же запускает pre-commit hook. Один файл: `npx vitest run <путь>`.
  Логика sim покрывается тестами рядом с кодом (`*.test.ts`).
- **Поиск по коду.** codebase-memory MCP (символы, вызовы, архитектура) и
  `ast-grep` (`ast-grep -p '<шаблон>' src`); не читай файлы целиком ради поиска.
- **Правки.** Существующие файлы — точечно, не переписывай целиком.
- **Коммит после каждой задачи** Backlog: `TASK-N: <что сделано>`, статус Done —
  только после проверки критериев приёмки.

## Цикл «дальше»

По команде «дальше»:
1. Возьми следующую незаблокированную задачу To Do из backlog (все зависимости Done).
2. Исполнитель — assignee задачи: `@sonnet` → отдай субагенту Sonnet, `@fable` → делай сам.
3. Независимые задачи можно параллельно: разные файлы, субагенты не коммитят — коммитит главный.
4. Проверь критерии приёмки и `npm run check`, затем Done в backlog и коммит.
5. Отчёт ≤5 строк и стоп.

Если задача неясна или противоречит `docs/design.md` — спроси, не угадывай.
