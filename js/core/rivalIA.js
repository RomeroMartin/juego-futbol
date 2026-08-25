// ==========================================
// RIVAL IA (§31)
// ==========================================
//
// Genera un equipo rival calibrado al nivel del usuario según la dificultad.
//
// REGLAS DURAS:
//  - El offset se aplica sobre la FUERZA EFECTIVA (media de las tres áreas),
//    NO sobre la Valoración (métrica definida en la Etapa 2, ver ESTADO.md).
//  - La IA arma A CIEGAS: recibe SOLO la fuerza del usuario y la dificultad.
//    Nunca conoce el XI ni la composición del usuario, ni elige para
//    contrarrestarlo (§31.2).
//  - Nombres de equipo ficticios, nunca clubes reales (§31.3).
//
// Math.random() está permitido acá: esto es armado de equipo (como los
// paquetes), NO el motor de partido. La reproducibilidad del partido la da la
// semilla + las composiciones guardadas, no el armado del rival.

import { JUGADORES } from "../data/jugadores.js";
import { fuerzaEfectiva } from "./motor.js";
import { generarNombreRival } from "../data/nombresRival.js";


export const OFFSET_DIFICULTAD = { FACIL: -8, NORMAL: 0, DIFICIL: 6, ELITE: 14 };
export const DIFICULTADES = ["FACIL", "NORMAL", "DIFICIL", "ELITE"];

// Ninguna área puede desviarse más de esto de la media del propio rival
// (perfiles no degenerados: variedad sí, monstruos 90/40/70 no).
const MAX_DESVIO_AREA = 12;

// Margen para considerar que un candidato "dio en el objetivo" de fuerza.
const TOLERANCIA = 1.5;

// Cantidad de candidatos que se generan por rival (para elegir con variedad).
const N_CANDIDATOS = 160;


// Pool por categoría, ordenado por overall.
const POOL = { POR: [], DEF: [], MED: [], DEL: [] };
for (const j of JUGADORES) POOL[j.position].push(j);
for (const k in POOL) POOL[k].sort((a, b) => a.overall - b.overall);


// Elige n jugadores de una categoría cerca de un nivel de overall, al azar
// (para que dos rivales seguidos no salgan iguales).
function elegirCerca(cat, nivel, n, rand) {
    let ventana = 3;
    let cand = POOL[cat].filter(j => Math.abs(j.overall - nivel) <= ventana);
    while (cand.length < n) {
        ventana += 2;
        cand = POOL[cat].filter(j => Math.abs(j.overall - nivel) <= ventana);
    }
    const copia = cand.slice();
    const elegidos = [];
    for (let i = 0; i < n; i++) {
        elegidos.push(copia.splice(Math.floor(rand() * copia.length), 1)[0]);
    }
    return elegidos;
}


// Media de las tres áreas = Fuerza Efectiva escalar.
function mediaAreas(areas) {
    return (areas.ataque + areas.medio + areas.defensa) / 3;
}


// Construye un candidato a rival con un nivel base y un sesgo de perfil al azar.
function construirCandidato(rand) {
    const base = 48 + rand() * 38; // 48..86 (el extremo alto se cubre por ventana)

    // Sesgo de perfil: a veces uniforme, a veces ofensivo, a veces defensivo.
    // Magnitud moderada; los degenerados se filtran después por MAX_DESVIO_AREA.
    const tipo = rand();
    const mag = rand() * 8; // 0..8 puntos de nivel
    let nivDel = base, nivDef = base, nivArq = base, nivMed = base;
    if (tipo < 0.38) {            // ofensivo
        nivDel = base + mag; nivDef = base - mag; nivArq = base - mag;
    } else if (tipo < 0.76) {     // defensivo
        nivDef = base + mag; nivArq = base + mag; nivDel = base - mag;
    }                             // resto: uniforme
    nivMed = base + (rand() * 4 - 2); // leve variación del medio

    const equipo = {
        id: "IA",
        arquero:    elegirCerca("POR", nivArq, 1, rand)[0],
        defensores: elegirCerca("DEF", nivDef, 4, rand),
        medios:     elegirCerca("MED", nivMed, 3, rand),
        delanteros: elegirCerca("DEL", nivDel, 3, rand)
    };

    const areas = fuerzaEfectiva(equipo, equipo);
    const f = mediaAreas(areas);
    const maxDev = Math.max(
        Math.abs(areas.ataque - f),
        Math.abs(areas.medio - f),
        Math.abs(areas.defensa - f)
    );

    return { equipo, areas, f, maxDev };
}


// ==========================================
// GENERAR RIVAL IA
// ==========================================
//
// fuerzaUsuario: Fuerza Efectiva media del usuario (número).
// dificultad: "FACIL" | "NORMAL" | "DIFICIL" | "ELITE".
//
// Devuelve, entre otras cosas, `offsetReal` (lo que de verdad se alcanzó) y
// `capado` (si no se pudo llegar al offset pedido porque el pool no da).

export function generarRivalIA(fuerzaUsuario, dificultad, rand = Math.random) {
    const offsetSolicitado = OFFSET_DIFICULTAD[dificultad];
    const objetivo = fuerzaUsuario + offsetSolicitado;

    // Genera candidatos y descarta perfiles degenerados.
    const candidatos = [];
    for (let i = 0; i < N_CANDIDATOS; i++) {
        const c = construirCandidato(rand);
        if (c.maxDev <= MAX_DESVIO_AREA) candidatos.push(c);
    }

    // Candidatos que caen dentro de la tolerancia del objetivo.
    const dentro = candidatos.filter(c => Math.abs(c.f - objetivo) <= TOLERANCIA);

    let elegido;
    let capado = false;
    if (dentro.length > 0) {
        // Elección AL AZAR dentro de la banda → variedad real (no el óptimo fijo).
        elegido = dentro[Math.floor(rand() * dentro.length)];
    } else {
        // No se alcanza el objetivo (el pool no da): se elige el más cercano,
        // con algo de variedad entre los casi-empatados.
        capado = true;
        candidatos.sort((a, b) => Math.abs(a.f - objetivo) - Math.abs(b.f - objetivo));
        const mejorDist = Math.abs(candidatos[0].f - objetivo);
        const cercanos = candidatos.filter(
            c => Math.abs(c.f - objetivo) <= mejorDist + TOLERANCIA
        );
        elegido = cercanos[Math.floor(rand() * cercanos.length)];
    }

    const offsetReal = elegido.f - fuerzaUsuario;
    const nombre = generarNombreRival(rand);

    return {
        equipo: { ...elegido.equipo, nombre },
        nombre,
        dificultad,
        formacion: "4-3-3",
        areas: elegido.areas,        // { ataque, medio, defensa, arquero, ... }
        fuerzaMedia: elegido.f,
        objetivo,
        offsetSolicitado,
        offsetReal,
        capado
    };
}
