# Documento de decisión — Workout Tracker v1

**Versión:** 1.2
**Fecha:** 2026-08-14
**Estado:** cerrado — §7 resuelto, listo para construir
**Alcance:** app personal de registro de entrenamiento. Un solo usuario. No es producto Duna.

---

## 1. Problema

El registro actual vive en un archivo de Notes con notación libre. Funciona para escribir, falla para leer: no hay fechas, hay pesos faltantes, cuatro sistemas de unidades mezclados y objetivo/ejecutado conflacionados en la misma línea. El histórico no es reconstruible sin pérdida.

**El valor de la app no es registrar más rápido — es poder leer la progresión.** Registrar es el costo; la lectura es el beneficio. Todo el diseño se subordina a eso.

**Contexto de uso confirmado:** el registro ocurre *durante* el entrenamiento, con descansos largos entre series (2–5 min). Hay tiempo de sobra para tipear. La restricción real no es velocidad de captura: es **reanudabilidad** — el teléfono se bloquea, se abre otra app, iOS mata el proceso.

---

## 2. Decisiones tomadas

| # | Decisión | Razón | Confianza |
|---|---|---|---|
| D1 | **No migrar el histórico** del archivo de Notes | Datos sin fecha y con pesos faltantes contaminan cualquier análisis de progresión, que es el único valor de la app | [Certain] |
| D2 | **Local-first** (IndexedDB fuente de verdad, push a Postgres como respaldo) | No hay señal en el gym; un guardado fallido a mitad de sesión mata la adopción. El respaldo no es opcional porque **cada migración de esquema de Dexie corre contra la única copia de los datos** — no por el desalojo de Safari (§6). Retrofittear esto es reescritura completa | [Likely] |
| D3 | **Autosave por serie**, no por sesión | Sin transacción "guardar entrenamiento" al final que se pueda perder | [Certain] |
| D4 | **Snapshot de unidad en cada serie** | Si mañana cambia el `unit_type` de un ejercicio, el histórico no debe mutar | [Certain] |
| D5 | **Sin conversión entre unidades** | `disc` de una máquina no es convertible a kg sin calibrar esa máquina. Se compara dentro de la misma unidad o no se compara | [Certain] |
| D6 | **Un solo usuario, sin multi-tenancy** | Si algún día es producto, se reescribe. Sale barato | [Certain] |
| D7 | **Notas de contexto en capa 1** | Sin ellas, una caída de fuerza es indistinguible de ruido seis meses después | [Likely] |
| D8 | **Borrado duro permitido** en series y sesiones | La doctrina "no deletes" de coffee-template-app aplica a registros auditables (Order/Payment). Un log de gym no lo es. Una serie mal tipeada se borra | [Certain] |
| D9 | **Todo el gym se registra en `LB`** salvo dos excepciones | Ver §7. Los stacks de cable están marcados en libras, así que no hay nada que calibrar: se lee la marca y se escribe | [Certain] |

---

## 3. Modelo de datos

### 3.1 Catálogo

**`Exercise`** — definición estable de un ejercicio.

| Campo | Tipo | Nota |
|---|---|---|
| `id` | uuid | |
| `nombre` | string | |
| `unit_type` | enum | `KG` \| `LB` \| `BODYWEIGHT` \| `BODYWEIGHT_PLUS` \| `STACK_POSITION` |
| `weight_basis` | enum | `TOTAL` \| `PER_IMPLEMENT` — solo aplica a `KG`/`LB`. Resuelve mancuernas: ¿30 lb es por mancuerna o la suma? |
| `stack_label` | string? | Etiqueta de la unidad de stack cuando `unit_type = STACK_POSITION` (ej. `"disc"`) |
| `laterality_default` | enum | `BILATERAL` \| `UNILATERAL` |
| `grupos` | objeto | grupo muscular → `directo` \| `indirecto` (v4, §12). Clasificación, no se snapshotea |
| `activo` | bool | |

`unit_type` es **por ejercicio, no global**. Es la decisión central del modelo.

- `BODYWEIGHT_PLUS`: se registra solo el peso *añadido* (`+15kg` en dominadas). La carga total requiere el peso corporal → §3.4.
- `STACK_POSITION`: se guarda el número crudo y nada más. No se convierte, no se suma a otros ejercicios, no entra en volumen total.
  **Ningún ejercicio de la semilla lo usa** (§7.4 lo eliminó del catálogo inicial). Se conserva en el enum porque cuesta cero y cubre la máquina sin marcar que aparezca algún día. Si en seis meses sigue sin usarse, se borra.

**`RoutineDay`** — Day 1..5 del mesociclo.

| Campo | Tipo |
|---|---|
| `id` | uuid |
| `nombre` | string (`"Day 1"`) |
| `orden` | int |

**`RoutineSlot`** — un ejercicio planeado dentro de un día.

| Campo | Tipo | Nota |
|---|---|---|
| `id` | uuid | |
| `routine_day_id` | fk | |
| `exercise_id` | fk | ejercicio primario |
| `orden` | int | |
| `target_sets` | int? | el `3 sets x` de la notación |
| `target_reps` | int? | el `x 8` — **objetivo, separado de lo ejecutado** |

**`RoutineSlotAlternative`** — el caso `Cable curl / single arm cable curl`.

| Campo | Tipo |
|---|---|
| `routine_slot_id` | fk |
| `exercise_id` | fk |

Las alternativas son filas `Exercise` completas, no un campo variante, porque **pueden tener `unit_type` distinto**. Caso real: `Wide grip Pull down` (`LB`) alterna con dominada a peso corporal (`BODYWEIGHT_PLUS`).

### 3.2 Ejecución

**`Session`** — un entrenamiento.

| Campo | Tipo | Nota |
|---|---|---|
| `id` | uuid | |
| `fecha` | date | |
| `routine_day_id` | fk? | null si es sesión libre |
| `iniciada_en` / `cerrada_en` | timestamp | `cerrada_en` null = sesión activa, se reanuda al abrir la app |
| `nota` | text? | libre, se llena al cerrar |

**Una sesión sin contenido no se registra.** Al cerrar —tanto el cierre automático de `startSession` al empezar otro día como el explícito desde `/sesion/cerrar`— una sesión que no tiene NADA tecleado por el usuario (ni una serie ni una nota por ejercicio) se **descarta** en cascada (`discardSession`) en vez de cerrarse: abrir un día y no registrar nada no deja un registro fantasma de cero series en el historial. La excepción es el formulario de cierre: si el usuario escribió nota, tags o peso corporal, eso es dato suyo y la sesión se cierra normal aunque no tenga series.

