# saya-tracker

El registro de entrenamientos de Edgar (el owner): una PWA local-first, de un solo
usuario. Los documentos que mandan son `DECISIONES.md` (el libro — autoridad sobre
esquema y alcance, manda sobre todo lo demás), `BACKLOG.md` (ideas con disparador,
nada se hace "por si acaso") y `FLUJOS.md` (la auditoría de navegación: descriptivo,
no normativo). Este archivo resume y cita; no reescribe ninguna decisión.

## Identidad de git

Todo commit va como `Edgar <davidnavarro81230@outlook.com>`, que ya fija la config
local del repo. Es la identidad de toda la historia y la que Vercel despliega.

## Entornos

`main` es producción con auto-deploy en Vercel (`saya-workout-tracker.vercel.app`).
Neon tiene **una sola base, la de producción**, que guarda los snapshots del
respaldo (§9): toda operación de datos contra ella es de Edgar. El `.env` local
**no se abre en un slice** (es de los secretos, y la guarda del despacho rechaza
cualquier lectura): qué variables existen y dónde viven los valores reales lo dice
`.env.example`, que sí puedes leer y citar. El servidor local corre en el puerto
3210 (`.claude/launch.json`) y arranca sin datos: los datos viven en el teléfono
(Dexie).

## Flujo de ramas

`main` se mueve sólo con el «sí» explícito de Edgar. `pasada/reestructura` es el
tronco de la reestructura (login y rediseño); lo mueve el orquestador y su preview
de Vercel es donde mira Edgar. `slice/<id>` es la rama de un slice y nunca sale de
este disco.

## Reglas de dominio

Las que todo cambio respeta:

- Local-first: la app abre y registra sin señal (§6, §9).
- Nada derivado se almacena; todo se deriva en lectura (§3.5).
- El esquema de Dexie cambia con un bloque `version(n+1)` **nuevo**, nunca editando
  uno desplegado, y sigue su protocolo de export → deploy → verificación (§6, §12.5).
- Sin conversión entre unidades: solo se compara dentro de la misma tupla
  `(exercise_id, weight_unit, weight_basis)` (§3.5, D5).
- Los colores siguen las reglas fijas de §10 (el acento es único, los veredictos
  nunca usan rojo, el ámbar está reservado a dato incompleto).
- Hechos, no consejos, en pantalla: la app no sugiere, muestra (§11.5, §7.5).
- Nada sin disparador: un pendiente nuevo se escribe en `BACKLOG.md` con su
  disparador, no se construye "por si acaso".

## Tier 1 (slices de dos etapas)

El orquestador decide qué slices son de dos etapas leyendo esta frase:

Tier 1 slices run in a separate read-only session first, then a second stage that writes only after the go, over these surfaces: prisma/schema.prisma, src/lib/prisma.ts, src/lib/db/db.ts, src/lib/db/types.ts, src/lib/db/tables.ts, src/lib/db/backup.ts, src/lib/db/seed.ts, src/lib/musculos.ts, src/lib/backup/, src/app/api/snapshot/, src/components/db-boot.tsx, src/components/sw-register.tsx, src/components/backup-sync.tsx, public/sw.js and next.config.ts.

| Superficie | Rutas | Por qué |
| --- | --- | --- |
| Esquema y modelo | `prisma/schema.prisma`, `src/lib/prisma.ts`, `src/lib/db/db.ts`, `src/lib/db/types.ts`, `src/lib/db/tables.ts` | los bloques `version(n)` de Dexie y `SCHEMA_VERSION`; un campo no indexado también es esquema (§3.2); las nueve tablas son el cable del respaldo |
| Respaldo y restauración | `src/lib/db/backup.ts`, `src/lib/backup/`, `src/app/api/snapshot/`, `src/components/backup-sync.tsx` | el único camino de restore, el cable cliente-servidor, su token y cuándo se empuja un snapshot (§9) |
| Lo que escribe al arrancar | `src/lib/db/seed.ts`, `src/components/db-boot.tsx`, `src/lib/musculos.ts` | el seed y las correcciones de catálogo, quien los corre, y `GRUPOS_SEMILLA`, que alimenta la migración v4 (§12.5) |
| Actualización y offline | `public/sw.js`, `src/components/sw-register.tsx`, `next.config.ts` | el service worker, la actualización que entra sólo sin sesión activa, y el `no-cache` de `sw.js` |

(a) **La lista es de Edgar**: una ruta entra o sale por decisión suya, no por un
slice; el login va a traer las suyas. (b) **Regla de ubicación:** una escritura
nueva a `Snapshot` (o a las tablas de cuentas que traiga el login: `User`,
`Session`, `Account`, `Verification`, `Passkey`) o un bloque `version(n)` de Dexie
fuera de estas rutas hace que el orquestador **bloquee todo despacho** hasta que
alguien la clasifique.

## Slices despachados por el orquestador

Para el worker que lea este archivo:

- Su gate es `npx prisma generate`, `npx tsc --noEmit`, `npx eslint .` y
  `npm test` (este último cuando exista el script; hoy no existe). Nada más.
- **No son suyos**: `npm run build` y `next build` (los corre el orquestador en su
  gate), `npm run dev`/`next dev` (además de levantar un servidor, **escribe en
  este `CLAUDE.md`** si le falta su bloque, y en un repo sin `CLAUDE.md` crea
  `AGENTS.md` y `CLAUDE.md`), `next start`, cualquier navegador contra la app,
  `prisma migrate`, `prisma db` y cualquier `--env-file`. La verificación visual la
  hace el orquestador; el preview de `pasada/reestructura` lo revisa Edgar.
- **La identidad de git ya está fijada** en la config local y el orquestador la
  mide antes de despachar (y otra vez antes de mergear, sobre cada commit): un
  slice despachado no corre `git config`.
- El worker **no mergea ni empuja**: commitea en su rama `slice/<id>`. El
  orquestador mergea a `pasada/reestructura` y empuja **sólo** esa rama; `main`
  se mueve sólo con el «sí» de Edgar.
- Los archivos de usar y tirar van en `.scratch/`, en la raíz, que está ignorado.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
