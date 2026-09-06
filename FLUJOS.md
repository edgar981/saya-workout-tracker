# FLUJOS.md — Auditoría de navegación y flujos

Descriptivo. No hay una sola recomendación en este documento: describe la app tal
como está, no como podría estar. La autoridad sobre esquema y alcance sigue siendo
`DECISIONES.md`; esto solo levanta el mapa de cómo se mueve el usuario dentro de lo
ya construido.

**Método.** Los conteos de taps se obtuvieron **recorriendo la app** en el
servidor de desarrollo (`localhost`, catálogo semilla recién sembrado, Day 3 de 8
ejercicios y Day 5 con dos ejercicios unilaterales), no leyendo el código. El resto
del inventario (rutas, aristas, guardas, estado, escrituras) se levantó del código.

**Estado al momento de la auditoría.** El respaldo automático a Postgres ya existe:
al cerrar una sesión se empuja un volcado completo al servidor, con reintento al
abrir la app. `/datos` tiene un panel de "última copia" (fecha, `schema_version` y
conteos del último snapshot del servidor), chip de estado (al día / pendiente /
falló) y restauración desde el servidor (lista de snapshots recientes con doble
toque por fila). Dexie sigue siendo la única fuente de verdad; ninguna lectura de la
app consulta el servidor salvo la restauración manual. Detalle en `DECISIONES.md`
§9.

---

## 1. Inventario de rutas

Todas las páginas son componentes de cliente cargados con `dynamic(..., { ssr:
false })`; el árbol de UI vive entero en el navegador. La columna "render" es del
build de producción.

| Ruta | Pantalla | Render | Parámetro | Qué es |
|---|---|---|---|---|
| `/` | `home-screen` | estática | — | Dos estados. Sin sesión: la lista de días manda y `hace X d` por día (última sesión **cerrada** con series de ese `routine_day_id`; "nunca" si jamás se entrenó) es el dato prominente. Con sesión activa: una **tarjeta protagonista** ("Sesión abierta", antigüedad, progreso `X / N hechos · S series`, "Continuar donde ibas →"), con la lista secundaria bajo "Empezar otro día". Pie: Historial aparte; Plantillas · Catálogo · Respaldo agrupados. Hub de la app; ya **no** autorredirige a `/sesion`. |
| `/sesion` | `session-screen` | estática | — | Registro de la sesión activa (el bucle central). Cabecera con "salir al home" sin cerrar y contador neutro "desde la última serie". |
| `/sesion/cerrar` | `close-screen` | estática | — | Cierre (nota / contexto / peso corporal opcionales) o descarte. |
| `/historial` | `historial-screen` | estática | — | Lista de todas las sesiones, más reciente primero. |
| `/historial/[sessionId]` | `session-detail-screen` | **dinámica (ƒ)** | `sessionId` | Detalle de una sesión: series, veredicto, hueco por serie, duración, tags, peso, nota. |
| `/ejercicio/[exerciseId]` | `ejercicio-screen` | **dinámica (ƒ)** | `exerciseId` | Historial de un ejercicio (últimas 5 sesiones con series). |
| `/plantillas` | `plantillas-screen` | estática | — | Lista de días de plantilla. |
| `/plantillas/[dayId]` | `plantillas-dia-screen` | **dinámica (ƒ)** | `dayId` | Detalle de un día: slots, orden, objetivos, alternativas. |
| `/catalogo` | `catalogo-screen` | estática | — | Lista del catálogo: renombrar, cambiar unidad, dar de baja (fila que se expande en sitio). |
| `/catalogo/nuevo` | `catalogo-nuevo-screen` | estática | — | Formulario de crear ejercicio. |
| `/datos` | `data-screen` | estática | — | Respaldo/restauración: servidor, archivo, integridad, diagnóstico. |
| `/api/snapshot` · `/api/snapshot/latest` · `/api/snapshot/[id]` | rutas de API | **dinámicas (ƒ)** | — | No navegables por el usuario. Las consume el cliente de respaldo. |