**Empezar una sesión es un gesto deliberado: vista previa antes del arranque.** Tocar un día en el home elegía y comprometía en el mismo gesto — la sesión arrancaba al instante, y no se sentía estar empezando algo porque no se empezó, solo se tocó. Ahora tocar un día abre una **hoja de vista previa** (desde abajo, con "Empezar" en la zona del pulgar) y la sesión se crea solo al tocar "Empezar". Es **un tap extra, a propósito**: la restricción de dos taps es para *registrar una serie*, que ocurre decenas de veces por entrenamiento; *empezar* ocurre una vez, así que puede pagar el gesto deliberado. Efecto secundario que resuelve: un toque accidental ya no crea una sesión real — el descarte de `startSession` sobre una sesión sin contenido deja de ser la primera línea de defensa y pasa a ser la red de abajo. Abrir, mirar y cerrar la hoja no escribe nada en Dexie. Detalle de navegación en `FLUJOS.md` §2.6.

**`SessionExercise`** — instancia ejecutada de un ejercicio.

| Campo | Tipo | Nota |
|---|---|---|
| `id` | uuid | |
| `session_id` | fk | |
| `routine_slot_id` | fk? | null si fue agregado fuera de plantilla |
| `exercise_id` | fk | **el que realmente se hizo** |
| `orden` | int | |
| `nota` | text? | el caso `Ts w` — contexto por ejercicio |

**Sustitución** (el `//` de `Squats // Hack Squats`) no es un campo: es la condición `routine_slot_id.exercise_id ≠ exercise_id`. Se deriva, no se escribe. La UI la muestra como badge.

**`SetLog`** — una serie.

| Campo | Tipo | Nota |
|---|---|---|
| `id` | uuid | |
| `session_exercise_id` | fk | |
| `set_index` | int | 1-based |
| `segment_index` | int | `0` en series normales; `0..n` en giant sets |
| `reps` | int | |
| `weight_value` | decimal? | null en `BODYWEIGHT`. Decimal, no entero — cubre medias posiciones de stack (37.5 lb) |
| `weight_unit` | enum | **snapshot** — copiado de `Exercise.unit_type` al crear, nunca leído por join |
| `weight_basis` | enum | **snapshot** de `Exercise.weight_basis` |
| `side` | enum? | `null` \| `L` \| `R` |
| `es_extra` | bool | serie fuera de la plantilla |
| `creado_en` | timestamp? | **no indexado**. Cuándo se creó la fila. Nullable; ver abajo |

Tres casos que este modelo resuelve y el ingenuo no:

1. **Giant set** = una serie con N segmentos. `1 giant set x 70 reps → 16+15+11+8+10+9` es `set_index=1`, `segment_index=0..5`. No son 6 series.
2. **Asimetría** `6L/7R` = dos filas, mismo `set_index`, `side=L` y `side=R`.
3. **Serie extra unilateral** `4L` = `es_extra=true`, `side=L`. Requiere que la UI permita agregar series con lado, no solo repetir la plantilla.

**Efecto secundario gratuito:** el volumen acumulado por lado queda registrado sin trabajo adicional. La vista que lo muestre es capa 2.

**`creado_en` (Tiempo entre registros).** Marca cuándo se creó la fila, que en la práctica es cuándo terminaste la serie y la anotaste. El hueco entre dos `creado_en` consecutivos **no es descanso puro**: incluye el descanso más la ejecución de la serie siguiente — por eso no se rotula "descanso" en ninguna parte de la UI. Se escribe solo al crear la fila; editar reps o peso después no lo toca.

Es un campo **no indexado**: se agrega solo a la interfaz de TypeScript, sin declararlo en `stores()`, así que **no** sube a `version(3)` ni corre migración. Bumpear no tendría beneficio y sí un costo real: el import rechaza respaldos con `schema_version` distinta, así que invalidaría todos los snapshots existentes por un campo que no lo necesita. Nullable a propósito: las filas anteriores al campo se quedan sin valor y **no** se rellenan desde `iniciada_en` — sería un dato falso presentado como observado (mismo criterio que `orden_ejecucion`). Todo lo derivado —hueco por serie, duración de la sesión, contador en vivo— se calcula en lectura; nada se almacena. Sin umbrales, sin alertas, sin color por tiempo: es información, no una meta.

### 3.3 Contexto

**`SessionTag`** — chips predefinidos, editables por el usuario.
**`SessionTagLink`** — many-to-many con `Session`.

Semilla inicial: `dormí mal`, `deload`, `máquina distinta`, `molestia`, `sin tiempo`, `bajó la fuerza`.

**Los tags se editan también después del cierre**, desde el detalle de la sesión (`/historial/[id]`), con el mismo chip del cierre; cada toque guarda. Disparador: la sesión del 5 nov, de la semana de descarga, se cerró sin `deload` y capa 2 la leía como una sesión normal (§11.2 excluye por ese tag). No es reescribir en silencio lo que capa 2 ya leyó: el cambio es explícito y su efecto es justo el que se busca. Solo tags, y solo de sesiones cerradas: los de la activa se ponen al cerrarla. Editar series o notas de una sesión pasada sigue en BACKLOG.
[Guessing] — sale de una sola anotación en cinco días de datos. Los chips reales emergen del uso: si terminas escribiendo lo mismo a mano tres veces, se vuelve chip.

### 3.4 Peso corporal

**`BodyweightLog`**: `fecha`, `valor`, `unidad`.

Sin esto, `+25kg` en dominadas no tiene denominador y la progresión en `BODYWEIGHT_PLUS` es no interpretable. No hay UI dedicada en capa 1: un campo opcional en el cierre de sesión. Capa 2 lo usa para comparar `BODYWEIGHT_PLUS` entre cargas añadidas (§11.2).

### 3.5 Estado derivado

Nada calculado se almacena. e1RM, volumen y tendencias se derivan en lectura. Regla de comparación: **solo dentro de la misma tupla `(exercise_id, weight_unit, weight_basis)`**. Si cambia la unidad, la serie histórica se corta visualmente en lugar de convertirse.

