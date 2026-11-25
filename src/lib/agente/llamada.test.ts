import { describe, expect, it } from "vitest";
import { ESQUEMA_RESPUESTA, MAX_CUERPO_BYTES, MAX_PREGUNTA, type PedidoAgente } from "./contrato";
import { INSTRUCCIONES } from "./instrucciones";
import type { DatosServidor } from "./servidor";
import {
  URL_MENSAJES,
  VERSION_API,
  atenderPedido,
  cuerpoDeLlamada,
  pedirRespuesta,
  type Fetch,
} from "./llamada";

const CLAVE = "clave-de-prueba";
const pedido: PedidoAgente = {
  pregunta: "¿Cuántas series hoy?",
  hoy: "2026-03-10",
  filas: [{ tipo: "peso", fecha: "2026-03-09", valor: 78.4, unidad: "KG" }],
};
const maqueta = {
  estado: "respuesta",
  cifra: "6",
  unidad: "series",
  desglose: [
    { etiqueta: "Incline Bench Press Wide Grip", valor: "3" },
    { etiqueta: "Weighted Dips", valor: "3" },
  ],
};

type Llamada = { url: string; init: RequestInit };
function falso(respuesta: () => Response | Promise<Response>) {
  const llamadas: Llamada[] = [];
  const fetch: Fetch = async (url, init) => {
    llamadas.push({ url, init });
    return respuesta();
  };
  return { fetch, llamadas };
}
const mensaje = (content: unknown[], extra: Record<string, unknown> = {}) =>
  Response.json({ type: "message", role: "assistant", stop_reason: "end_turn", content, ...extra });
const texto = (o: unknown) => ({ type: "text", text: typeof o === "string" ? o : JSON.stringify(o) });

const PERIODO = { desde: "2026-03-01", hasta: "2026-03-10" };
const vacios: DatosServidor = {
  dinero: { cuentas: [], saldosCuentas: [], deudas: [], saldosDeudas: [], extractos: [] },
  tiempo: { temas: [], registros: [] },
};
const leerVacio = async () => vacios;
const conExtracto: DatosServidor = {
  ...vacios,
  dinero: {
    ...vacios.dinero,
    deudas: [
      {
        id: "d1", tipo: "tarjeta", nombre: "Visa", con_quien: "Banco", tasa_ea: null, cuota: null,
        cupo: null, monto_inicial: null, ultimos4: "4821", cuotas_total: null, dia_pago: null,
        primera_cuota: null, creada_en: new Date("2026-01-01T00:00:00Z"),
      },
    ],
    extractos: [
      {
        id: "e1", deuda_id: "d1", cierre: new Date("2026-03-05T00:00:00Z"), intereses: BigInt(1234),
        pago_minimo: null, fecha_limite: null, anotado_en: new Date("2026-03-06T00:00:00Z"),
      },
    ],
  },
};

describe("cuerpoDeLlamada", () => {
  const c = cuerpoDeLlamada("modelo-x", pedido, { periodo: PERIODO, filas: [] }) as Record<string, unknown>;
  it("sólo las claves previstas", () => {
    expect(Object.keys(c).sort()).toEqual(["max_tokens", "messages", "model", "output_config", "system"]);
    expect(c.model).toBe("modelo-x");
    expect(c.system).toBe(INSTRUCCIONES);
  });
  it("esfuerzo low y salida estructurada con el esquema", () => {
    expect(c.output_config).toEqual({
      effort: "low",
      format: { type: "json_schema", schema: ESQUEMA_RESPUESTA },
    });
  });
  it("un solo mensaje de usuario con hoy, periodo, pregunta y filas", () => {
    const m = c.messages as { role: string; content: string }[];
    expect(m).toHaveLength(1);
    expect(m[0].role).toBe("user");
    expect(JSON.parse(m[0].content)).toEqual({
      hoy: pedido.hoy,
      periodo: PERIODO,
      pregunta: pedido.pregunta,
      filas: pedido.filas,
    });
  });
  it("las filas del servidor van después de las de Cuerpo, y desfase no va", () => {
    const extra = { periodo: PERIODO, filas: [{ tipo: "tema" as const, nombre: "Inglés" }] };
    const r = cuerpoDeLlamada("m", { ...pedido, desfase: 300 }, extra);
    const m = r.messages as { content: string }[];
    const o = JSON.parse(m[0].content);
    expect(o.filas).toEqual([...pedido.filas, { tipo: "tema", nombre: "Inglés" }]);
    expect(m[0].content).not.toContain("desfase");
  });
});