Las rutas de página dinámicas lo son por llevar segmento `[param]` sin
`generateStaticParams` (`/historial/[sessionId]`, `/ejercicio/[exerciseId]`,
`/plantillas/[dayId]`); `/catalogo/nuevo` es estática (sin parámetro). El resto
prerenderiza estático.

---

## 2. Grafo de navegación

### 2.1 Aristas por enlace (`<Link>`, un tap)

- `/` → `/historial`, `/plantillas`, `/catalogo`, `/datos` (los cuatro enlaces del pie — Historial como entrada propia, los otros tres agrupados en una fila compacta); y la tarjeta de sesión abierta ("Continuar donde ibas →") → `/sesion` cuando hay sesión activa.
- `/sesion` → `/` (icono "casa" de la cabecera: salir al home SIN cerrar); → `/sesion/cerrar` (botón "Cerrar sesión"); y la tarjeta "Última vez" → `/ejercicio/[id]`.
- `/sesion/cerrar` → `/sesion` (chevron "Volver a la sesión").
- `/historial` → `/` (chevron); cada fila → `/historial/[id]`.
- `/historial/[id]` → cada nombre de ejercicio → `/ejercicio/[id]`; "Sesión en curso · abrir para cerrarla o descartarla" → `/sesion` (solo si `session.activa === 1`); "Volver al historial" → `/historial` (solo cuando la sesión no existe). El chevron "volver" ya no es enlace fijo: ver §2.2.
- `/ejercicio/[id]` → cada entrada de sesión → `/historial/[id]`.
- `/plantillas` → cada día → `/plantillas/[dayId]`; `/plantillas/[dayId]` → `/plantillas` (chevron).
- `/catalogo` → "Crear ejercicio" → `/catalogo/nuevo`; `/catalogo/nuevo` → `/catalogo` (chevron).
- `/plantillas`, `/catalogo`, `/datos` → `/` (chevron de cada lista).

### 2.2 Aristas programáticas (`router.*`)

- `/` : elegir día → `startSession` → `replace('/sesion')`. (Ya **no** hay redirect por sesión activa.)
- `/sesion` : la vista resuelve a `null` (sin sesión activa) → `replace('/')`.
- `/sesion/cerrar` : cerrar → `replace('/historial/[id]?desde=cierre')`; descartar → `replace('/')`; la sesión desaparece sin que navegues tú → `replace('/')`.
- `/historial/[id]` : "volver" (chevron) respeta el origen — si se llegó por cerrar (`?desde=cierre`) → `replace('/')`; si no → `router.back()` con respaldo `push('/historial')`. Eliminar sesión → `replace('/historial')`.
- `/catalogo/nuevo` : al crear → `push('/catalogo')`.
- `/ejercicio/[id]` : "volver" → `router.back()` si hay historial de navegación, si no `push('/historial')`.

### 2.3 Redirecciones automáticas (cero taps)

- **`/sesion` → `/`** cuando no hay sesión activa (entrar a la URL de sesión sin sesión abierta rebota al home).
- **`/sesion/cerrar` → `/`** cuando la sesión activa desaparece "por fuera" (p. ej. cerrada en otra pestaña) y no eres tú quien está navegando. Un `ref` (`navegando`) suprime esta redirección durante el propio cierre/descarte, para que el cierre no rebote al home antes de llegar al detalle.

El `/` → `/sesion` que existía antes se **quitó**: el home ya no autorredirige a la
sesión activa. En su lugar muestra "Sesión en curso · continuar" (1 tap para
volver), lo que hace que salir de la sesión al home sea un estado estable en vez
de rebotar. Reabrir la app en frío con una sesión activa cae en el home, no en
`/sesion`.

### 2.4 Callejones sin salida y asimetrías

