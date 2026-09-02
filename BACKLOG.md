# Backlog — Workout Tracker

Cada item lleva su **disparador**: la condición concreta que lo vuelve necesario.
Nada se hace "por si acaso". Si surge un pendiente nuevo, se escribe aquí con su
disparador — no en el chat, que es exactamente lo frágil que este proyecto evita.

Autoridad sobre schema y alcance: `DECISIONES.md`.

---

## Disparador cumplido — en curso

Trabajado en el prompt de correcciones y backlog (2026-08-22):

- **Conteo de ejercicios por día en el home ignoraba `activo`** (§1). Disparador: el
  conteo del selector no coincidía con la plantilla real. → Corregido.
- **Volver al ejercicio en curso** (§2). Disparador: al abrir el historial de un
  ejercicio desde la sesión activa y volver, la app caía en `/historial`. → Corregido.
- **Diagnóstico: peso faltante en "ÚLTIMA VEZ" con lados** (§3). Disparador:
  sospecha de que el formateador de `6L / 7R` no imprime el peso. → Diagnosticado:
  el formateador SÍ tiene la rama del peso, pero lo toma de `rows[0]` (el lado
  **L**, que ordena primero). Si el lado L quedó con `weight_value` null, muestra
  `6L/7R × —`. No falta la rama; la fuente es un solo lado. Fix pendiente (abajo).
- **Aviso de versión nueva del service worker** (§5). Disparador: la app está en
  uso real; una versión nueva podía activarse a mitad de entrenamiento. → Corregido.
- **Conversión de Cable Lateral Raises: segmentos → lados** (§4). Disparador: el
  usuario pasa `DB Lateral Raises` y `Cable Lateral Raises` a `UNILATERAL` y los
  datos viejos usan `segment_index` en vez de `side`. → Fase 1 (reporte read-only)
  entregada. **Fase 2 (conversión) pendiente**: ver abajo.

---

## Disparador cumplido — pendiente de ejecutar

- **§4 Fase 2 — convertir segmentos a lados en `Cable Lateral Raises`.**
  Disparador cumplido (el usuario va a poner el ejercicio en `UNILATERAL`).
  Bloqueado por: (1) el usuario confirma el reporte de la fase 1, (2) exporta desde
  `/datos`, (3) decide **cuál `segment_index` es el lado izquierdo** — no se adivina.
  Es un script puntual read-write ejecutable desde `/datos`, **sin `version(3)`**.
  Verificar con `checkIntegrity` antes y después.

---

## Disparador escrito, no cumplido

- **Fix de §3 — peso de "ÚLTIMA VEZ" con lados asimétricos.**
  Disparador: decisión sobre el comportamiento deseado cuando L y R difieren (o
  uno está vacío). Hoy `summarize` en `last-performance.tsx` toma el peso de
  `rows[0]` (lado L). Opciones: tomar el peso del primer lado con valor, o mostrar
  ambos si difieren. Es cambio de una función de presentación, sin tocar datos.

- **Snapshot de `stack_label` (`version(3)`).**
  Disparador: cuando se registre el primer ejercicio `STACK_POSITION`. Hoy ninguno
  lo usa (los stacks del gym están marcados en libras, §7.4). Mientras tanto, el
  render toma `stack_label` de `Exercise`, no del snapshot — inofensivo porque no
  es ni peso ni unidad y no hay filas que dependan de ello.

- **Precarga arrastrando *offset* en vez de valor absoluto.**
  Disparador: la primera vez que se rampee el peso dentro de una misma sesión y la
  precarga por posición proponga un valor que estorbe. Hoy arrastra la desviación
  del valor absoluto; el offset sería más fino pero no hay evidencia de que haga
  falta.

- **Editar sesiones pasadas.**
  Disparador: el primer typo concreto que haya que corregir en una sesión ya
  cerrada. Necesita una guarda contra reescribir en silencio datos que la capa 2
  ya haya leído. Eliminar la sesión completa ya existe; editar in situ no.

- **`getLastPerformance` excluye por sesión, no por instancia.**
  Disparador: si un día un mismo `exercise_id` aparece en dos slots de la misma
  plantilla. Hoy ninguno se repite dentro de un día, así que no se manifiesta.

- **Timer de descanso.**
  Disparador: cuando se pida. Columna aditiva (`rest_seconds` nullable en `SetLog`),
  sin migración dolorosa. [Certain] va a ser lo primero que se quiera; esperar a
  quererlo.

- **Sync a Postgres.**
  Disparador: un segundo dispositivo, o el fin de la validación de 4 semanas. Hoy
  Dexie es la única fuente de verdad y el respaldo es el export/import manual.

- **Capa 2: progresión, e1RM, volumen por grupo muscular, balance por lado.**
  Disparador: registrar un mesociclo completo sin volver a Notes (criterio de
  validación de `DECISIONES.md` §8). Se decide aparte cuando el disparador se
  cumpla — no es un item más de esta lista.
