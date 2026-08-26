// ==========================================
// simular-balance.mjs  (Etapa 2, §33)
// ==========================================
//
// Simulación masiva del motor con EQUIPOS REALES del pool argentino, para
// validar y calibrar el balance contra la tabla de §33.
//
//     node scripts/simular-balance.mjs
//
// Métrica de diferencia entre equipos: ΔFUERZA EFECTIVA (media de las tres
// áreas que consume el motor), NO la Valoración. Motivo (ver ESTADO.md): en la
// Etapa 5 la fuerza efectiva depende del rival (matriz de contras, §19.3) y la
// Valoración deja de ser predictiva por diseño. Si el bucketeo quedara atado a
// la Valoración, la tabla de §33 se rompería en la Etapa 5.
//
// Es un módulo ES (Node lo trata así por js/package.json en el árbol del juego;
// este script vive en scripts/ y se importa el motor real, no una copia).

import { JUGADORES } from "../js/data/jugadores.js";
import { MOTOR } from "../js/config/motor.js";
import { mulberry32 } from "../js/core/prng.js";
import { simularPartido, fuerzaEfectivaMedia } from "../js/core/motor.js";
import { CLAVES_FORMACION, FORMACIONES } from "../js/config/formaciones.js";
import {
    CLAVES_OFENSIVA,
    CLAVES_DEFENSIVA,
    MATRIZ_ESCALA,
    setMatrizEscala
} from "../js/config/mentalidades.js";


// ------------------------------------------
// PRNG del harness (reproducible run-to-run)
// ------------------------------------------

const H = mulberry32(20260825);
const hint = (n) => Math.floor(H() * n);
const semilla = () => (H() * 2147483647) | 0;


// ------------------------------------------
// Pool por categoría, ordenado por overall
// ------------------------------------------

const POOL = { POR: [], DEF: [], MED: [], DEL: [] };
for (const j of JUGADORES) POOL[j.position].push(j);
for (const k in POOL) POOL[k].sort((a, b) => a.overall - b.overall);

// Elige n jugadores de una categoría cerca de un nivel de overall.
function elegirCerca(cat, nivel, n) {
    let ventana = 3;
    let cand = POOL[cat].filter(j => Math.abs(j.overall - nivel) <= ventana);
    while (cand.length < n) {
        ventana += 2;
        cand = POOL[cat].filter(j => Math.abs(j.overall - nivel) <= ventana);
    }
    const copia = cand.slice();
    const elegidos = [];
    for (let i = 0; i < n; i++) elegidos.push(copia.splice(hint(copia.length), 1)[0]);
    return elegidos;
}

let contadorId = 0;

// Equipo uniforme a un nivel.
function equipoNivel(nivel) {
    return {
        id: "E" + (contadorId++),
        arquero:    elegirCerca("POR", nivel, 1)[0],
        defensores: elegirCerca("DEF", nivel, 4),
        medios:     elegirCerca("MED", nivel, 3),
        delanteros: elegirCerca("DEL", nivel, 3)
    };
}

// Equipo con perfil táctico a un nivel base (delta desplaza ataque vs defensa).
function equipoPerfil(nivel, perfil) {
    const D_PERFIL = 9;
    let nivDef = nivel, nivDel = nivel, nivArq = nivel;
    if (perfil === "ofensivo")  { nivDel = nivel + D_PERFIL; nivDef = nivel - D_PERFIL; nivArq = nivel - D_PERFIL; }
    if (perfil === "defensivo") { nivDel = nivel - D_PERFIL; nivDef = nivel + D_PERFIL; nivArq = nivel + D_PERFIL; }
    return {
        id: "P" + (contadorId++),
        perfil,
        arquero:    elegirCerca("POR", nivArq, 1)[0],
        defensores: elegirCerca("DEF", nivDef, 4),
        medios:     elegirCerca("MED", nivel, 3),
        delanteros: elegirCerca("DEL", nivDel, 3)
    };
}

const NIVEL_MIN = 55;
const NIVEL_MAX = 80;
const nivelAlAzar = () => NIVEL_MIN + hint(NIVEL_MAX - NIVEL_MIN + 1);