- **No hay barra de navegación persistente** (decisión tomada, no se agrega). Cada pantalla secundaria vuelve con su propio chevron; el único concentrador es `/`. `/sesion` ahora sí tiene salida propia: el icono "casa" de la cabecera va al home sin cerrar la sesión (la sesión sigue `activa: 1`).
- **El "volver" de `/historial/[id]` respeta el origen.** Si se llegó por cerrar una sesión (`?desde=cierre`) va al home; si se llegó desde `/historial` o `/ejercicio/[id]`, `router.back()` devuelve ahí. No se usa `router.back()` a ciegas: tras cerrar, el detalle reemplazó a `/sesion/cerrar` en el historial, así que `back()` caería en `/sesion` (ya cerrada) — por eso ese caso va explícito al home.
- **El drill-down de `/plantillas` y el crear-ejercicio de `/catalogo` viven en la URL** (`/plantillas/[dayId]`, `/catalogo/nuevo`): el gesto atrás sube un nivel (al listado), no sale de la sección. En cambio, **expandir una fila del catálogo es estado en sitio** (divulgación, no navegación): el gesto atrás sale de `/catalogo` en vez de colapsar la fila — comportamiento buscado, no regresión.
- **La restauración desde el servidor en `/datos` es in-place**: no cambia de ruta; la lista de snapshots y el resultado se renderizan en la misma pantalla.
- **`/ejercicio/[id]` no tiene destino fijo de vuelta**: usa `history.back()`. Abierto desde la sesión activa vuelve a `/sesion`; abierto desde `/historial/[id]` vuelve a esa sesión; abierto en frío (sin historial de navegación) cae en `/historial`.

---

## 3. Costo en taps del bucle central (recorrido en vivo)

Medido tocando la app en `localhost` con el catálogo semilla. "Tap" = un toque
discreto de pantalla (botón o foco de un campo). El tecleo numérico se cuenta aparte
porque varía con el valor.

**Entrar al registro**

- Con sesión activa: **1 tap** — la tarjeta de sesión abierta ("Continuar donde ibas →") en el home (el home ya no autorredirige). Reanuda en el mismo ejercicio.
- Sin sesión: **1 tap** (el día) → caes en el ejercicio 1/N con el navegador de ejercicios ya visible.

**Registrar una serie (bilateral)**

- Primera serie de un ejercicio, con peso: **3 taps** — "+ Serie" (crea la fila reps + peso), foco en reps, foco en peso — más el tecleo. Al crear la primera serie se asigna el badge "ejecutado Nº" y aparece "Agregar segmento".
- Serie siguiente **al mismo peso**: **2 taps** — "+ Serie", foco en reps. El peso **se precarga** de la serie anterior (observado: la Serie 2 nació con "60" ya puesto en el campo de peso). Cambiar el peso suma 1 tap al campo.
- **Reps como placeholder** (no como valor): el campo de reps muestra en gris —claramente distinto de un valor tecleado— las reps de esa misma posición y lado de la última vez comparable (Serie 1 → las de la serie 1, y así; si hoy hay más series, la extra usa la última disponible). Es placeholder: si no se teclea, la serie queda con reps vacías. Sin registro previo, o si cambió la unidad (§3.5), no hay placeholder y se avisa — el "sin registro previo" de la tarjeta ÚLTIMA VEZ, o un "la unidad cambió" bajo ella. El peso, en cambio, sigue naciendo como valor precargado. Todo esto se deriva en el render de la misma `getLastPerformance` que alimenta el peso; no hay una segunda travesía.
  - Una serie que se queda en **reps 0** (creada y no tecleada) no cuenta como serie realizada: no entra al historial ni a "última vez", no suma al conteo de series, y no arrastra el veredicto. Se filtra `reps > 0` en toda la cadena de lectura (`getPerformanceHistory`, `compareAppearances`, el detalle de la sesión, el conteo del historial). En el detalle de una sesión cerrada, una instancia con solo ceros aparece como "se empezó, sin series", no como "realizado". La captura activa en `/sesion` sí conserva la fila para poder teclearla.

**Registrar una serie (unilateral)**

- "+ Serie" crea **un solo lado (L)** con badge "L" y un botón "Agregar lado derecho". Registrar el otro lado: **1 tap** en "Agregar lado derecho", que hereda el peso. Una serie de dos lados sale en ~**5 taps** ("+ Serie", reps L, peso L, "Agregar lado derecho", reps R).

**Series extra y segmentos**

- Extra **bilateral**: "+ Extra" agrega una fila directo (**1 tap**).
- Extra **unilateral**: "+ Extra" abre un submenú "Izquierdo / Derecho"; elegir lado crea la fila (**2 taps**).
- "Agregar segmento" (giant set): **1 tap** por segmento.