Esta regla es la que absorbe la inconsistencia de §7.1: `Incline DB Press` en `TOTAL` y `DB Skull Crushers` en `PER_IMPLEMENT` nunca se comparan entre sí, así que la mezcla no produce lecturas falsas. Solo hay que no romper la base *dentro* de un mismo ejercicio.

**Veredicto compacto de sesión (fila del historial).** El neto `mejor − peor` de los ejercicios de esa sesión. "igual" y "sin comparación" NO entran al neto. Deriva del mismo `Record` de veredictos que ya calcula `loadSessionVerdicts` (`getPerformanceHistory` + `compareAppearances`): ni una segunda travesía ni una segunda regla. Como el neto oculta la cobertura, la fila expone aparte cuántos ejercicios quedaron **sin comparación** (unidad cambiada o sin historial previo) con un punto discreto, para que un `+2` sobre 4 ejercicios comparados no se lea igual que sobre 4 comparados y 2 sin base. Color como en §10: tinta plena si es positivo, atenuado en cero y negativo; nunca acento ni rojo.

**Mejor serie registrada (historial de ejercicio).** La serie de **mayor peso**; los empates se rompen por **más reps**. Sin e1RM ni ninguna fórmula: el rango de reps del usuario llega a 16 y ahí Epley deja de ser confiable, así que una fórmula mentiría en parte del historial. Se calcula **solo dentro del snapshot de unidad más reciente** (`weight_unit` + `weight_basis` + `added_unit`) — un "mejor de siempre" que mezcle kg y lb no significa nada (misma regla de §3.5, no se convierte). Cada fila (lado, segmento) es candidata, así que en unilateral la mejor sale con su lado. En `BODYWEIGHT`, donde no hay peso, la mejor es la de **más reps**. Se muestra con su fecha y, en unilateral, el lado. Derivada en lectura de la misma travesía (`getPerformanceHistory`) que alimenta la lista de sesiones; no es un veredicto y no reusa `compareAppearances` (no compara dos apariciones, resume una columna).

### 3.6 Mesociclos

Un **`Mesociclo`** (`id`, `nombre`, `iniciado_en`, `terminado_en`, `activo`) agrupa los `RoutineDay` de un plan. `RoutineDay` gana `mesociclo_id` (indexado). Antes, los cinco días eran los únicos que existían y cambiar de plan editaba las plantillas en sitio: se volvía irrecuperable cómo se veía Day 3 en agosto. Ahora cambiar de plan es **crear/activar otro mesociclo**; el viejo conserva su composición intacta para el histórico, y la baja lógica de slots deja de ser la única red.

**Invariante: exactamente uno activo.** Activar otro cierra el anterior (`activo: 0`, se sella `terminado_en`) en la MISMA transacción — igual que `startSession` con las sesiones, para que no exista un instante con dos activos. `checkIntegrity` verifica que no haya mesociclos activos de más ni `RoutineDay` sin `mesociclo_id`.

**`iniciado_en` es un valor DERIVADO en la migración, no observado.** La migración a `version(3)` envuelve los cinco días existentes en "Mesociclo 1" activo y le pone como `iniciado_en` la fecha de la sesión más antigua **con series reales** (reps > 0). El mesociclo no existía cuando se registraron esas sesiones, así que la fecha se infiere — mismo criterio que `orden_ejecucion` en v2. Sin ninguna sesión con series, queda `null`, y no se inventa una fecha. De ahí sale la **semana del mesociclo** del home (semanas completas transcurridas + 1); con `iniciado_en` null no se muestra número de semana (no se cae de vuelta a la semana ISO del año, que no informaba nada).

**Lo que NO cambia.** `Session` sigue apuntando a `routine_day_id` y **no** gana `mesociclo_id`: es derivable por el día, y almacenarlo sería dato derivado — el histórico queda intacto sin tocar una sola fila de sesiones. `getPerformanceHistory` indexa por `exercise_id`, no por día ni mesociclo, así que el historial de un ejercicio **cruza mesociclos**: la fuerza no se reinicia porque cambió el plan. Duplicar un mesociclo **copia** días, slots y alternativas (ids nuevos); no mueve, para que el original quede intacto. Nada se borra duro: los `RoutineDay` de un mesociclo viejo los referencia el histórico; un `terminado_en` ya lo saca del camino, así que no hizo falta baja lógica de mesociclos.

---

## 4. Catálogo semilla

Extraído de tu mesociclo. `PI` = `PER_IMPLEMENT`, `T` = `TOTAL`.

### Day 1
| Ejercicio | unit_type | basis | lat |
|---|---|---|---|
| Pull up | `BODYWEIGHT_PLUS` (kg) | T | BIL |
| Pull down | `LB` | T | BIL |
| Incline Bench Press Medium Grip | `LB` | T | BIL |
| Incline DB Press | `LB` | **T** ✅ §7.1 | BIL |

### Day 2
| Ejercicio | unit_type | basis | lat |
|---|---|---|---|
| DB Skull Crushers | `LB` | PI | BIL |
| DB OH Triceps Extension | `LB` | PI | **UNI** |
| DB Lateral Raises | `LB` | PI | BIL |
| Barbell Bicep Curls | `LB` | **T** ✅ §7.2 | BIL |
| Barbell Standing Wrist Curl | `LB` | T | BIL |

### Day 3
| Ejercicio | unit_type | basis | lat |
|---|---|---|---|
| Squats | `KG` | T | BIL |
| Hack Squats | `LB` | T | BIL |
| Matrix Hack Squats | `LB` | T | BIL |
| Leg Curl | `LB` | T | BIL |
| Lying Leg Curl | `LB` | T | BIL |
| Hanging Leg Raises | `BODYWEIGHT` | — | BIL |
| Weighted Decline Crunches | `BODYWEIGHT_PLUS` (lb) | T | BIL |
| Leg Extensions | `LB` | T | BIL |
| Calf Raises | `LB` | T | BIL |

`Hack Squats` es alternativa de `Squats` (registrado como sustitución en una sesión real).

### Day 4
| Ejercicio | unit_type | basis | lat |
|---|---|---|---|
| Incline Bench Press Wide Grip | `LB` ✅ §7.3 | T | BIL |
| Weighted Dips | `BODYWEIGHT_PLUS` (kg) | T | BIL |
| Wide Grip Pull Down | `LB` | T | BIL |
| Wide Grip Pull Up (bw) | `BODYWEIGHT_PLUS` (kg) | T | BIL |
| Chest Supported Rows | `LB` | T | BIL |
| Close Grip Bench Press | `LB` | T | BIL |