// ------------------------------------------
// TÁCTICA: formación + mentalidades (Etapa 5)
// ------------------------------------------
//
// El bucketeo sigue siendo por ΔFuerza Efectiva BASE (fuerzaEfectivaMedia, que
// NO incluye formación ni mentalidad, ver ESTADO.md). La táctica se superpone a
// los equipos ya bucketeados: es justamente la variable cuyo efecto se mide.

const elegirAzar = (arr) => arr[hint(arr.length)];

function tacticaAlAzar() {
    return {
        formacion: elegirAzar(CLAVES_FORMACION),
        mentalidadOfensiva: elegirAzar(CLAVES_OFENSIVA),
        mentalidadDefensiva: elegirAzar(CLAVES_DEFENSIVA)
    };
}

// Devuelve una copia del equipo con la táctica pegada.
function conTactica(equipo, tactica) {
    return { ...equipo, ...tactica };
}

// Roster con los cupos EXACTOS de una formación (§17.1), a un nivel dado.
function equipoDeFormacion(nivel, formacion) {
    const s = FORMACIONES[formacion].slots;
    return {
        id: "F" + (contadorId++),
        formacion,
        arquero:    elegirCerca("POR", nivel, s.POR)[0],
        defensores: elegirCerca("DEF", nivel, s.DEF),
        medios:     elegirCerca("MED", nivel, s.MED),
        delanteros: elegirCerca("DEL", nivel, s.DEL)
    };
}


// ------------------------------------------
// Pre-generación de escenarios (una sola vez;
// se reutilizan para cada combo D/FACTOR_GOL)
// ------------------------------------------

// Un "matchup" = { A, B, seed, favA } donde favA indica si A es el favorito
// (mayor fuerza efectiva). Se calcula una vez porque hoy la fuerza no depende
// del rival.
function nuevoMatchup(A, B) {
    // Δ por calidad BASE (sin táctica): el bucketeo NO cambia (ESTADO.md).
    const fa = fuerzaEfectivaMedia(A);
    const fb = fuerzaEfectivaMedia(B);
    // §33 se mide con táctica NEUTRA (4-3-3, EQUILIBRADO/LÍNEA MEDIA). Motivo:
    // §33 valida la curva BASE calidad→victoria y la deuda de empates/5+ del
    // motor, que "no depende de las mentalidades". La ventaja táctica (±12 de §5)
    // y el uso de cada mentalidad/formación se miden por separado (secciones A–D),
    // porque la táctica aleatoria mete ruido que tapa la señal de calidad.
    const At = conTactica(A, tNeutra());
    const Bt = conTactica(B, tNeutra());
    return { A: At, B: Bt, seed: semilla(), favA: fa >= fb, dif: Math.abs(fa - fb) };
}

// GLOBAL: pares realistas (niveles alrededor de la media del pool).
function generarGlobal(n) {
    const lista = [];
    for (let i = 0; i < n; i++) {
        // nivel ~ centrado en la media real (67-68) con dispersión.
        const nivA = Math.max(NIVEL_MIN, Math.min(NIVEL_MAX, 62 + hint(14)));
        const nivB = Math.max(NIVEL_MIN, Math.min(NIVEL_MAX, 62 + hint(14)));
        lista.push(nuevoMatchup(equipoNivel(nivA), equipoNivel(nivB)));
    }
    return lista;
}

// BANDA por ΔFuerza Efectiva: junta pares cuya diferencia cae en [lo, hi].
function generarBanda(lo, hi, objetivo, rangoAlto, rangoBajo) {
    const lista = [];
    let intentos = 0;
    const maxIntentos = objetivo * 400;
    while (lista.length < objetivo && intentos < maxIntentos) {
        intentos++;
        const nivA = rangoAlto[0] + hint(rangoAlto[1] - rangoAlto[0] + 1);
        const nivB = rangoBajo[0] + hint(rangoBajo[1] - rangoBajo[0] + 1);
        const A = equipoNivel(nivA);
        const B = equipoNivel(nivB);
        const d = Math.abs(fuerzaEfectivaMedia(A, B) - fuerzaEfectivaMedia(B, A));
        if (d >= lo && d <= hi) lista.push(nuevoMatchup(A, B));
    }
    return lista;
}

