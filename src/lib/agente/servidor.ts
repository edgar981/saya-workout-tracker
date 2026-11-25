/**
 * Las filas de Dinero y Tiempo que el agente lee de Postgres (SAYA-AGENTE-DATOS-1).
 * Puro: sólo tipos de los módulos del servidor, sin base ni reloj. Filtra por el
 * periodo de la pregunta y nunca deja salir `ultimos4`, ids ni marcas de tiempo.
 */
import type { FilaServidor } from "@/lib/agente/contrato";
import type { Periodo } from "@/lib/agente/filas";
import type { AlmacenDinero } from "@/lib/dinero/servidor";
import type { AlmacenTiempo } from "@/lib/tiempo/servidor";

export const MAX_FILAS_SERVIDOR = 400;

export type DatosServidor = {
  dinero: Awaited<ReturnType<AlmacenDinero["todo"]>>;
  tiempo: Awaited<ReturnType<AlmacenTiempo["todo"]>>;
};

const dia = (d: Date): string => d.toISOString().slice(0, 10);
const nulo = (v: bigint | null): number | null => (v === null ? null : Number(v));

/** Un saldo/extracto con su fecha ya calculada, en el orden en que llegó. */
type Fechado<T> = { fecha: string; x: T };

/** Los de fecha dentro del periodo (extremos incluidos) más el último anterior a `desde`. */
function delPeriodo<T>(lista: Fechado<T>[], p: Periodo): Fechado<T>[] {
  const antes = lista.filter((f) => f.fecha < p.desde);
  const dentro = lista.filter((f) => f.fecha >= p.desde && f.fecha <= p.hasta);
  return [...antes.slice(-1), ...dentro];
}

function agrupar<T>(items: T[], clave: (t: T) => string): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const t of items) {
    const k = clave(t);
    const l = m.get(k);
    if (l) l.push(t);
    else m.set(k, [t]);
  }
  return m;
}

export function filasDelServidor(
  datos: DatosServidor,
  periodo: Periodo,
  desfase: number,
): FilaServidor[] {
  const salida: FilaServidor[] = [];
  const local = (anotado: Date) => dia(new Date(anotado.getTime() - desfase * 60000));
  const porAnotado = <T extends { anotado_en: Date }>(l: T[]) =>
    [...l].sort((a, b) => a.anotado_en.getTime() - b.anotado_en.getTime());

  // 1. cuentas
  const cuentas = [...datos.dinero.cuentas].sort(
    (a, b) => a.creada_en.getTime() - b.creada_en.getTime(),
  );
  cuentas.forEach((c, i) =>
    salida.push({ tipo: "cuenta", n: i + 1, banco: c.banco, clase: c.tipo }),
  );

  // 2. saldos de cuenta
  const saldosC = agrupar(porAnotado(datos.dinero.saldosCuentas), (s) => s.cuenta_id);
  cuentas.forEach((c, i) => {
    const lista = (saldosC.get(c.id) ?? []).map((s) => ({ fecha: local(s.anotado_en), x: s }));
    for (const f of delPeriodo(lista, periodo)) {
      salida.push({ tipo: "saldo_cuenta", cuenta: i + 1, fecha: f.fecha, valor: Number(f.x.valor) });
    }
  });

  // 3. deudas
  const deudas = [...datos.dinero.deudas].sort(
    (a, b) => a.creada_en.getTime() - b.creada_en.getTime(),
  );
  deudas.forEach((d, i) =>
    salida.push({
      tipo: "deuda",
      n: i + 1,
      clase: d.tipo,
      nombre: d.nombre,
      con_quien: d.con_quien,
      tasa_ea: d.tasa_ea,
      cuota: nulo(d.cuota),
      cupo: nulo(d.cupo),
      monto_inicial: nulo(d.monto_inicial),
      cuotas_total: d.cuotas_total,
      dia_pago: d.dia_pago,
      primera_cuota: d.primera_cuota === null ? null : dia(d.primera_cuota),
    }),
  );

  // 4. saldos de deuda
  const saldosD = agrupar(porAnotado(datos.dinero.saldosDeudas), (s) => s.deuda_id);
  deudas.forEach((d, i) => {
    const lista = (saldosD.get(d.id) ?? []).map((s) => ({ fecha: local(s.anotado_en), x: s }));
    for (const f of delPeriodo(lista, periodo)) {
      salida.push({ tipo: "saldo_deuda", deuda: i + 1, fecha: f.fecha, valor: Number(f.x.valor) });
    }
  });

  // 5. extractos: uno por cierre (el de `anotado_en` más reciente), por cierre ascendente
  const extractos = agrupar(datos.dinero.extractos, (e) => e.deuda_id);
  deudas.forEach((d, i) => {
    const unicos = new Map<string, (typeof datos.dinero.extractos)[number]>();
    for (const e of extractos.get(d.id) ?? []) {
      const k = dia(e.cierre);
      const previo = unicos.get(k);
      if (!previo || e.anotado_en.getTime() >= previo.anotado_en.getTime()) unicos.set(k, e);
    }
    const lista = [...unicos.values()]
      .sort((a, b) => a.cierre.getTime() - b.cierre.getTime())
      .map((e) => ({ fecha: dia(e.cierre), x: e }));
    for (const f of delPeriodo(lista, periodo)) {
      salida.push({
        tipo: "extracto",
        deuda: i + 1,
        cierre: f.fecha,
        intereses: Number(f.x.intereses),
        pago_minimo: nulo(f.x.pago_minimo),
        fecha_limite: f.x.fecha_limite === null ? null : dia(f.x.fecha_limite),
      });
    }
  });

  // 6. temas
  const temas = [...datos.tiempo.temas].sort((a, b) =>
    a.nombre < b.nombre ? -1 : a.nombre > b.nombre ? 1 : 0,
  );
  for (const t of temas) salida.push({ tipo: "tema", nombre: t.nombre });

  // 7. tiempo
  const nombres = new Map(datos.tiempo.temas.map((t) => [t.id, t.nombre]));
  const registros = datos.tiempo.registros
    .filter((r) => dia(r.fecha) >= periodo.desde && dia(r.fecha) <= periodo.hasta)
    .sort(
      (a, b) =>
        a.fecha.getTime() - b.fecha.getTime() || a.anotado_en.getTime() - b.anotado_en.getTime(),
    );
  for (const r of registros) {
    const tema = nombres.get(r.tema_id);
    if (tema === undefined) continue;
    salida.push({ tipo: "tiempo", fecha: dia(r.fecha), tema, minutos: r.minutos });
  }

  return salida;
}