`Wide Grip Pull Up` es alternativa de `Wide Grip Pull Down` — **unit_type distinto entre alternativas**, caso que justifica `RoutineSlotAlternative`.

### Day 5
| Ejercicio | unit_type | basis | lat |
|---|---|---|---|
| EZ Bar Curl | `LB` | T | BIL |
| DB Bicep Curl | `LB` | PI | BIL |
| Cable Curl | `LB` ✅ §7.4 | T | BIL |
| Single Arm Cable Curl | `LB` ✅ §7.4 | T | UNI |
| Cable Lateral Raises | `LB` ✅ §7.4 | T | BIL |
| Single Arm Cable Push Down | `LB` ✅ §7.4 | T | UNI |
| Forearm Curls | `LB` | T | BIL |
| Concentration Hammer Curls | `LB` | PI | UNI |

**Nota de captura para cables:** los stacks están marcados, así que se lee la libra directamente del stack. Si usas media posición, se escribe el decimal (`37.5`) — `weight_value` lo soporta. Deja de contar `disc`.

---

## 5. Alcance capa 1

**Dentro:**
- Catálogo de ejercicios y 5 plantillas de día, editables
- Iniciar sesión → **elegir día manualmente** (§7.5) → lista precargada en orden
- Cada ejercicio muestra los valores de la última sesión **del mismo ejercicio** (no del slot) como valores por defecto editables. No es un atajo de tipeo: es la pantalla donde eliges el peso de la siguiente serie
- Agregar serie extra, con lado
- Marcar sustitución (elegir alternativa o cualquier ejercicio del catálogo)
- Giant sets: botón "agregar segmento"
- Cierre de sesión: notas + chips + peso corporal, todo opcional y colapsado
- Historial por ejercicio: últimas 5 sesiones, tabla, **sin gráficas**
- PWA instalable, funcional sin red, sesión activa reanudable
- **Export / import JSON de la base completa**, como mecanismo de recuperación. Un botón baja todo el contenido de Dexie a un archivo; otro lo restaura. Es la red de seguridad del versionado de esquema (§6), no una feature de producto — por eso está en capa 1 pese a ser lo último que quieres tocar

**Fuera, explícitamente:**
gráficas y analítica · e1RM · volumen por grupo muscular · timer de descanso · calculadora de discos · progresión automática o sugerencia de peso · medidas corporales · videos o catálogo de ejercicios externo · multi-usuario · **exportar para compartir o publicar** · integración con wearables · **tabla de calibración de stacks** (§7.4 la volvió innecesaria)

El export de recuperación y el export para compartir no son la misma cosa y no se implementan igual. El de recuperación es un volcado crudo de Dexie, feo, completo y solo legible por esta app. Compartir implicaría formato estable, redacción de datos y una decisión sobre qué es presentable — nada de eso está en capa 1.

**Sobre el timer de descanso:** [Certain] va a ser lo primero que quieras. Espera a quererlo. Tu archivo actual no registra tiempos, así que no es un hábito que tengas — agregarlo ahora es inventarte una conducta nueva mientras validas la app. Es además una columna aditiva (`rest_seconds` nullable en `SetLog`), sin migración dolorosa.

---

## 6. Stack

Mismo core que ya manejas, más una pieza:

- Next.js 16 / React 19 / Tailwind v4 / shadcn/ui
- **Dexie (IndexedDB) como fuente de verdad** ← pieza nueva
- Prisma / Neon Postgres como respaldo, vía un endpoint de push
- Vercel Hobby, PWA instalable

Sincronización: un solo usuario, last-write-wins por `id`. Sin CRDTs, sin resolución de conflictos.

**Versionado de esquema:** Dexie se declara con `version(1)` explícito desde el primer commit, aunque todavía no haya nada que migrar. Cada cambio posterior es un bloque `version(n+1).stores({...}).upgrade(...)` **nuevo**, nunca una edición del bloque anterior. Editar un `version()` ya desplegado es la forma silenciosa de corromper una base poblada: el teléfono que ya está en la versión N nunca vuelve a correr ese upgrade, y el esquema declarado deja de describir los datos reales.

**Protocolo de migración:** ninguna migración se despliega sin un export manual previo (§5). El orden es exportar JSON → desplegar → abrir la app → verificar que el conteo de sesiones y series cuadra con el export. Si no cuadra, se restaura el JSON. Este protocolo es la razón por la que el export está en capa 1: sin él, cada deploy con cambio de esquema es una apuesta sobre la única copia de los datos.

**Nota sobre Safari iOS:** IndexedDB puede ser desalojado tras ~7 días sin uso si la app no está instalada en pantalla de inicio. [Likely] Es razón suficiente para pedir la instalación explícitamente en el primer arranque, pero **no** es lo que hace obligatorio el respaldo — eso es el versionado de arriba. Un mesociclo de 4 semanas no deja huecos de 7 días, así que el desalojo es un riesgo de borde; la migración es un riesgo de cada deploy.

---

## 7. Decisiones abiertas — RESUELTAS

**7.1 — `Incline DB Press: 150lb` → `LB` / `TOTAL`** ✅
Es la suma de las dos mancuernas (75 lb c/u). Queda como el único ejercicio con mancuernas registrado en `TOTAL` mientras el resto va en `PER_IMPLEMENT`. La inconsistencia es real pero inofensiva: §3.5 solo compara dentro del mismo `exercise_id`. Lo que sí importa es no cambiar la base de este ejercicio a mitad de camino — si un día anotas 75, la serie histórica miente sin avisar.

**7.2 — `Barbell Bicep Curls` → `LB` / `TOTAL`** ✅
El canónico es carga total con barra incluida (los 80 lb). El registro de 30 lb se descarta, consistente con D1: no se migra nada del archivo de Notes de todos modos.

**7.3 — `Incline Bench Press Wide Grip` → `LB`** ✅
La máquina está marcada en libras; convertir mentalmente a kg introduce error. El `70.7 kg` no se guarda.

**7.4 — Cables → `LB` / `TOTAL`, sin tabla de calibración** ✅
Los stacks del gym están marcados en libras, lo que hace innecesario el camino (b) del documento original: no hay que mapear `disc → lb` una sola vez, se lee la marca y se escribe. Esto elimina una tabla entera del modelo y deja `STACK_POSITION` sin ningún ejercicio que lo use (se conserva en el enum por si aparece una máquina sin marcar).