describe("pedirRespuesta", () => {
  const llamar = (f: Fetch) =>
    pedirRespuesta({ clave: CLAVE, modelo: "m", pedido, periodo: PERIODO, filas: [], fetch: f });

  it("manda POST a la URL con los tres encabezados y signal", async () => {
    const { fetch, llamadas } = falso(() => mensaje([texto(maqueta)]));
    await llamar(fetch);
    expect(llamadas).toHaveLength(1);
    expect(llamadas[0].url).toBe(URL_MENSAJES);
    expect(llamadas[0].init.method).toBe("POST");
    expect(llamadas[0].init.headers).toEqual({
      "content-type": "application/json",
      "x-api-key": CLAVE,
      "anthropic-version": VERSION_API,
    });
    expect(llamadas[0].init.signal).toBeInstanceOf(AbortSignal);
  });
  it("salta bloques thinking y lee el texto", async () => {
    const { fetch } = falso(() => mensaje([{ type: "thinking", thinking: "..." }, texto(maqueta)]));
    expect(await llamar(fetch)).toEqual({ ok: true, respuesta: maqueta });
  });
  it("refusal → rechazo; max_tokens → corte", async () => {
    expect(await llamar(falso(() => mensaje([], { stop_reason: "refusal" })).fetch)).toEqual({ ok: false, motivo: "rechazo" });
    expect(await llamar(falso(() => mensaje([texto("{")], { stop_reason: "max_tokens" })).fetch)).toEqual({ ok: false, motivo: "corte" });
  });
  it("estado no 2xx → api, sin reintento", async () => {
    const { fetch, llamadas } = falso(() => new Response("{}", { status: 529 }));
    expect(await llamar(fetch)).toEqual({ ok: false, motivo: "api" });
    expect(llamadas).toHaveLength(1);
  });
  it("fetch que lanza → red", async () => {
    const f: Fetch = async () => {
      throw new Error("sin red");
    };
    expect(await llamar(f)).toEqual({ ok: false, motivo: "red" });
  });
  it("texto que no es JSON o con otra forma → forma", async () => {
    expect(await llamar(falso(() => mensaje([texto("hola")])).fetch)).toEqual({ ok: false, motivo: "forma" });
    expect(await llamar(falso(() => mensaje([texto({ estado: "otro" })])).fetch)).toEqual({ ok: false, motivo: "forma" });
    expect(await llamar(falso(() => mensaje([])).fetch)).toEqual({ ok: false, motivo: "forma" });
  });
});

