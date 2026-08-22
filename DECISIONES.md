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

Tres casos que este modelo resuelve y el ingenuo no:

1. **Giant set** = una serie con N segmentos. `1 giant set x 70 reps → 16+15+11+8+10+9` es `set_index=1`, `segment_index=0..5`. No son 6 series.
2. **Asimetría** `6L/7R` = dos filas, mismo `set_index`, `side=L` y `side=R`.
3. **Serie extra unilateral** `4L` = `es_extra=true`, `side=L`. Requiere que la UI permita agregar series con lado, no solo repetir la plantilla.

**Efecto secundario gratuito:** el volumen acumulado por lado queda registrado sin trabajo adicional. La vista que lo muestre es capa 2.

### 3.3 Contexto

**`SessionTag`** — chips predefinidos, editables por el usuario.
**`SessionTagLink`** — many-to-many con `Session`.

Semilla inicial: `dormí mal`, `deload`, `máquina distinta`, `molestia`, `sin tiempo`, `bajó la fuerza`.
[Guessing] — sale de una sola anotación en cinco días de datos. Los chips reales emergen del uso: si terminas escribiendo lo mismo a mano tres veces, se vuelve chip.

### 3.4 Peso corporal

**`BodyweightLog`**: `fecha`, `valor`, `unidad`.

Sin esto, `+25kg` en dominadas no tiene denominador y la progresión en `BODYWEIGHT_PLUS` es no interpretable. No hay UI dedicada en capa 1: un campo opcional en el cierre de sesión.

### 3.5 Estado derivado

Nada calculado se almacena. e1RM, volumen y tendencias se derivan en lectura. Regla de comparación: **solo dentro de la misma tupla `(exercise_id, weight_unit, weight_basis)`**. Si cambia la unidad, la serie histórica se corta visualmente en lugar de convertirse.

Esta regla es la que absorbe la inconsistencia de §7.1: `Incline DB Press` en `TOTAL` y `DB Skull Crushers` en `PER_IMPLEMENT` nunca se comparan entre sí, así que la mezcla no produce lecturas falsas. Solo hay que no romper la base *dentro* de un mismo ejercicio.

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
| DB OH Triceps Extension | `LB` | PI | BIL |
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
