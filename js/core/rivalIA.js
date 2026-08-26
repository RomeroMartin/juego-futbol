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
import { fuerzaEquipo } from "./motor.js";
import { generarNombreRival } from "../data/nombresRival.js";
import { FORMACIONES, CLAVES_FORMACION } from "../config/formaciones.js";
import {
    CLAVES_OFENSIVA,
    CLAVES_DEFENSIVA,
    MENTALIDAD_OF_DEFAULT,
    MENTALIDAD_DEF_DEFAULT,
    compatAtaque,
    compatMedio,
    compatDefensa
} from "../config/mentalidades.js";


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


// Construye un candidato a rival con un nivel base y un sesgo de perfil al azar,
// respetando los slots de la formación elegida (§17). `slots` = { POR,DEF,MED,DEL }.
function construirCandidato(rand, slots) {
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
        arquero:    elegirCerca("POR", nivArq, slots.POR, rand)[0],
        defensores: elegirCerca("DEF", nivDef, slots.DEF, rand),
        medios:     elegirCerca("MED", nivMed, slots.MED, rand),
        delanteros: elegirCerca("DEL", nivDel, slots.DEL, rand)
    };

    // Calidad cruda (base): rival-independiente, sin formación ni mentalidad.
    // Es lo que se muestra antes del partido (§19.5) y con lo que se calibra el
    // offset por dificultad (§31); NO incluye la táctica (que se revela jugando).
    const areas = fuerzaEquipo(equipo);
    const f = mediaAreas(areas);
    const maxDev = Math.max(
        Math.abs(areas.ataque - f),
        Math.abs(areas.medio - f),
        Math.abs(areas.defensa - f)
    );

    return { equipo, areas, f, maxDev };
}


// ==========================================
// ELECCIÓN DE MENTALIDAD DE LA IA (§31.2)
// ==========================================
//
// REGLA DURA: la IA NUNCA conoce tu mentalidad. Elige a ciegas, igual que vos
// (§31.2). Nunca recibe tu XI ni tus mentalidades como parámetro.
//
//  FÁCIL   → siempre EQUILIBRADO / LÍNEA MEDIA.
//  NORMAL  → aleatoria uniforme entre todas.
//  DIFÍCIL → aleatoria, pero descarta combos estructuralmente malos (§19.4).
//  ÉLITE   → coherente con su formación (mejor compatibilidad), variando.

const elegir = (arr, rand) => arr[Math.floor(rand() * arr.length)];

// ¿La ofensiva encaja estructuralmente en esta formación? (§19.4: compat ≥ 1).
const ofensivaCoherente = (clave, f) => compatAtaque(clave, f) >= 1.0;
// ¿La defensiva encaja? (PRESIÓN ALTA y BLOQUE COMPACTO dependen de la densidad).
const defensivaCoherente = (clave, f) =>
    compatMedio(clave, f) >= 1.0 && compatDefensa(clave, f) >= 1.0;

function elegirMentalidadesIA(dificultad, formacion, rand) {
    const f = FORMACIONES[formacion];

    if (dificultad === "FACIL") {
        return { of: MENTALIDAD_OF_DEFAULT, def: MENTALIDAD_DEF_DEFAULT };
    }

    if (dificultad === "NORMAL") {
        return { of: elegir(CLAVES_OFENSIVA, rand), def: elegir(CLAVES_DEFENSIVA, rand) };
    }

    if (dificultad === "DIFICIL") {
        // Descarta combos estructuralmente malos; si ninguno queda, cae al neutro.
        const ofOk  = CLAVES_OFENSIVA.filter(c => ofensivaCoherente(c, f));
        const defOk = CLAVES_DEFENSIVA.filter(c => defensivaCoherente(c, f));
        return {
            of:  ofOk.length  ? elegir(ofOk, rand)  : MENTALIDAD_OF_DEFAULT,
            def: defOk.length ? elegir(defOk, rand) : MENTALIDAD_DEF_DEFAULT
        };
    }

    // ÉLITE: entre las coherentes, prioriza las que MÁS aprovechan la formación
    // (mayor compatibilidad), variando entre las mejores.
    const mejores = (claves, compat) => {
        const conCompat = claves.map(c => ({ c, v: compat(c, f) }));
        const max = Math.max(...conCompat.map(x => x.v));
        const top = conCompat.filter(x => x.v >= max - 0.001).map(x => x.c);
        return elegir(top, rand);
    };
    return {
        of:  mejores(CLAVES_OFENSIVA,  compatAtaque),
        def: mejores(CLAVES_DEFENSIVA, (c, ff) => compatMedio(c, ff) * compatDefensa(c, ff))
    };
}


// ==========================================
// GENERAR RIVAL IA
// ==========================================
//
// fuerzaUsuario: Fuerza Efectiva media (calidad base) del usuario (número).
// dificultad: "FACIL" | "NORMAL" | "DIFICIL" | "ELITE".
//
// Devuelve, entre otras cosas, `offsetReal` (lo que de verdad se alcanzó) y
// `capado` (si no se pudo llegar al offset pedido porque el pool no da).

export function generarRivalIA(fuerzaUsuario, dificultad, rand = Math.random) {
    const offsetSolicitado = OFFSET_DIFICULTAD[dificultad];
    const objetivo = fuerzaUsuario + offsetSolicitado;

    // La IA elige su formación al azar (§31.1), a ciegas de tu XI.
    const formacion = elegir(CLAVES_FORMACION, rand);
    const slots = FORMACIONES[formacion].slots;

    // Genera candidatos con esa formación y descarta perfiles degenerados.
    const candidatos = [];
    for (let i = 0; i < N_CANDIDATOS; i++) {
        const c = construirCandidato(rand, slots);
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

    // Mentalidades A CIEGAS (§31.2): dependen solo de la dificultad y de la
    // propia formación de la IA, NUNCA de tu XI ni de tus mentalidades.
    const ment = elegirMentalidadesIA(dificultad, formacion, rand);

    return {
        equipo: {
            ...elegido.equipo,
            nombre,
            formacion,
            mentalidadOfensiva: ment.of,
            mentalidadDefensiva: ment.def
        },
        nombre,
        dificultad,
        formacion,
        mentalidadOfensiva: ment.of,
        mentalidadDefensiva: ment.def,
        areas: elegido.areas,        // calidad base { ataque, medio, defensa, arquero }
        fuerzaMedia: elegido.f,
        objetivo,
        offsetSolicitado,
        offsetReal,
        capado
    };
}
