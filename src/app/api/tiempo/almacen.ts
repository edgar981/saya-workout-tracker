import { prisma } from "@/lib/prisma";
import type { AlmacenTiempo } from "@/lib/tiempo/servidor";

/**
 * El `AlmacenTiempo` sobre Prisma (DECISIONES.md §15): el único archivo que
 * escribe las tablas de Tiempo. No atrapa errores: eso lo hace el módulo puro.
 */

const TEMA = { id: true, nombre: true, creado_en: true } as const;
const REGISTRO = {
  id: true,
  tema_id: true,
  minutos: true,
  fecha: true,
  anotado_en: true,
} as const;

export const almacenTiempo: AlmacenTiempo = {
  temas: () => prisma.tema.findMany({ select: TEMA, orderBy: { nombre: "asc" } }),
  registrosDesde: (desde) =>
    prisma.registroTiempo.findMany({
      select: REGISTRO,
      where: { fecha: { gte: desde } },
      orderBy: [{ fecha: "desc" }, { anotado_en: "desc" }],
    }),
  primerRegistro: async () => {
    const r = await prisma.registroTiempo.aggregate({ _min: { fecha: true } });
    return r._min.fecha;
  },
  // Una sola transacción en forma de arreglo: una lectura coherente de las dos tablas.
  todo: async () => {
    const [temas, registros] = await prisma.$transaction([
      prisma.tema.findMany({ select: TEMA, orderBy: { creado_en: "asc" } }),
      prisma.registroTiempo.findMany({
        select: REGISTRO,
        orderBy: [{ fecha: "asc" }, { anotado_en: "asc" }],
      }),
    ]);
    return { temas, registros };
  },
  temaPorId: (id) => prisma.tema.findUnique({ where: { id }, select: TEMA }),
  temaPorNombre: (nombre) => prisma.tema.findUnique({ where: { nombre }, select: TEMA }),
  crearTema: ({ id, nombre }) => prisma.tema.create({ data: { id, nombre }, select: TEMA }),
  registroPorId: (id) => prisma.registroTiempo.findUnique({ where: { id }, select: REGISTRO }),
  crearRegistro: (datos) => prisma.registroTiempo.create({ data: datos, select: REGISTRO }),
};