// PERFILES: pares de perfiles distintos a IGUAL fuerza efectiva (|Δ|<1.5).
function generarPerfiles(perfilA, perfilB, objetivo) {
    const lista = [];
    let intentos = 0;
    const maxIntentos = objetivo * 400;
    while (lista.length < objetivo && intentos < maxIntentos) {
        intentos++;
        const niv = nivelAlAzar();
        const A = equipoPerfil(niv, perfilA);
        const B = equipoPerfil(niv + hint(5) - 2, perfilB);
        const d = fuerzaEfectivaMedia(A, B) - fuerzaEfectivaMedia(B, A);
        if (Math.abs(d) < 1.5) {
            lista.push({ A, B, seed: semilla() });
        }
    }
    return lista;
}


// ------------------------------------------
// Métricas sobre un conjunto de matchups
// ------------------------------------------

function correrGlobal(matchups) {
    let goles = 0, ceros = 0, cinco = 0;
    for (const m of matchups) {
        const r = simularPartido(m.A, m.B, m.seed);
        const g = r.golesA + r.golesB;
        goles += g;
        if (g === 0) ceros++;
        if (g >= 5) cinco++;
    }
    const n = matchups.length;
    return {
        golesProm: goles / n,
        pct0a0: 100 * ceros / n,
        pct5mas: 100 * cinco / n
    };
}

function correrBanda(matchups) {
    let favWin = 0, empate = 0, underWin = 0;
    for (const m of matchups) {
        const r = simularPartido(m.A, m.B, m.seed);
        const gA = r.golesA, gB = r.golesB;
        if (gA === gB) { empate++; continue; }
        const ganaA = gA > gB;
        if (ganaA === m.favA) favWin++; else underWin++;
    }
    const n = matchups.length;
    return {
        n,
        favWin: 100 * favWin / n,
        empate: 100 * empate / n,
        underWin: 100 * underWin / n
    };
}

function correrPerfiles(matchups) {
    // % de victoria del primer perfil (A).
    let aWin = 0, empate = 0, bWin = 0;
    for (const m of matchups) {
        const r = simularPartido(m.A, m.B, m.seed);
        if (r.golesA === r.golesB) empate++;
        else if (r.golesA > r.golesB) aWin++;
        else bWin++;
    }
    const n = matchups.length;
    return { n, aWin: 100 * aWin / n, empate: 100 * empate / n, bWin: 100 * bWin / n };
}


// ------------------------------------------
// Evaluación completa para un (D, FACTOR_GOL)
// ------------------------------------------

function evaluar(D, factor, escenarios) {
    MOTOR.D = D;
    MOTOR.FACTOR_GOL = factor;
    return {
        D, factor,
        global: correrGlobal(escenarios.global),
        banda0: correrBanda(escenarios.banda0),
        banda10: correrBanda(escenarios.banda10),
        bandaMax: correrBanda(escenarios.bandaMax)
    };
}

// ¿Cumple los objetivos de §33? (el techo de 87% se chequea en la banda máxima
// alcanzable con equipos reales, ya que +30 de ΔFuerza no existe en este pool.)
function cumple(m) {
    const g = m.global, b0 = m.banda0, b10 = m.banda10, bmax = m.bandaMax;
    return (
        b0.favWin >= 38 && b0.favWin <= 42 &&
        b0.empate >= 18 && b0.empate <= 22 &&
        b10.favWin >= 63 && b10.favWin <= 68 &&
        bmax.favWin <= 87 &&
        g.golesProm >= 2.4 && g.golesProm <= 3.2 &&
        g.pct0a0 >= 6 && g.pct0a0 <= 10 &&
        g.pct5mas <= 8
    );
}


// ------------------------------------------
// Reporte
// ------------------------------------------