**7.5 — Elección manual del día** ✅
La app no propone "hoy toca Day 3". Es más simple y nunca se equivoca. Si tras un mesociclo resulta que siempre eliges el mismo siguiente día, la sugerencia se agrega entonces con evidencia.

---

## 8. Criterio de validación

**Registras un mesociclo completo (4 semanas) en la app sin volver a Notes ni una sola vez → se construye capa 2** (gráficas de progresión, e1RM, volumen por grupo muscular, balance por lado).

**Vuelves a Notes aunque sea una sesión → el problema es fricción, y se arregla eso antes de agregar cualquier feature.** La sesión en que vuelvas a Notes es el dato más valioso que va a producir este proyecto: dime por qué volviste.

No hay tercer resultado. Si en 4 semanas la app no reemplazó al archivo de texto, agregarle features no lo va a arreglar.

---

## 9. Respaldo automático a Postgres

Añade la pieza que §6 anticipaba: un push de snapshots a un backend. Se construyó porque el riesgo que **sí** se materializó no fue el que justificaba el local-first. La tesis de D2/§6 era la migración de esquema contra la única copia. Eso nunca rompió nada. Lo que rompió fue el desalojo: se desinstaló la PWA de la pantalla de inicio y iOS borró IndexedDB con ella — dos días de entrenamientos perdidos. La nota de §6 lo tenía como "riesgo de borde"; en la práctica fue el que costó datos.

La conclusión no es abandonar el local-first. Dexie sigue siendo la fuente de verdad y la app sigue operando completa sin señal. Lo que faltaba era que perder el teléfono, desinstalar la app o borrar datos del sitio costara cero.

**Es respaldo, no sync.** Sin seguimiento de cambios, sin merge, sin resolución de conflictos, sin segundo dispositivo. Un push de snapshot completo (las nueve tablas, el mismo objeto que exporta /datos) al cerrar una sesión. La restauración es manual y explícita: se descarga un snapshot y entra por el mismo import de /datos — reemplazo total, auto-export previo, rechazo por schema_version distinto. Ningún camino automático escribe en Dexie desde el servidor.

**Append-only.** Cada push es una fila nueva; nunca se sobrescribe ni se borra un snapshot. Si un push manda una base vacía por accidente, los anteriores siguen ahí — que es justo el escenario que se cubre. Por eso la validación del servidor acepta un snapshot con `sessions: 0`: es un estado legítimo tras un reset, y la protección contra el caso indeseado es el append-only, no la validación. **Nota:** la retención ("conservar los últimos 50 y el más reciente de cada día") quedó SIN implementar en este alcance, porque borrar snapshots contradice el append-only y el "no borrar" explícito del prompt; se difiere hasta que el volumen lo pida, y borrar la copia de seguridad es justo el riesgo que este diseño evita.

**Modelo de auth — proporcional, no fuerte.** Sin auth de usuario, el endpoint queda abierto a que cualquiera escriba. La barrera es un token en variable de entorno (`BACKUP_TOKEN`), comparado en cada ruta en tiempo constante. El cliente lo lleva embebido en el bundle (`NEXT_PUBLIC_BACKUP_TOKEN`), a la vista de quien inspeccione el JavaScript. Esto **no** protege de alguien que mire el bundle: protege de escrituras casuales de terceros. Es proporcional — son datos de gimnasio de una persona. Documentarlo como lo que es evita creer que es más. (Se exige el token también en las lecturas: la misma barrera débil, pero no se expone el histórico entero en abierto.)

**Lo que no cambia.** Sin `version(3)` de Dexie. El export/import a archivo sigue existiendo tal cual — es la copia que no depende de que el backend esté vivo. La app prerenderiza estática; solo las rutas `/api/snapshot` son dinámicas (Node runtime, Prisma/Neon).

## 10. Piel — tokens, color y fuentes

Presentación pura: nada de esta sección toca datos, schema, queries ni el veredicto. La base visual pasó a **oscuro fijo** (propuesta v2), pensado para leerse frente a la máquina.

**Fuente única de color.** Las variables semánticas viven solo en `globals.css` (`:root`): `--bg #08090A`, `--surface #1A1C1F`, `--surface-2 #1F2226`, `--border #26292E`, `--border-strong #2E3238`, `--ink #F2F4F3`, `--muted #8B9199`, `--faint #5A6169`, `--accent #C6F24E`, `--accent-ink #0E0F11`, `--danger #FF5C5C`, `--amber #E6B450`. Ningún componente hardcodea un hex. Los nombres shadcn (`--background`, `--card`, `--primary`, `--muted-foreground`…) se conservan como capa de compatibilidad y apuntan a estos tokens, así que recolorear es cambiar valores en un solo lugar, sin tocar el markup. Excepciones justificadas —literales de metadatos de plataforma que no aceptan `var()`: `viewport.themeColor` (layout) y `background_color`/`theme_color` (manifest), fijados en `#08090a` = `--bg`.

**Tema oscuro fijo.** La app no sigue a `prefers-color-scheme`: la paleta vive directa en `:root`, sin bloque `@media`. `color-scheme: dark` para los controles del navegador.

**Reglas de color (fijadas).**

* `--accent` (verde) es el ÚNICO acento: acción primaria, estado de sesión activa, y prompts de completar.
* **Veredictos.** "mejor" NO usa el verde de acento —colisionaría con acción/marca y vestiría un dato de botón—: tratamiento propio, **tinta plena** con su flecha (↑). "igual" y "peor" en **atenuado**; "peor" lleva flecha (↓) pero **nunca es rojo**. La dirección la carga la flecha, no el color. Nada de ámbar en un veredicto.
* `--danger` (rojo): solo destructivo (descartar, eliminar, el estado armado del doble toque) y errores.
* **Ámbar** (`--amber`): reservado a "dato incompleto que puedes arreglar ahora" — hoy, único uso: el indicador de serie con reps y sin peso. Para nada más.

**Fuentes autoalojadas — restricción dura.** `next/font/google` descarga Archivo y DM Mono **en build** y las sirve desde el propio origen (`/_next/static/media/*.woff2`, cacheadas por el service worker como cualquier asset). **Prohibido** el `<link>` a Google Fonts o cualquier CDN en runtime: la app debe abrir con sus fuentes sin señal (D2). Archivo (variable) para UI; DM Mono para numerales y datos (fechas, conteos, pesos, reps, contador).