**Moverse dentro de la sesión**

- Cambiar de ejercicio: **1 tap.** El navegador de chips numerados salta directo a cualquier ejercicio del día; las flechas ‹ › van al adyacente (deshabilitadas en los extremos). El orden de los chips no se reordena según lo ejecutado.
- Agregar un ejercicio ad-hoc: **2 taps** — chip "+" abre el buscador del catálogo, elegir uno lo agrega y salta a él. (Filtrar con "Buscar…" suma tecleo.) Desde aquí solo se elige del catálogo; no se crea ejercicio nuevo.
- Sustituir el ejercicio: botón "Cambiar" abre un selector dentro de la misma tarjeta.
- Salir al home sin cerrar: **1 tap** (icono "casa" de la cabecera). La sesión sigue `activa: 1`; volver es 1 tap ("continuar" en el home).

**Cerrar**

- Cierre mínimo: **2 taps** — "Cerrar sesión" (en `/sesion`) → botón "Cerrar sesión" (en `/sesion/cerrar`) → aterrizas en el detalle de esa sesión. Cada opcional (Nota / Contexto / Peso corporal) es 1 tap para desplegar el acordeón más su entrada.
- Descartar en vez de cerrar: **2 taps** con guarda de doble toque en el segundo ("Descartar sesión" arma; "Tocar de nuevo para descartar" ejecuta) → home.

**Composición** (aritmética sobre las unidades ya medidas, no un recorrido de la
sesión entera): un ejercicio bilateral de 3 series al mismo peso = 3 + 2 + 2 = 7
taps, más 1 tap para avanzar al siguiente = 8 taps por ejercicio.

---

## 4. Inventario de guardas e interrupciones

**Cero diálogos nativos.** No hay `window.confirm` en ninguna parte. Toda acción
destructiva es o borrado directo sin diálogo, o doble toque armado.

**Doble toque armado (ventana de 5 s, `ARMED_MS`).** El primer toque arma el botón
(cambia a rojo y a texto "Tocar de nuevo…"); si no llega el segundo en 5 s, se
desarma solo. Seis lugares:

1. Descartar sesión — `close-screen`.
2. Eliminar sesión — `session-detail-screen` (solo en sesiones cerradas).
3. Quitar ejercicio de la sesión — `exercise-card` ("Tocar de nuevo: borra N series").
4. Dar de baja ejercicio — `catalogo-screen` (baja lógica).
5. Quitar slot del día — `plantillas-dia-screen` (baja lógica).
6. Restaurar desde el servidor — `backup-panel`, armado por fila.

**Borrado directo, sin guarda** (D8: un log de gym no es registro auditable):
borrar una serie (icono de basura en la fila) y borrar un grupo de serie completo
(la "X" del grupo) ocurren al primer toque.

**Bloqueos de estado.** En `/catalogo`, los botones de unidad de un ejercicio quedan
deshabilitados (con candado) en cuanto tiene ≥1 serie registrada; el intento de
cambiar unidad por otra vía lanza un error que se muestra inline. Renombrar nunca se
bloquea (el nombre no se snapshotea).

**Invariante de sesión única.** `startSession` cierra cualquier sesión abierta
(`activa: 0`, `cerrada_en`) en la misma transacción que crea la nueva, de modo que
no existe un instante con dos sesiones activas.

**Interrupción por Service Worker.** Cuando hay una versión nueva del SW aparece un
aviso no bloqueante abajo ("Hay una versión nueva / Actualizar"), fijo, **solo si no
hay sesión activa**; con una sesión abierta el aviso espera a que se cierre.
Aplicarlo recarga la página una vez (y correría la migración de Dexie si la trae).

**Guarda de la restauración.** Ni archivo ni servidor abren un modal: la guarda es
el auto-export obligatorio del estado actual antes de tocar Dexie. Si ese export
falla, la restauración no corre. Además, un `schema_version` distinto del actual
aborta sin escribir.