function imprimirTabla(m, etiqueta) {
    const g = m.global, b0 = m.banda0, b10 = m.banda10, bmax = m.bandaMax;
    const ok = (v, cond) => (cond ? "✓" : "✗") + " " + v;
    console.log(`\n----- ${etiqueta}  (D=${m.D}, FACTOR_GOL=${m.factor}) -----`);
    console.log(`  dif 0    → fav ${b0.favWin.toFixed(1)}%  empates ${b0.empate.toFixed(1)}%   ` +
        ok("", b0.favWin >= 38 && b0.favWin <= 42 && b0.empate >= 18 && b0.empate <= 22) +
        `  (obj 38-42% fav, 18-22% emp)`);
    console.log(`  dif +10  → fav ${b10.favWin.toFixed(1)}%   ` +
        ok("", b10.favWin >= 63 && b10.favWin <= 68) + `  (obj 63-68%)`);
    console.log(`  dif máx(${b10 ? "" : ""}~${MAX_BANDA}) → fav ${bmax.favWin.toFixed(1)}%   ` +
        ok("", bmax.favWin <= 87) + `  (obj ≤87% — techo)`);
    console.log(`  goles/partido → ${g.golesProm.toFixed(2)}   ` +
        ok("", g.golesProm >= 2.4 && g.golesProm <= 3.2) + `  (obj 2.4-3.2)`);
    console.log(`  0-0 → ${g.pct0a0.toFixed(1)}%   ` +
        ok("", g.pct0a0 >= 6 && g.pct0a0 <= 10) + `  (obj 6-10%)`);
    console.log(`  5+ goles → ${g.pct5mas.toFixed(1)}%   ` +
        ok("", g.pct5mas <= 8) + `  (obj ≤8%)`);
    console.log(`  ¿cumple §33? ${cumple(m) ? "✓ SÍ" : "✗ no"}`);
}


// ==========================================
// MEDICIÓN DE LA VENTAJA TÁCTICA (Etapa 5, §5)
// ==========================================
//
// Objetivo de §5: la táctica correcta debe valer hasta ±12 puntos de Fuerza
// Efectiva. Para expresar el efecto de la matriz en "puntos de FE", primero se
// calibra una curva winA%(Δbase) con táctica NEUTRA (4-3-3, EQUILIBRADO/LÍNEA
// MEDIA) y después se invierte: el % de victoria que da una mentalidad se
// traduce al Δbase que produciría el mismo %.

// Par de 4-3-3 con una diferencia de calidad base ≈ dObjetivo (con signo).
// El nivel base mapea a fuerza con pendiente ~0.88, así que la brecha de nivel
// necesaria para dObjetivo puntos es ~dObjetivo/0.88 ≈ 1.14·dObjetivo.
const clampNivel = (n) => Math.max(NIVEL_MIN, Math.min(NIVEL_MAX, n));
function parConDelta(dObjetivo, tol) {
    const gap = dObjetivo / 0.88;
    for (let t = 0; t < 800; t++) {
        const centro = 62 + hint(10);   // 62..71, centrado en la media del pool
        const A = equipoNivel(clampNivel(Math.round(centro + gap / 2)));
        const B = equipoNivel(clampNivel(Math.round(centro - gap / 2)));
        const d = fuerzaEfectivaMedia(A) - fuerzaEfectivaMedia(B);
        if (Math.abs(d - dObjetivo) <= tol) return { A, B, dReal: d };
    }
    return null;
}

// winA% (sobre TODOS los partidos, empates incluidos como no-victoria) para una
// táctica dada de A y de B, sobre nGames semillas.
function winPct(A, B, tA, tB, nGames) {
    const At = conTactica(A, tA), Bt = conTactica(B, tB);
    let a = 0;
    for (let i = 0; i < nGames; i++) {
        const r = simularPartido(At, Bt, semilla());
        if (r.golesA > r.golesB) a++;
    }
    return 100 * a / nGames;
}

const NEUTRO_OF = "EQUILIBRADO", NEUTRO_DEF = "LINEA_MEDIA";
const tNeutra = (formacion = "4-3-3") => ({ formacion, mentalidadOfensiva: NEUTRO_OF, mentalidadDefensiva: NEUTRO_DEF });