---

## 11. Capa 2 — lectura de progresión

**Disparador de §8: cumplido.** Mesociclo 1 se registró completo en la app (24 ago → 29 oct, 43 sesiones). Esta sección fija las definiciones **antes** de pintar nada: cada número de capa 2 sale de aquí, y una regla que no está escrita aquí no se implementa.

La pregunta que responde es una: **¿estoy progresando, en qué, y desde cuándo no?** Hasta ahora contestarla exigía exportar la base y analizarla fuera de la app.

**Lo que no cambia.** Nada se almacena (§3.5): todo se deriva en lectura desde `getPerformanceHistory`. Sin `version(4)`, sin migración. El veredicto por aparición (`compareAppearances`) y su neto por sesión siguen tal cual; capa 2 los reusa donde aplican y no los redefine.

### 11.1 Marca de una aparición

Un número por aparición de un ejercicio, para compararla contra **meses** de historial, no solo contra la anterior. Es una medida aparte del veredicto, y la razón es concreta: el veredicto compara reps totales a igual peso, lo cual sirve entre dos apariciones vecinas (mismo número de series), pero contra el historial completo el número de series varía. `Chest Supported Rows` el 1 oct hizo 170 × 7, 6, 5 (18 reps); el 29 oct, 170 × 8, 6 (14 reps), la mejor serie que ha hecho a ese peso. Por reps totales, el 29 oct quedaría −22% de su "mejor": falso.

**Definición.** Por lado (en unilateral, L y R por separado y luego el promedio de los lados presentes): el **promedio de las dos mejores series**, cada una valorada así:

- **Carga variable** (`KG`, `LB`, `STACK_POSITION`): e1RM de Epley, `peso × (1 + reps/30)`, con el mismo tope de 12 reps del veredicto (`MAX_REPS_E1RM`). Una serie de más de 12 reps no cuenta; una aparición sin ninguna serie ≤ 12 no tiene marca y no se grafica.
- **Carga fija** (`BODYWEIGHT`, y `BODYWEIGHT_PLUS` sin peso corporal, dentro de su carga añadida, §11.2): el factor de Epley sin peso, `1 + reps/30`, **sin tope**. El tope protege estimaciones *entre cargas distintas*; aquí la carga es siempre la misma, así que solo comprime la escala. Se usa el factor y no reps crudas para que una rep pese lo mismo (~3%) en todos los ejercicios: así un solo umbral (§11.4) sirve para todos.

**Por qué las dos mejores y no la mejor serie.** Probado contra los datos reales: con la mejor serie sola, una rep de diferencia ponía `Pull Up` y `Hack Squats` como "bajando", y escondía el progreso de `DB Skull Crushers` (35 lb × 6, 4 → 7, 7: el avance está en la segunda serie). Con todas las series promediadas, dejar de hacer una tercera serie (`Single Arm Cable Push Down`, 3 → 2 desde el 17 oct) subía la marca artificialmente. Dos mejores: robusta a 2 ↔ 3 series e incluye la serie de respaldo.

**La marca nunca se muestra como peso.** Solo da forma a la línea y a los porcentajes. Un "233 lb e1RM" afirmaría que puedes levantar 233 lb una vez, y eso no lo sabemos: es el mismo criterio por el que la "mejor serie registrada" (§3.5) no usa fórmula. Esa tarjeta sigue igual; la marca es otro objeto.

### 11.2 Comparables

Una aparición es **comparable** con la más reciente del ejercicio si comparte:

- La tupla de unidad `(weight_unit, weight_basis, added_unit)` — §3.5, sin conversión (D5).
- La **lateralidad observada** (unilateral si alguna serie lleva lado). Pasar de bilateral a unilateral cambia lo que se mide: `DB OH Triceps Extension` desde el 22 sep.
- En `BODYWEIGHT_PLUS`, **la carga es cuerpo + añadido** cuando hay `BodyweightLog` en la unidad del añadido (D5: no se convierte). Entonces cualquier carga añadida compara, y la marca es la de carga variable (§11.1: e1RM con tope) sobre `peso corporal + añadido`. Cada aparición usa el último registro en o antes de su fecha; **antes del primer registro, el primero**: los registros empiezan el 1 nov (77 kg) y el usuario confirmó el 8 nov que su peso fue estable desde agosto. Un error de 2 kg movería la línea ~1.5%. Con esto, `Weighted Dips` —a +25, +30, +34.5, +35 y +40 kg— pasa de 2 sesiones comparables a toda su historia. La línea lo dice en su leyenda. El veredicto por aparición (§3.5) usa la misma carga: entre añadidos distintos, su e1RM es sobre cuerpo + añadido. Antes era sobre el añadido solo, y +30 × 8 contra +40 × 4 salía "peor" cuando en carga total es "mejor".
- Sin registros en esa unidad, la comparación queda dentro de la **misma carga añadida** (la mayor de la aparición), como antes: +25 kg y +20 kg no tienen denominador común sin el cuerpo (§3.4). Hoy es el caso de `Weighted Decline Crunches`, que registra el añadido en lb — y en un crunch el cuerpo entero tampoco es la carga.

Se excluyen las sesiones con el tag `deload` —por id (`tag-deload`), no por nombre, que es editable— y la sesión activa. Solo series reales (reps > 0), como en toda la cadena de lectura.

Las apariciones no comparables no se grafican pero se cuentan ("2 apariciones con otra carga"), para que el corte se vea en vez de esconderse — el mismo espíritu que la línea de "la unidad cambió aquí" del historial.

### 11.3 Mejor marca

La mayor marca entre las comparables. Su fecha es la de la **primera** aparición que la alcanzó: una marca nueva tiene que superar estrictamente a todas las anteriores; un empate no es mejor marca.

En pantalla se llama **"tu mejor sesión"**, nunca "tu mejor" a secas: en `/ejercicio/[id]` convive con la "mejor serie registrada" (§3.5), que es otra cosa —la serie de mayor peso—. En `Close Grip Bench Press` la mejor serie es 200 × 5 (24 sep) y la mejor sesión es 184 × 11, 7 (4 sep); con el mismo nombre, la pantalla se contradiría.

### 11.4 Estado por ejercicio

Se evalúa en este orden; el primero que aplica gana:

