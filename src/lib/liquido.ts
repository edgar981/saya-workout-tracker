/*
 * Lo PURO del lienzo líquido (§2): el texto del shader, el tamaño de render, el
 * tope de cuadros por ruta, la decisión de dibujar, el cuadro fijo de movimiento
 * reducido y el contador de paneles abiertos. Sin DOM ni `window`: vitest lo
 * prueba en entorno `node`. Lo que necesita el navegador vive en
 * `components/liquido.tsx`.
 */

/** Vértice: un triángulo de pantalla completa. */
export const VS = "attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}";

/** Fragment de la ronda 2 del diseño, copiado tal cual. Uniformes: R (tamaño de
 *  render), T (tiempo), S (scroll / 900). */
export const FS = `precision mediump float;
uniform vec2 R;uniform float T;uniform float S;
float band(float x){float c=.5+.5*cos(x);c*=c;c*=c;return c*c*c;}
void main(){
  vec2 uv=gl_FragCoord.xy/R;
  vec2 p=(gl_FragCoord.xy-.5*R)/R.y*1.3;
  p.y-=S;
  float t=T*.11;
  vec2 q=p;
  q+=.45*vec2(sin(1.6*q.y+t*1.7),sin(1.3*q.x-t*1.4));
  q+=.2*vec2(sin(2.8*q.y-t*1.2+1.3),sin(2.4*q.x+t*1.6+.7));
  float f=q.x*1.1+q.y*.9;
  float s=sin(f*2.4),x=cos(f*2.4);
  float body=smoothstep(.18,.42,s);
  float ph=1.2+.6*sin(t*2.+q.y*1.3);
  float k=6.;
  vec3 c=vec3(band(x*k+ph+.26),band(x*k+ph),band(x*k+ph-.26))*1.45;
  float sheen=.5+.5*cos(x*2.+ph);
  c+=vec3(.5,.52,.56)*sheen*sheen*sheen*.42+vec3(.05,.055,.07)*(1.-x*x);
  c*=body*(.6+.4*s);
  float m1=smoothstep(1.3,.05,length((uv-vec2(.95,1.))*vec2(1.,1.3)));
  float m2=smoothstep(1.,.05,length((uv-vec2(0.,.34))*vec2(1.2,1.5)))*.6;
  c*=clamp(m1+m2,0.,1.);
  gl_FragColor=vec4(c,1.);
}`;

/** Triángulo de pantalla completa. */
export const TRIANGULO = [-1, -1, 3, -1, -1, 3] as const;

/** Opciones del contexto WebGL1. */
export const OPCIONES_GL = {
  antialias: false,
  alpha: false,
  depth: false,
  stencil: false,
  powerPreference: "low-power",
  preserveDrawingBuffer: false,
} as const;

/** El scroll de la página mueve el líquido: S = scrollY / ESCALA_SCROLL. */
export const ESCALA_SCROLL = 900;

/** Factor del tamaño de render sobre el tamaño CSS (y tope del DPR). */
const FACTOR_RENDER = 0.5;
const DPR_MAX = 2;
const LADO_MIN = 2;

export type TamanoRender = { ancho: number; alto: number };

/** Tamaño de render: CSS × min(DPR, 2) × .5, mínimo 2 px por lado. A 375 × 709 y
 *  DPR 2 son 375 × 709; a DPR 3 el factor es el mismo. */
export function tamanoRender(anchoCss: number, altoCss: number, dpr: number): TamanoRender {
  const factor = Math.min(dpr, DPR_MAX) * FACTOR_RENDER;
  return {
    ancho: Math.max(LADO_MIN, Math.round(anchoCss * factor)),
    alto: Math.max(LADO_MIN, Math.round(altoCss * factor)),
  };
}

const TOPE_NORMAL = 30;
const TOPE_SESION = 20;

/** Rutas donde el registro pide el alto y el líquido baja: tope 20 y opacidad .4. */
const RUTAS_SESION = new Set(["/sesion", "/sesion/cerrar"]);

/** Quita la barra final (`/sesion/` → `/sesion`), salvo la raíz. */
function sinBarraFinal(ruta: string): string {
  return ruta.length > 1 && ruta.endsWith("/") ? ruta.slice(0, -1) : ruta;
}

export function esRutaSesion(ruta: string): boolean {
  return RUTAS_SESION.has(sinBarraFinal(ruta));
}

/** Tope de cuadros por segundo: 30, y 20 en `/sesion` y `/sesion/cerrar`. */
export function topeFps(ruta: string): number {
  return esRutaSesion(ruta) ? TOPE_SESION : TOPE_NORMAL;
}

/** Margen (ms) para que un rAF que llega un poco antes de tiempo no pierda el cuadro. */
const MARGEN_MS = 2;

/** ¿Toca dibujar? `ahora − últimoDibujo ≥ 1000/tope − 2`. */
export function debeDibujar(ahora: number, ultimoDibujo: number, tope: number): boolean {
  return ahora - ultimoDibujo >= 1000 / tope - MARGEN_MS;
}

const DT_MAX_MS = 100;

/** Avance del tiempo en ms: `min(dt, 100)`, para que una pestaña dormida no salte. */
export function avanceTiempo(dtMs: number): number {
  return Math.min(Math.max(dtMs, 0), DT_MAX_MS);
}

/** El único cuadro de movimiento reducido. */
export const CUADRO_REDUCIDO = { T: 5, S: 0 } as const;

/** Contador de paneles abiertos. Lleva cuenta para que dos paneles anidados no
 *  reanuden el líquido de más; un cierre de sobra no la deja negativa. */
export function crearContadorPaneles() {
  let cuenta = 0;
  const oyentes = new Set<() => void>();
  const avisar = () => oyentes.forEach((f) => f());
  return {
    abrir() {
      cuenta += 1;
      avisar();
    },
    cerrar() {
      if (cuenta === 0) return;
      cuenta -= 1;
      avisar();
    },
    cuenta: () => cuenta,
    /** `hold`: mientras haya un panel abierto, el líquido se detiene. */
    hold: () => cuenta > 0,
    suscribir(f: () => void) {
      oyentes.add(f);
      return () => {
        oyentes.delete(f);
      };
    },
  };
}

/** El contador de la app (lo usa `ui/panel.tsx` y lo lee el lienzo). */
export const paneles = crearContadorPaneles();