describe("atenderPedido", () => {
  const valido = JSON.stringify(pedido);
  const base = { modelo: "m", texto: valido, leer: leerVacio };
  const sinFilas = JSON.stringify({ ...pedido, filas: [] });

  it("sin clave → 503 y no llama ni lee", async () => {
    for (const clave of [undefined, ""]) {
      const { fetch, llamadas } = falso(() => mensaje([texto(maqueta)]));
      let lecturas = 0;
      const leer = async () => {
        lecturas += 1;
        return vacios;
      };
      const r = await atenderPedido({ ...base, leer, clave, fetch });
      expect(r).toEqual({ status: 503, cuerpo: { error: "Sin llave." } });
      expect(llamadas).toHaveLength(0);
      expect(lecturas).toBe(0);
    }
  });
  it("leer que lanza → 503 «No se pudo leer.» sin llamar al modelo", async () => {
    const { fetch, llamadas } = falso(() => mensaje([texto(maqueta)]));
    const leer = async (): Promise<DatosServidor> => {
      throw new Error("base caída");
    };
    const r = await atenderPedido({ ...base, leer, clave: CLAVE, fetch });
    expect(r).toEqual({ status: 503, cuerpo: { error: "No se pudo leer." } });
    expect(llamadas).toHaveLength(0);
  });
  it("401 filas del servidor → 413 sin llamar", async () => {
    const { fetch, llamadas } = falso(() => mensaje([texto(maqueta)]));
    const muchos: DatosServidor = {
      ...vacios,
      tiempo: { temas: Array.from({ length: 401 }, (_, i) => ({ id: `t${i}`, nombre: `T${i}`, creado_en: new Date(0) })), registros: [] },
    };
    const r = await atenderPedido({ ...base, leer: async () => muchos, clave: CLAVE, fetch });
    expect(r).toEqual({ status: 413, cuerpo: { error: "Demasiadas filas." } });
    expect(llamadas).toHaveLength(0);
  });
  it("sin filas de Cuerpo ni del servidor → 200 sin_datos sin llamar", async () => {
    const { fetch, llamadas } = falso(() => mensaje([texto(maqueta)]));
    const r = await atenderPedido({ ...base, texto: sinFilas, clave: CLAVE, fetch });
    expect(r).toEqual({ status: 200, cuerpo: { estado: "sin_datos" } });
    expect(llamadas).toHaveLength(0);
  });
  it("sin filas de Cuerpo pero con un extracto → llama con periodo y extracto, sin desfase", async () => {
    const { fetch, llamadas } = falso(() => mensaje([texto(maqueta)]));
    const texto2 = JSON.stringify({ ...pedido, filas: [], desfase: 300 });
    const r = await atenderPedido({ ...base, texto: texto2, leer: async () => conExtracto, clave: CLAVE, fetch });
    expect(r.status).toBe(200);
    expect(llamadas).toHaveLength(1);
    const cuerpo = JSON.parse(String(llamadas[0].init.body));
    const contenido = cuerpo.messages[0].content as string;
    const o = JSON.parse(contenido);
    expect(o.periodo).toEqual({ desde: "2026-03-10", hasta: "2026-03-10" });
    expect(o.filas.some((f: { tipo: string; intereses?: number }) => f.tipo === "extracto" && f.intereses === 1234)).toBe(true);
    expect(contenido).not.toContain("desfase");
    expect(contenido).not.toContain("4821");
  });
  it("cuerpo de MAX_CUERPO_BYTES + 1 bytes → 413 sin llamar", async () => {
    const { fetch, llamadas } = falso(() => mensaje([texto(maqueta)]));
    const r = await atenderPedido({ clave: CLAVE, modelo: "m", texto: "a".repeat(MAX_CUERPO_BYTES + 1), fetch, leer: leerVacio });
    expect(r.status).toBe(413);
    expect(llamadas).toHaveLength(0);
  });
  it("cuerpo de MAX_CUERPO_BYTES / 2 + 1 caracteres de dos bytes → 413 sin llamar", async () => {
    const { fetch, llamadas } = falso(() => mensaje([texto(maqueta)]));
    const r = await atenderPedido({ clave: CLAVE, modelo: "m", texto: "ñ".repeat(MAX_CUERPO_BYTES / 2 + 1), fetch, leer: leerVacio });
    expect(r.status).toBe(413);
    expect(llamadas).toHaveLength(0);
  });
  it("JSON roto → 400 sin llamar", async () => {
    const { fetch, llamadas } = falso(() => mensaje([texto(maqueta)]));
    const r = await atenderPedido({ clave: CLAVE, modelo: "m", texto: "{", fetch, leer: leerVacio});
    expect(r).toEqual({ status: 400, cuerpo: { error: "El cuerpo no es JSON válido." } });
    expect(llamadas).toHaveLength(0);
  });
  it("pregunta demasiado larga → 400 sin llamar", async () => {
    const { fetch, llamadas } = falso(() => mensaje([texto(maqueta)]));
    const largo = JSON.stringify({ ...pedido, pregunta: "a".repeat(MAX_PREGUNTA + 1) });
    const r = await atenderPedido({ clave: CLAVE, modelo: "m", texto: largo, fetch, leer: leerVacio});
    expect(r.status).toBe(400);
    expect(llamadas).toHaveLength(0);
  });
  it("falla del modelo → 502", async () => {
    const { fetch } = falso(() => new Response("{}", { status: 500 }));
    const r = await atenderPedido({ ...base, clave: CLAVE, fetch });
    expect(r).toEqual({ status: 502, cuerpo: { error: "No se pudo responder." } });
  });
  it("un consejo nunca llega: 502", async () => {
    const aconseja = { ...maqueta, desglose: [{ etiqueta: "Deberías descansar", valor: "3" }] };
    const { fetch } = falso(() => mensaje([texto(aconseja)]));
    const r = await atenderPedido({ ...base, clave: CLAVE, fetch });
    expect(r.status).toBe(502);
  });
  it("la respuesta de la maqueta → 200", async () => {
    const { fetch, llamadas } = falso(() => mensaje([texto(maqueta)]));
    const r = await atenderPedido({ ...base, clave: CLAVE, fetch });
    expect(r).toEqual({ status: 200, cuerpo: maqueta });
    expect(llamadas).toHaveLength(1);
  });
});