| Estado | Condición | Se muestra |
|---|---|---|
| **Sin registros** | Nunca se hizo | — |
| **Sin registrar** | La aparición más reciente tiene más de **14 días** | "desde 9 oct" |
| **Pocos datos** | Menos de **4** comparables | "3 comparables" |
| **Subiendo** ↑ | Mejor marca en alguna de las **2** últimas comparables | "+22% desde 9 sep": promedio de las 2 últimas vs promedio de las 2 primeras |
| **Por debajo** ↓ | Promedio de las 2 últimas **≤ 97%** de la mejor marca | "−8% vs tu mejor sesión (4 sep)" |
| **Estancado** | Lo demás | "sin mejorar desde 1 sep (8 sem)" |

**Por qué 14 días y 2 apariciones.** Con el split actual cada ejercicio va una vez por semana: dos semanas son dos oportunidades. "Sin registrar" va antes que todo porque un estado calculado sobre datos de hace un mes no describe el presente.

**Por qué 3% y no el 2% del veredicto (`UMBRAL_IGUAL`).** El veredicto compara dos apariciones; aquí la actual se compara contra el **máximo** de muchas, y un máximo está sesgado hacia arriba por el ruido (es el mejor día de N). El margen tiene que ser más ancho. 3% ≈ una rep menos en cada una de las dos series. Con 2%, `DB Bicep Curl` (−2.1%), `Pull Up` (−2.8%) y `Weighted Dips` (−2.9%) serían "por debajo" por una rep.

**Por qué "por debajo" y no "bajando".** El estado dice dónde estás respecto a tu mejor, no la pendiente. `Close Grip Bench Press` está en un nivel más bajo desde finales de septiembre sin seguir cayendo; "bajando" afirmaría una dirección que los datos no muestran.

Los umbrales (14 días, 4 comparables, 2 últimas, 97%) viven como constantes con nombre en un solo lugar, igual que `UMBRAL_IGUAL`.

### 11.5 Semana desde la última pausa

**Pausa:** un hueco de **7 días o más** entre dos sesiones cerradas con series, o una sesión con tag `deload`. El bloque actual empieza en la primera sesión después de la pausa más reciente (o en la primera sesión de todas, si nunca hubo pausa). Se muestra "semana N" = semanas completas transcurridas + 1, la misma regla que la semana del mesociclo (§3.6). Al 29 oct: semana 6, desde el 21 sep.

Es un **hecho, no un consejo.** La app no sugiere descargar, igual que no sugiere qué día toca (§7.5): muestra "semana 6 desde la última pausa · 6 ejercicios por debajo" y la decisión es tuya.

### 11.6 Balance semanal

Por semana de lunes a domingo, la suma de los netos de sesión (`mejor − peor`, §3.5, `netFromVerdicts`). Es la misma regla de los badges del historial sumada por semana: no hay segunda regla. Las semanas sin sesiones se ven como hueco, no como cero; las semanas con alguna sesión `deload` se marcan.

### 11.7 Dónde vive

- **`/progreso`**, una cuarta pestaña en la barra (Inicio · Historial · Progreso · Ajustes). La lectura es el valor de la app (§1), así que no va escondida dentro de otra sección. Arriba: mesociclo activo y semana desde la pausa. Luego, el balance de las últimas 8 semanas. Luego, los ejercicios del mesociclo activo (slots activos, el ejercicio del slot, no sus alternativas) agrupados por estado, cada fila enlazada a `/ejercicio/[id]`.
- **`/ejercicio/[id]`**: la línea de marcas de las comparables, con la mejor marca señalada, y la línea de estado de §11.4.
- **Visual.** SVG a mano, sin librería de gráficas. §10 manda: la línea en tinta, nada de acento ni rojo. "Subiendo" en tinta plena con ↑; "estancado" y "por debajo" atenuados, "por debajo" con ↓. La dirección la carga la flecha, no el color.

### 11.8 Fuera de esta entrega

Con su disparador en BACKLOG: balance por lado (hoy L y R coinciden en 57 de 58 pares de series: no hay señal que mostrar). Dos que estaban aquí se construyeron después: comparar `BODYWEIGHT_PLUS` entre cargas con el peso corporal (§11.2, al llegar a 4 registros) y el volumen por grupo muscular (§12).

---

## 12. Capa 2 — volumen por grupo muscular

**Disparador (BACKLOG): cumplido el 8 nov.** La pregunta pasó de "¿progresa este ejercicio?" a "¿este músculo recibe poco o mucho trabajo?", y §11 no la contesta: un ejercicio puede ir subiendo con dos series por semana.

**Lo que no cambia.** Nada derivado se almacena (§3.5): el volumen se cuenta en lectura, cada vez. Lo único nuevo en el esquema es la clasificación de cada ejercicio (§12.5), que no es derivada: no hay de dónde calcularla.

### 12.1 Qué se cuenta: series, no tonelaje

**Unidad: series por semana.** El tonelaje (peso × reps) no se puede sumar en esta base: kg y lb no se convierten (D5), `BODYWEIGHT` no tiene peso, `BODYWEIGHT_PLUS` registra solo el añadido y `STACK_POSITION` "no entra en volumen total" (§3.1). Una serie es la misma cosa en cualquier unidad, y es la medida con la que se estudia el volumen para hipertrofia.

**Serie** = un `set_index` distinto con reps > 0 dentro de una aparición. De ahí:

- Un giant set es **una** serie (§3.2: "no son 6 series").
- L y R con el mismo índice son **una** serie: cada lado recibió una.
- Una serie extra cuenta: es trabajo hecho.
- Solo sesiones cerradas: la activa contaría una semana a medias.
- Un ejercicio dado de baja cuenta: su trabajo ocurrió.

### 12.2 Grupos y roles

Once grupos: **Pecho, Espalda, Hombros, Bíceps, Tríceps, Antebrazo, Cuádriceps, Isquiotibiales, Glúteos, Pantorrillas, Abdomen.** Gruesos a propósito: el registro no distingue deltoides anterior de lateral ni dorsal de trapecio, y una división más fina pediría clasificaciones que nadie puede verificar desde los datos.

Cada ejercicio marca, por grupo, **directo**, **indirecto** o nada. Una serie cuenta **1** para cada grupo directo y **½** para cada indirecto. Sin el indirecto, el press inclinado no sumaría nada al tríceps ni la dominada al bíceps, y el brazo saldría subcontado. Con 1 completo, un press contaría como trabajo de tríceps lo mismo que un press francés. El ½ es el conteo fraccional del meta-análisis de dosis-respuesta de volumen de Pelland et al. (2024): la mejor referencia disponible, no una verdad.

