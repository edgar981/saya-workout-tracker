# Backlog — Workout Tracker

Cada item lleva su **disparador**: la condición concreta que lo vuelve necesario.
Nada se hace "por si acaso". Si surge un pendiente nuevo, se escribe aquí con su
disparador — no en el chat, que es exactamente lo frágil que este proyecto evita.

Autoridad sobre schema y alcance: `DECISIONES.md`.

---

## Disparador cumplido — en curso

Trabajado en el prompt de captura de peso unilateral (2026-08-28):

- **Hueco de captura: series unilaterales sin peso.** Disparador: el diagnóstico
  de §3 encontró `weight_value` null en un lado de `Single Arm Cable Push Down`;
  el usuario confirmó que fue olvido. → (a) "Serie" unilateral ahora crea un solo
  lado y el opuesto se agrega heredando el peso; (b) indicador en `/sesion` de
  serie con reps y sin peso (nunca en historial, nunca en `BODYWEIGHT`); (c) el
  render toma el peso del primer lado con valor, no de `rows[0]`. Los nulls ya
  escritos se quedan: son historia, no se reparan.
- Con (c) queda **resuelto** el "Fix de §3" que estaba pendiente abajo.

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

## Artefactos conocidos — no se tocan

- **`Cable Lateral Raises`, 2026-08-28.** Dos series registradas con
  `segment_index 0/1` como sustituto de lados, antes de que el ejercicio fuera
  `UNILATERAL`. **No se convierten**: dos filas de una sola sesión no justifican un
  script de mutación sobre la única copia de los datos. De aquí en adelante se
  registran como lados. La **fase 2 de conversión de segmentos queda CANCELADA**.

---

## Disparador escrito, no cumplido

- **Propagación de peso vs creación secuencial en unilaterales.**
  Disparador: si el flujo de dos taps ("Serie" crea el lado L, "Agregar lado
  opuesto" crea el R) molesta tras una sesión real de Day 5. Alternativa: volver
  a crear ambos lados juntos y propagar el peso al escribirlo en un lado hacia el
  opuesto vacío. Es una decisión de UX que solo se puede juzgar usándolo frente a
  la máquina — esperar a esa sesión antes de cambiar nada.

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

- **Giant sets sin uso — revisar si la función sobra.**
  Disparador: al entrar a capa 2. El diagnóstico de segmentos encontró 2 filas con
  `segment_index > 0` en toda la base, ninguna un giant set real, pese a que el
  archivo de Notes original sí los tenía (wrist curls, forearm curls). Si al llegar
  a capa 2 sigue sin usarse, evaluar si `addSegment` y el render de giant sets
  sobran.

- **Capa 2: progresión, e1RM, volumen por grupo muscular, balance por lado.**
  Disparador: registrar un mesociclo completo sin volver a Notes (criterio de
  validación de `DECISIONES.md` §8). Se decide aparte cuando el disparador se
  cumpla — no es un item más de esta lista.