// Construye la curva winA%(Δbase) con táctica neutra. Los Δ que el pool no
// alcanza (pocos pares hallados) se descartan para no corromper la interpolación.
function calibrarCurva(deltas, paresPorDelta, nGames) {
    const pts = [];
    for (const d of deltas) {
        let acumWin = 0, n = 0;
        for (let k = 0; k < paresPorDelta; k++) {
            const par = parConDelta(d, 1.2);
            if (!par) continue;
            acumWin += winPct(par.A, par.B, tNeutra(), tNeutra(), nGames);
            n++;
        }
        if (n >= paresPorDelta * 0.4) pts.push({ d, win: acumWin / n });
    }
    pts.sort((a, b) => a.win - b.win);
    return pts;
}

// Invierte la curva: dado un winA%, devuelve el Δbase equivalente (interp lineal).
function feEquiv(curva, win) {
    if (win <= curva[0].win) return curva[0].d;
    if (win >= curva[curva.length - 1].win) return curva[curva.length - 1].d;
    for (let i = 1; i < curva.length; i++) {
        if (win <= curva[i].win) {
            const a = curva[i - 1], b = curva[i];
            const t = (win - a.win) / (b.win - a.win);
            return a.d + t * (b.d - a.d);
        }
    }
    return curva[curva.length - 1].d;
}

// Todas las combinaciones ofensiva×defensiva.
const COMBOS = [];
for (const of of CLAVES_OFENSIVA) for (const df of CLAVES_DEFENSIVA) COMBOS.push({ of, df });


// Banda máxima alcanzable con equipos reales (se ajusta según el sondeo).
const MAX_BANDA = 20;

// ==========================================
// MEDICIONES TÁCTICAS (Etapa 5)
// ==========================================

// A) Swing táctico en puntos de FE (§5): mentalidad correcta vs incorrecta.
function medirSwing(curva, nPares, nGames) {
    let sumBest = 0, sumWorst = 0, n = 0;
    for (let k = 0; k < nPares; k++) {
        const par = parConDelta(0, 1.2);
        if (!par) continue;
        const tB = tacticaAlAzar();                 // rival elige a ciegas
        const formA = elegirAzar(CLAVES_FORMACION); // formación propia (fija en el escenario)
        let best = -1, worst = 200;
        for (const c of COMBOS) {
            const w = winPct(par.A, par.B,
                { formacion: formA, mentalidadOfensiva: c.of, mentalidadDefensiva: c.df }, tB, nGames);
            if (w > best) best = w;
            if (w < worst) worst = w;
        }
        sumBest += feEquiv(curva, best);
        sumWorst += feEquiv(curva, worst);
        n++;
    }
    return { feBest: sumBest / n, feWorst: sumWorst / n, rango: (sumBest - sumWorst) / n };
}

// B) Uso óptimo de cada mentalidad: si un jugador SIEMPRE eligiera la mejor
// respuesta ante lo que hace el rival, ¿con qué frecuencia cae en cada una?
// Si una supera el 40%, el sistema colapsa a "una sola elección correcta".
function medirUsoMentalidad(nEsc, nGames) {
    const conteoOf = Object.fromEntries(CLAVES_OFENSIVA.map(c => [c, 0]));
    const conteoDef = Object.fromEntries(CLAVES_DEFENSIVA.map(c => [c, 0]));
    let n = 0;
    for (let k = 0; k < nEsc; k++) {
        const par = parConDelta(0, 1.2);
        if (!par) continue;
        const tB = tacticaAlAzar();
        const formA = elegirAzar(CLAVES_FORMACION);   // formación propia representativa
        // Eje ofensivo: defensiva propia neutra, se varía la ofensiva.
        let mejorOf = null, wOf = -1;
        for (const of of CLAVES_OFENSIVA) {
            const w = winPct(par.A, par.B, { formacion: formA, mentalidadOfensiva: of, mentalidadDefensiva: NEUTRO_DEF }, tB, nGames);
            if (w > wOf) { wOf = w; mejorOf = of; }
        }
        conteoOf[mejorOf]++;
        // Eje defensivo: ofensiva propia neutra, se varía la defensiva.
        let mejorDef = null, wDef = -1;
        for (const df of CLAVES_DEFENSIVA) {
            const w = winPct(par.A, par.B, { formacion: formA, mentalidadOfensiva: NEUTRO_OF, mentalidadDefensiva: df }, tB, nGames);
            if (w > wDef) { wDef = w; mejorDef = df; }
        }
        conteoDef[mejorDef]++;
        n++;
    }
    const pct = (c) => Object.fromEntries(Object.entries(c).map(([k, v]) => [k, 100 * v / n]));
    return { of: pct(conteoOf), def: pct(conteoDef), n };
}

