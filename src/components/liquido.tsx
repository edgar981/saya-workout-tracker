"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

import {
  CUADRO_REDUCIDO,
  ESCALA_SCROLL,
  FS,
  OPCIONES_GL,
  TRIANGULO,
  VS,
  avanceTiempo,
  debeDibujar,
  esRutaSesion,
  paneles,
  tamanoRender,
  topeFps,
} from "@/lib/liquido";

/**
 * El lienzo líquido (§2): UN `<canvas>` para toda la app, detrás de todo. El
 * póster CSS (`.liquido-poster`) está en el HTML desde el primer byte; el lienzo
 * entra encima (`data-modo="canvas"`) al dibujar su primer cuadro. Sin WebGL, con
 * el shader roto o al perder el contexto, el póster se queda hasta recargar
 * (`webglcontextrestored` no se maneja).
 *
 * No toca `window` ni `document` al importarse: todo vive dentro del efecto.
 */
export function Liquido() {
  const pathname = usePathname();
  const raizRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // El efecto principal no depende de la ruta: lee el tope de aquí.
  const topeRef = useRef(topeFps(pathname));

  useEffect(() => {
    topeRef.current = topeFps(pathname);
  }, [pathname]);

  useEffect(() => {
    const raiz = raizRef.current;
    const canvas = canvasRef.current;
    if (!raiz || !canvas) return;

    const ponerPoster = () => raiz.removeAttribute("data-modo");

    let gl: WebGLRenderingContext | null = null;
    try {
      gl = canvas.getContext("webgl", OPCIONES_GL) as WebGLRenderingContext | null;
    } catch {
      gl = null;
    }
    if (!gl) return; // sin WebGL: el póster ya está.
    const ctx = gl;

    const compilar = (tipo: number, fuente: string) => {
      const sh = ctx.createShader(tipo);
      if (!sh) return null;
      ctx.shaderSource(sh, fuente);
      ctx.compileShader(sh);
      if (!ctx.getShaderParameter(sh, ctx.COMPILE_STATUS)) {
        console.warn("liquido: el shader no compila", ctx.getShaderInfoLog(sh));
        ctx.deleteShader(sh);
        return null;
      }
      return sh;
    };

    const vs = compilar(ctx.VERTEX_SHADER, VS);
    const fs = compilar(ctx.FRAGMENT_SHADER, FS);
    const prog = ctx.createProgram();
    if (!vs || !fs || !prog) return; // póster.
    ctx.attachShader(prog, vs);
    ctx.attachShader(prog, fs);
    ctx.linkProgram(prog);
    if (!ctx.getProgramParameter(prog, ctx.LINK_STATUS)) {
      console.warn("liquido: el programa no enlaza", ctx.getProgramInfoLog(prog));
      return; // póster.
    }
    ctx.useProgram(prog);

    const buffer = ctx.createBuffer();
    ctx.bindBuffer(ctx.ARRAY_BUFFER, buffer);
    ctx.bufferData(ctx.ARRAY_BUFFER, new Float32Array(TRIANGULO), ctx.STATIC_DRAW);
    const loc = ctx.getAttribLocation(prog, "p");
    ctx.enableVertexAttribArray(loc);
    ctx.vertexAttribPointer(loc, 2, ctx.FLOAT, false, 0, 0);
    const uR = ctx.getUniformLocation(prog, "R");
    const uT = ctx.getUniformLocation(prog, "T");
    const uS = ctx.getUniformLocation(prog, "S");

    const movReducido = window.matchMedia("(prefers-reduced-motion: reduce)");
    let reducido = movReducido.matches;
    let perdido = false;
    let raf = 0;
    let tiempo = 0; // segundos
    let ultimoDibujo = -Infinity;
    let ancho = 2;
    let alto = 2;

    const dibujar = () => {
      ctx.uniform2f(uR, ancho, alto);
      ctx.uniform1f(uT, reducido ? CUADRO_REDUCIDO.T : tiempo);
      ctx.uniform1f(uS, reducido ? CUADRO_REDUCIDO.S : window.scrollY / ESCALA_SCROLL);
      ctx.drawArrays(ctx.TRIANGLES, 0, 3);
      raiz.setAttribute("data-modo", "canvas");
    };

    const cuadro = (ahora: number) => {
      raf = requestAnimationFrame(cuadro);
      const tope = topeRef.current;
      if (!debeDibujar(ahora, ultimoDibujo, tope)) return;
      const dt = ultimoDibujo === -Infinity ? 0 : ahora - ultimoDibujo;
      ultimoDibujo = ahora;
      tiempo += avanceTiempo(dt) / 1000;
      dibujar();
    };

    const debeCorrer = () =>
      !reducido && !perdido && !document.hidden && !paneles.hold();

    const sincronizar = () => {
      if (debeCorrer()) {
        if (!raf) {
          ultimoDibujo = -Infinity; // el primer dt tras reanudar es 0.
          raf = requestAnimationFrame(cuadro);
        }
      } else if (raf) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
    };

    const medir = () => {
      const t = tamanoRender(canvas.clientWidth, canvas.clientHeight, window.devicePixelRatio || 1);
      ancho = t.ancho;
      alto = t.alto;
      canvas.width = ancho;
      canvas.height = alto;
      ctx.viewport(0, 0, ancho, alto);
      if (!perdido) dibujar(); // cambiar el tamaño vacía el búfer: un cuadro.
    };

    const alScroll = () => {
      // Un lienzo detenido redibuja un cuadro por evento de scroll.
      if (!reducido && !perdido && !raf && !document.hidden) dibujar();
    };

    const alCambiarMovimiento = () => {
      reducido = movReducido.matches;
      sincronizar();
      if (!perdido && !raf) dibujar(); // reducido: el cuadro fijo; si no, el actual.
    };

    const alPerderContexto = () => {
      perdido = true;
      sincronizar();
      ponerPoster();
    };

    const ro = new ResizeObserver(medir);
    ro.observe(canvas);
    canvas.addEventListener("webglcontextlost", alPerderContexto);
    window.addEventListener("scroll", alScroll, { passive: true });
    document.addEventListener("visibilitychange", sincronizar);
    movReducido.addEventListener("change", alCambiarMovimiento);
    const dejarDeOirPaneles = paneles.suscribir(sincronizar);

    medir();
    sincronizar();

    return () => {
      if (raf) cancelAnimationFrame(raf);
      ro.disconnect();
      canvas.removeEventListener("webglcontextlost", alPerderContexto);
      window.removeEventListener("scroll", alScroll);
      document.removeEventListener("visibilitychange", sincronizar);
      movReducido.removeEventListener("change", alCambiarMovimiento);
      dejarDeOirPaneles();
      ctx.deleteBuffer(buffer);
      ctx.deleteProgram(prog);
      ctx.deleteShader(vs);
      ctx.deleteShader(fs);
    };
  }, []);

  return (
    <div
      ref={raizRef}
      className="liquido"
      aria-hidden="true"
      data-tenue={esRutaSesion(pathname) ? "" : undefined}
    >
      <div className="liquido-poster" />
      <canvas ref={canvasRef} className="liquido-canvas" />
    </div>
  );
}