**Botones deshabilitados como guarda de flujo.** Flecha ‹ en el primer ejercicio y ›
en el último; "Cerrar sesión" mientras guarda; "Respaldar ahora" mientras empuja;
"Restaurar" de las demás filas mientras una restauración está en curso; "Crear"
ejercicio con el nombre vacío.

---

## 5. Dónde vive el estado de UI

Tres capas, más el autosave.

**Dexie (fuente de verdad, reactiva vía `useLiveQuery`).** Todo el dato de dominio.
Una docena de componentes leen con `useLiveQuery`, así que un cambio en la base se
refleja solo en cada pantalla montada. Ninguna pantalla tiene botón "Guardar".

**localStorage (dos claves).**

- `saya:ejercicio:<sessionId>` — el índice del ejercicio visible en `/sesion`. Se
  escribe al montar la sesión y en cada cambio de ejercicio; hace que volver a entrar
  a la sesión (por la tarjeta de sesión abierta en el home, o por salir y regresar)
  restaure el ejercicio exacto. Se borra al cerrar o descartar la sesión.
- `saya:backup:state` — `{ pending, lastError, last }` del respaldo (última copia
  conocida, si se debe un push, y el motivo del último fallo). Lo mantiene el cliente
  de respaldo, con un coalescer en memoria para no duplicar pushes concurrentes y
  sincronización entre pestañas por el evento `storage`.

**React efímero (`useState` / `useRef`).** Nada de esto sobrevive un reload:
secciones expandidas/colapsadas (nota, contexto, peso, filas del catálogo y slots de
plantilla), pickers abiertos (ad-hoc, sustituir, alternativa), el flag `armed` del
doble toque, los `ref` `navegando` (supresión de redirección al cerrar) y `reloading`
(recarga tras aplicar el SW), y los borradores de los inputs antes de que el autosave
los persista. El drill-down de plantillas y el crear-ejercicio de catálogo ya **no**
viven aquí: pasaron a la URL (`/plantillas/[dayId]`, `/catalogo/nuevo`, §2.4). Lo que
sigue en estado es expandir una fila del catálogo o un slot — divulgación en sitio,
que el gesto atrás no colapsa.

**Autosave.** No hay botón de guardar en ninguna pantalla. Reps, peso, notas y
objetivos se persisten con debounce (`useAutosave`) y un `flush` en el blur, para no
perder lo tecleado si sales con el gesto de "atrás" (que no dispara `focusout`).

---

## 6. Lecturas que exigen escritura

Lugares donde ver/abrir algo obliga a que ocurra una escritura.

- **Arranque en base vacía.** Abrir la app dispara `seedIfEmpty` (`DbBoot`): con la
  tabla `exercises` vacía, escribe el catálogo semilla (32 ejercicios, 5 días, 29
  slots, 6 tags) dentro de una transacción. El home no puede mostrar días sin esa
  escritura; leer el home por primera vez la provoca.
- **Migración de esquema al abrir Dexie.** Si el dispositivo está en `version(1)` y
  el código en `version(2)`, abrir la base corre el `upgrade` (escribe `activo`,
  `orden_visual`, `orden_ejecucion`, `creado_en`) antes de la primera lectura.
- **Abrir `/sesion`.** El efecto del índice persiste `saya:ejercicio:<id>` en
  localStorage al montar, aunque no toques nada.
- **Empezar una sesión para verla.** `startSession` no solo crea la sesión: cierra
  cualquier sesión abierta previa (`activa: 0`, `cerrada_en`) en la misma transacción.
- **Restaurar (archivo o servidor).** Leer un backup obliga a escribir antes: el
  auto-export del estado actual corre primero, y si esa escritura falla, la
  restauración no toca Dexie.
- **Cerrar una sesión.** Escribe `cerrada_en` y, como efecto, dispara el push del
  snapshot a Postgres (`backupNow`) y actualiza `saya:backup:state`. Un push
  pendiente se reintenta al abrir la app (`BackupSync`).

Por contraste, **no** escriben: ver "Última vez" y el veredicto, avanzar entre
ejercicios, listar el historial, y abrir el detalle de una sesión o el historial de
un ejercicio — son lecturas puras (`getLastPerformance`, `getPerformanceHistory`,
`loadSessionDetail`, `loadExerciseHistory`).