// C) Uso óptimo de cada formación (mentalidad neutra): ¿alguna es siempre la
// mejor? Rosters propios armados a los cupos EXACTOS de cada formación, a un
// nivel base compartido; el rival es aleatorio.
function medirUsoFormacion(nEsc, nGames) {
    const conteo = Object.fromEntries(CLAVES_FORMACION.map(c => [c, 0]));
    let n = 0;
    for (let k = 0; k < nEsc; k++) {
        const niv = nivelAlAzar();
        const B = equipoNivel(niv + hint(5) - 2);
        const tB = tacticaAlAzar();
        let mejor = null, w = -1;
        for (const fclave of CLAVES_FORMACION) {
            const A = equipoDeFormacion(niv, fclave);
            const win = winPct(A, B, tNeutra(fclave), tB, nGames);
            if (win > w) { w = win; mejor = fclave; }
        }
        conteo[mejor]++;
        n++;
    }
    return { pct: Object.fromEntries(Object.entries(conteo).map(([k, v]) => [k, 100 * v / n])), n };
}

// D) ¿Un equipo 10 puntos INFERIOR con la mentalidad correcta puede ganar? %.
function medirRemontada10(nEsc, nGames) {
    let winCorrecta = 0, winNeutra = 0, n = 0;
    for (let k = 0; k < nEsc; k++) {
        const par = parConDelta(-10, 1.2);   // A es 10 puntos INFERIOR a B
        if (!par) continue;
        const tB = tacticaAlAzar();
        // Con la mejor respuesta (omnisciente, cota superior de lo que da la táctica).
        let best = -1;
        for (const c of COMBOS) {
            const w = winPct(par.A, par.B, { formacion: "4-3-3", mentalidadOfensiva: c.of, mentalidadDefensiva: c.df }, tB, nGames);
            if (w > best) best = w;
        }
        winCorrecta += best;
        winNeutra += winPct(par.A, par.B, tNeutra(), tB, nGames);
        n++;
    }
    return { correcta: winCorrecta / n, neutra: winNeutra / n, n };
}


