import { prisma } from "@/lib/prisma";
import type { AlmacenDinero, FilaDeuda } from "@/lib/dinero/servidor";

/**
 * El `AlmacenDinero` sobre Prisma (DECISIONES.md §15): el único archivo que
 * escribe las tablas de Dinero. No atrapa errores: eso lo hace el módulo puro.
 */

const CUENTA = { id: true, banco: true, tipo: true, ultimos4: true, creada_en: true } as const;
const SALDO_CUENTA = { id: true, cuenta_id: true, valor: true, anotado_en: true } as const;
const DEUDA = {
  id: true,
  tipo: true,
  nombre: true,
  con_quien: true,
  tasa_ea: true,
  cuota: true,
  cupo: true,
  monto_inicial: true,
  ultimos4: true,
  cuotas_total: true,
  dia_pago: true,
  primera_cuota: true,
  creada_en: true,
} as const;
const SALDO_DEUDA = { id: true, deuda_id: true, valor: true, anotado_en: true } as const;
const EXTRACTO = {
  id: true,
  deuda_id: true,
  cierre: true,
  intereses: true,
  pago_minimo: true,
  fecha_limite: true,
  anotado_en: true,
} as const;

/** La fila de Prisma lleva `tasa_ea` como `Decimal`; el módulo puro la quiere como número. */
function plana(d: {
  tasa_ea: { toNumber(): number } | null;
} & Omit<FilaDeuda, "tasa_ea">): FilaDeuda {
  return { ...d, tasa_ea: d.tasa_ea === null ? null : d.tasa_ea.toNumber() };
}

export const almacenDinero: AlmacenDinero = {
  cuentas: () => prisma.cuenta.findMany({ select: CUENTA, orderBy: { creada_en: "asc" } }),
  saldosCuentas: () =>
    prisma.saldoCuenta.findMany({
      select: SALDO_CUENTA,
      distinct: ["cuenta_id"],
      orderBy: [{ cuenta_id: "asc" }, { anotado_en: "desc" }],
    }),
  deudas: async () =>
    (await prisma.deuda.findMany({ select: DEUDA, orderBy: { creada_en: "asc" } })).map(plana),
  saldosDeudas: () =>
    prisma.saldoDeuda.findMany({
      select: SALDO_DEUDA,
      distinct: ["deuda_id"],
      orderBy: [{ deuda_id: "asc" }, { anotado_en: "desc" }],
    }),
  // El último de cada deuda y todos los de `cierre >= desde`; el módulo puro deduplica.
  extractos: async (desde) => {
    const [ultimos, recientes] = await Promise.all([
      prisma.extracto.findMany({
        select: EXTRACTO,
        distinct: ["deuda_id"],
        orderBy: [{ deuda_id: "asc" }, { cierre: "desc" }, { anotado_en: "desc" }],
      }),
      prisma.extracto.findMany({
        where: { cierre: { gte: desde } },
        select: EXTRACTO,
        orderBy: [{ deuda_id: "asc" }, { cierre: "desc" }, { anotado_en: "desc" }],
      }),
    ]);
    return [...ultimos, ...recientes];
  },

  cuentaPorId: (id) => prisma.cuenta.findUnique({ where: { id }, select: CUENTA }),
  ultimoSaldoDeCuenta: (cuentaId) =>
    prisma.saldoCuenta.findFirst({
      where: { cuenta_id: cuentaId },
      select: SALDO_CUENTA,
      orderBy: { anotado_en: "desc" },
    }),
  deudaPorId: async (id) => {
    const d = await prisma.deuda.findUnique({ where: { id }, select: DEUDA });
    return d ? plana(d) : null;
  },
  ultimoSaldoDeDeuda: (deudaId) =>
    prisma.saldoDeuda.findFirst({
      where: { deuda_id: deudaId },
      select: SALDO_DEUDA,
      orderBy: { anotado_en: "desc" },
    }),
  extractoDeDeuda: (deudaId) =>
    prisma.extracto.findFirst({
      where: { deuda_id: deudaId },
      select: EXTRACTO,
      orderBy: [{ cierre: "desc" }, { anotado_en: "desc" }],
    }),
  extractoPorId: (id) => prisma.extracto.findUnique({ where: { id }, select: EXTRACTO }),
  saldoCuentaPorId: (id) => prisma.saldoCuenta.findUnique({ where: { id }, select: SALDO_CUENTA }),
  saldoDeudaPorId: (id) => prisma.saldoDeuda.findUnique({ where: { id }, select: SALDO_DEUDA }),

  crearCuentaConSaldo: ({ cuenta, saldo }) =>
    prisma.$transaction(async (tx) => {
      const c = await tx.cuenta.create({ data: cuenta, select: CUENTA });
      const s = await tx.saldoCuenta.create({
        data: { id: saldo.id, cuenta_id: c.id, valor: saldo.valor },
        select: SALDO_CUENTA,
      });
      return { cuenta: c, saldo: s };
    }),
  crearDeudaConSaldo: ({ deuda, saldo }) =>
    prisma.$transaction(async (tx) => {
      const d = await tx.deuda.create({ data: deuda, select: DEUDA });
      const s = await tx.saldoDeuda.create({
        data: { id: saldo.id, deuda_id: d.id, valor: saldo.valor },
        select: SALDO_DEUDA,
      });
      return { deuda: plana(d), saldo: s };
    }),
  crearExtracto: (datos) => prisma.extracto.create({ data: datos, select: EXTRACTO }),
  crearSaldoCuenta: (datos) => prisma.saldoCuenta.create({ data: datos, select: SALDO_CUENTA }),
  crearSaldoDeuda: (datos) => prisma.saldoDeuda.create({ data: datos, select: SALDO_DEUDA }),
};