La clasificación vive en `Exercise.grupos`, un objeto grupo → rol, para que un grupo no pueda ser directo e indirecto a la vez. **No se snapshotea:** es una clasificación, no una medida. Corregirla recalcula el volumen de todo el historial, que es lo que se quiere, igual que `laterality_default`. Se edita en el catálogo (al crear y en cada fila), sin candado: el candado de unidad protege snapshots y aquí no hay ninguno.

### 12.3 Semana típica

Semanas de lunes a domingo (§11.6). La **semana típica** de un grupo es el promedio de sus series ponderadas en las **4** últimas semanas **completas** (la actual no entra) que tengan al menos una sesión y **ninguna sesión `deload`** (por id, §11.2). Una semana vacía es una pausa y una de descarga es volumen recortado a propósito: ninguna describe una semana normal. Al 8 nov: semanas del 5, 12, 19 y 26 oct (en pantalla, "4 semanas (5 oct – 1 nov)").

Se muestra redondeada a media serie, que es la resolución real del conteo.

### 12.4 Dónde vive y qué muestra

En `/progreso`, después del balance semanal. Una tarjeta "Volumen por grupo muscular":

- Los once grupos, **de mayor a menor semana típica**. Cada uno con una barra partida en directo (tinta) e indirecto ya ponderado (atenuado), y el número. §10 manda: nada de acento ni rojo.
- Al tocar un grupo: la tira de sus últimas 8 semanas (la del balance: hueco = sin sesiones, "desc." = descarga) y los ejercicios que suman, con su rol.
- **Sin rango de referencia.** Solo tus números. Un "10–20 series" sería un consejo, y la app no los da (§11.5, §7.5). Lo poco se ve por posición: queda al fondo de la lista.
- **Lo que no se cuenta se dice.** Los ejercicios sin grupo con series en la tira se listan aparte, con enlace al catálogo, para que un hueco en el volumen no parezca un músculo sin trabajo.

Al 8 nov: Tríceps 11.5 · Bíceps 10.5 · Hombros 8.5 · Espalda 6.5 · Pecho 6 · Antebrazo 5 · Cuádriceps 4 · Abdomen 4 · Isquiotibiales 2 · Pantorrillas 1.5 · Glúteos 1. Sin grupo: `Forearm Cable Curl` y `DB Preacher Curl`, creados en la app.

### 12.5 Esquema: `version(4)`

`Exercise.grupos`, **no indexado**. El bump no es por un índice —`creado_en` (§3.2) se ahorró uno justamente por eso— sino por el **relleno**: una base existente necesita la clasificación de sus ejercicios semilla, y el lugar legítimo para escribir una vez sobre filas existentes es un `upgrade`. La migración pone `GRUPOS_SEMILLA` (§12.6) por id; los ejercicios creados por el usuario quedan vacíos, porque no hay de dónde derivarlos. Una instalación fresca nace con la misma tabla. Editarla después del deploy solo llega a instalaciones nuevas: una base ya migrada se corrige en el catálogo.

**Costo, el mismo de v3:** tras el deploy, los respaldos y snapshots con `schema_version 3` dejan de restaurarse (§6: no se migra durante un restore). Protocolo §6: export manual → desplegar → abrir la app → verificar conteos contra el export → cerrar una sesión, que sube el primer snapshot v4.

### 12.6 Clasificación semilla

Propuesta, no observada: se corrige en el catálogo.

| Ejercicios | Directo | Indirecto |
|---|---|---|
| Incline Bench Press (Medium y Wide), Incline DB Press, Weighted Dips | Pecho | Hombros, Tríceps |
| Close Grip Bench Press | Tríceps | Pecho, Hombros |
| Pull Up, Pull Down, Wide Grip Pull Down, Wide Grip Pull Up, Chest Supported Rows | Espalda | Bíceps |
| Barbell Bicep Curls, EZ Bar Curl, DB Bicep Curl, Cable Curl, Single Arm Cable Curl, Concentration Hammer Curls | Bíceps | Antebrazo |
| DB Skull Crushers, DB OH Triceps Extension, Single Arm Cable Push Down | Tríceps | — |
| DB Lateral Raises, Cable Lateral Raises | Hombros | — |
| Barbell Standing Wrist Curl, Forearm Curls | Antebrazo | — |
| Squats, Hack Squats, Matrix Hack Squats | Cuádriceps | Glúteos |
| Leg Extensions | Cuádriceps | — |
| Leg Curl, Lying Leg Curl | Isquiotibiales | — |
| Calf Raises | Pantorrillas | — |
| Hanging Leg Raises, Weighted Decline Crunches | Abdomen | — |

---

## 13. Slices despachados por un orquestador (SAYA-TIER1-1, 2026-11-08)

Desde ahora los cambios de la reestructura (login y rediseño) llegan por slices
que un orquestador despacha, revisa y mergea a `pasada/reestructura`.
`CLAUDE.md` (nuevo en este commit) es donde viven las reglas para esos slices:
identidad de git, entornos, flujo de ramas, reglas de dominio transversales y qué
corre y qué no corre un worker despachado.

**Tier 1.** Un subconjunto de rutas —esquema y modelo, respaldo y restauración, lo
que escribe al arrancar, actualización y offline— corre en dos etapas: una sesión
de solo lectura primero, y una segunda que escribe solo tras el visto bueno. El
orquestador la lee de una sola frase en `CLAUDE.md` (empieza con "Tier 1 slices run
in", para que la parsee una máquina); la decide Edgar, no un slice.

**Medición de qué escribe hoy sobre el eje** (`prisma`/`tx`.`snapshot`/`user`/
`session`/`account`/`verification`/`passkey`.`create`/`update`/`delete`/`upsert`/
`createMany`/`updateMany`/`deleteMany`, o un bloque `.version(n)`):

    grep -rlE "(prisma|tx)\.(snapshot|user|session|account|verification|passkey)\.(create|update|delete|upsert|createMany|updateMany|deleteMany)|\.version\([0-9]+\)" src prisma | sort

Dio dos archivos, ambos cubiertos por la frase de Tier 1 de `CLAUDE.md`:
`src/app/api/snapshot/route.ts` (dentro de `src/app/api/snapshot/`) y
`src/lib/db/db.ts` (nombrado directo).