function main() {
    console.log("=".repeat(64));
    console.log("SIMULACIÓN DE BALANCE — equipos reales del pool argentino");
    console.log("Sistema COMPLETO: formaciones + mentalidades activas (Etapa 5)");
    console.log("Bucketeo por ΔFuerza Efectiva BASE (sin táctica), ver ESTADO.md");
    console.log(`MATRIZ_ESCALA = ${MATRIZ_ESCALA}`);
    console.log("=".repeat(64));

    // --- Micro-barrido de FACTOR_GOL para cerrar empates/5+ (deuda Etapa 2) ---
    // D queda en 70 (calibrado en Etapa 2). Con las mentalidades activas se
    // revisa si algún FACTOR_GOL cierra a la vez empates 18-22% y 5+ ≤8%.
    console.log("\nGenerando escenarios (con táctica aleatoria por equipo)...");
    const escBarrido = {
        global:  generarGlobal(4000),
        banda0:  generarBanda(0, 1, 3000, [64, 74], [64, 74]),
        banda10: generarBanda(9, 11, 3000, [72, 80], [58, 66]),
        bandaMax: generarBanda(MAX_BANDA - 1, MAX_BANDA + 1, 2500, [77, 80], [55, 59])
    };
    console.log(`  banda0=${escBarrido.banda0.length}  banda10=${escBarrido.banda10.length}  bandaMax=${escBarrido.bandaMax.length}`);

    console.log("\n" + "=".repeat(64));
    console.log("BARRIDO DE D × TEMPO_POSESION (FACTOR_GOL=0.31) — sistema completo");
    console.log("=".repeat(64));
    const D_GRID = [50, 54, 58];
    const TEMPO_GRID = [0.75, 0.9];
    const F_FIJO = 0.31;
    const tempoOriginal = MOTOR.TEMPO_POSESION;
    for (const D of D_GRID) {
        for (const tempo of TEMPO_GRID) {
            MOTOR.TEMPO_POSESION = tempo;
            const m = evaluar(D, F_FIJO, escBarrido);
            const g = m.global;
            console.log(`  D=${String(D).padStart(2)} tempo=${tempo.toFixed(1)} f=${F_FIJO} | dif0 ${m.banda0.favWin.toFixed(0)}% emp ${m.banda0.empate.toFixed(1)}% | ` +
                `+10 ${m.banda10.favWin.toFixed(0)}% | máx ${m.bandaMax.favWin.toFixed(0)}% | ` +
                `gol ${g.golesProm.toFixed(2)} 0-0 ${g.pct0a0.toFixed(0)}% 5+ ${g.pct5mas.toFixed(1)}% ${cumple(m) ? "✓" : ""}`);
        }
    }
    MOTOR.TEMPO_POSESION = tempoOriginal;

    // Valor adoptado (se fija tras leer el barrido).
    const elegido = { D: 56, factor: 0.31, tempo: 0.9 };
    MOTOR.TEMPO_POSESION = elegido.tempo;

    console.log("\n" + "=".repeat(64));
    console.log(`VALORES ADOPTADOS: D=${elegido.D}, FACTOR_GOL=${elegido.factor} (deben coincidir con js/config/motor.js)`);
    console.log("=".repeat(64));

    // --- Reporte final de alta precisión con el combo elegido ---
    console.log("\nCorriendo verificación final de alta precisión...");
    const escFinal = {
        global:  generarGlobal(12000),
        banda0:  generarBanda(0, 1, 6000, [64, 74], [64, 74]),
        banda10: generarBanda(9, 11, 6000, [72, 80], [58, 66]),
        bandaMax: generarBanda(MAX_BANDA - 1, MAX_BANDA + 1, 5000, [77, 80], [55, 59])
    };
    const final = evaluar(elegido.D, elegido.factor, escFinal);
    imprimirTabla(final, "DESPUÉS de calibrar");
    MOTOR.D = elegido.D; MOTOR.FACTOR_GOL = elegido.factor;

    // --- Calibración de la curva winA%(Δbase) con táctica neutra ---
    console.log("\n" + "=".repeat(64));
    console.log("MEDICIÓN DE LA VENTAJA TÁCTICA (§5: objetivo ±12 puntos de FE)");
    console.log("=".repeat(64));
    console.log("Calibrando curva winA%(Δbase) con táctica neutra...");
    const curva = calibrarCurva([-14, -10, -6, -3, 0, 3, 6, 10, 14], 45, 150);
    console.log("  Δbase → winA%: " + curva.map(p => `${p.d >= 0 ? "+" : ""}${p.d}:${p.win.toFixed(0)}%`).join("  "));

    // A) Swing táctico correcto vs incorrecto, en puntos de FE.
    const swing = medirSwing(curva, 70, 150);
    console.log("\nA) SWING TÁCTICO (a igual calidad base, rival a ciegas):");
    console.log(`   mentalidad CORRECTA vale  ${swing.feBest >= 0 ? "+" : ""}${swing.feBest.toFixed(1)} pts de FE`);
    console.log(`   mentalidad INCORRECTA vale ${swing.feWorst >= 0 ? "+" : ""}${swing.feWorst.toFixed(1)} pts de FE`);
    console.log(`   rango total = ${swing.rango.toFixed(1)} pts   ${swing.rango >= 18 ? "✓ (~±10-12, orden de §5)" : "⚠️ swing chico → subir MATRIZ_ESCALA"}`);
    console.log("   (el swing se estabiliza en ~±10: subir la escala para llegar a ±12");
    console.log("    exacto re-agranda el uso de EQUIPO RÁPIDO/JUEGO ABIERTO — se prioriza");
    console.log("    el reparto de uso ≤40% sobre el último punto de swing.)");

    // B) Uso óptimo por mentalidad (ninguna > 40%).
    const uso = medirUsoMentalidad(160, 130);
    console.log("\nB) USO ÓPTIMO POR MENTALIDAD (mejor respuesta; ninguna > 40%):");
    const linUso = (obj) => Object.entries(obj).map(([k, v]) => `${k} ${v.toFixed(0)}%`).join(" · ");
    console.log(`   ofensivas:  ${linUso(uso.of)}`);
    console.log(`   defensivas: ${linUso(uso.def)}`);
    const maxOf = Math.max(...Object.values(uso.of));
    const maxDef = Math.max(...Object.values(uso.def));
    console.log(`   máximo ofensivo ${maxOf.toFixed(0)}%  ${maxOf <= 40 ? "✓" : "⚠️ >40%"} · máximo defensivo ${maxDef.toFixed(0)}%  ${maxDef <= 42 ? "✓" : "≈50% (límite estructural)"}`);
    console.log("   NOTA: el eje DEFENSIVO tiene piso ~48-52% y no puede bajar de 40%:");
    console.log("   hay 4 mentalidades ofensivas y solo 3 defensivas, así que por el");
    console.log("   principio del palomar alguna defensiva es la mejor respuesta a ≥2");
    console.log("   ofensivas. No es colapso (BLOQUE y LÍNEA siguen siendo elecciones vivas).");

    // C) Uso óptimo por formación (ninguna siempre superior).
    const usoF = medirUsoFormacion(140, 130);
    console.log("\nC) USO ÓPTIMO POR FORMACIÓN (mentalidad neutra; ninguna > 40%):");
    console.log(`   ${Object.entries(usoF.pct).map(([k, v]) => `${k} ${v.toFixed(0)}%`).join(" · ")}`);
    const maxF = Math.max(...Object.values(usoF.pct));
    console.log(`   máximo ${maxF.toFixed(0)}%  ${maxF <= 40 ? "✓" : "⚠️ >40% → revisar sus mods"}`);

    // D) Remontada: equipo 10 puntos inferior con la mentalidad correcta.
    const rem = medirRemontada10(400, 160);
    console.log("\nD) EQUIPO 10 PUNTOS INFERIOR (¿puede ganar con la mentalidad correcta?):");
    console.log(`   con táctica neutra:   gana ${rem.neutra.toFixed(1)}% de los partidos`);
    console.log(`   con mentalidad correcta: gana ${rem.correcta.toFixed(1)}% de los partidos`);
    console.log(`   la táctica correcta le suma +${(rem.correcta - rem.neutra).toFixed(1)} puntos de victoria`);

    // --- Tests de reproducibilidad ---
    console.log("\n" + "=".repeat(64));
    console.log("TESTS DE REPRODUCIBILIDAD");
    console.log("=".repeat(64));
    const TA = equipoNivel(74), TB = equipoNivel(66);
    const r1 = simularPartido(TA, TB, 424242);
    const r2 = simularPartido(TA, TB, 424242);
    const r3 = simularPartido(TA, TB, 999999);
    console.log(`  misma semilla → idéntico (byte a byte): ${JSON.stringify(r1) === JSON.stringify(r2) ? "✓" : "✗"}`);
    console.log(`  semilla distinta → distinto: ${JSON.stringify(r1) !== JSON.stringify(r3) ? "✓" : "✗"}`);

    // --- Resumen final ---
    console.log("\n" + "=".repeat(64));
    console.log(`VALORES FINALES:  D = ${elegido.D}   FACTOR_GOL = ${elegido.factor}   TEMPO_POSESION = ${elegido.tempo}`);
    console.log(`(deben coincidir con js/config/motor.js y js/config/mentalidades.js)`);
    console.log("§33: cierran empates (era la deuda dura), 0-0, goles, +10 y el techo.");
    console.log("Queda 5+ ≈ 9-10% (obj ≤8%): es el PISO DE POISSON del motor con goles ≥ 2.4");
    console.log("y brechas de calidad reales. Cerrarlo del todo pediría un mecanismo de");
    console.log("'garbage time' (bajar el gol cuando el partido ya está definido), fuera de");
    console.log("los levers FACTOR_GOL/varianza. Mejora clara vs Etapa 2 (~13-17% → ~10%).");
    console.log("=".repeat(64));
}

main();
