// ==========================================
// MOTOR DE PARTIDO (§22–§26)
// ==========================================
//
// Lógica pura, headless: simula un partido de forma 100% reproducible a partir
// de { semilla, equipoA, equipoB }. No toca el DOM ni el estado del juego.
//
// PROHIBIDO Math.random() acá: la única fuente de azar es mulberry32 (§23).
//
// Formato de "equipo" que consume el motor:
//   {
//     id,                     // identificador para los eventos
//     arquero,                // 1 jugador (POR)
//     defensores,             // array de jugadores (DEF)
//     medios,                 // array de jugadores (MED)
//     delanteros              // array de jugadores (DEL)
//   }

import { mulberry32 } from "./prng.js";
import { MOTOR } from "../config/motor.js";
import {
    FORMACIONES,
    FORMACION_DEFAULT
} from "../config/formaciones.js";
import {
    MENTALIDADES_OF,
    MENTALIDADES_DEF,
    MATRIZ_CONTRAS,
    compatAtaque,
    compatMedio,
    compatDefensa,
    MENTALIDAD_OF_DEFAULT,
    MENTALIDAD_DEF_DEFAULT
} from "../config/mentalidades.js";
import {
    calcularAtaque,
    calcularMediocampo,
    calcularDefensa,
    scoreArquero,
    scoreAtaque
} from "./formulas.js";


// ==========================================
// PROBABILIDAD DE DUELO (§22)
// ==========================================
//
// Curva logística tipo Elo. Única perilla real de balance (D en config/motor.js).

export function probabilidadDuelo(fuerzaA, fuerzaB) {
    return 1 / (1 + Math.pow(10, -(fuerzaA - fuerzaB) / MOTOR.D));
}


// ==========================================
// STATS BASE DE PLANTEL (§20.1–20.3)
// ==========================================
//
// Las tres áreas + el score del arquero, SIN formación ni mentalidad. Es la
// "calidad cruda" del plantel: rival-independiente y táctica-independiente.
//
// Se usa para:
//  - lo que se muestra ANTES del partido (§19.5: "sus stats de equipo") y para
//    calibrar el rival IA a tu nivel (offset por dificultad, §31),
//  - el bucketeo de la simulación de balance por ΔFuerza Efectiva (§33): la
//    diferencia de calidad NO debe incluir la táctica, porque justamente lo que
//    se mide es si la táctica alcanza para dar vuelta esa diferencia.

export function fuerzaEquipo(equipo) {
    return {
        ataque:         calcularAtaque(equipo.delanteros),
        medio:          calcularMediocampo(equipo.medios),
        defensa:        calcularDefensa(equipo.defensores, equipo.arquero),
        arquero:        scoreArquero(equipo.arquero),
        frecuencia:     1,
        calidadOcasion: 1
    };
}


// Escalar de calidad cruda: media de las tres áreas base. Métrica de bucketeo
// de §33 (NO la Valoración, que deja de ser predictiva con la táctica activa).
// Ignora al rival a propósito (la diferencia bucketeada es de plantel, no táctica).
export function fuerzaEfectivaMedia(equipo) {
    const f = fuerzaEquipo(equipo);
    return (f.ataque + f.medio + f.defensa) / 3;
}


// ==========================================
// FUERZA EFECTIVA COMPLETA (§20.5) — lo que consume el MOTOR
// ==========================================
//
// Aplica, en el orden de §20.5:
//   stats base → mod de formación → mods de mentalidad propios → matriz de
//   contras (al ataque) → compatibilidad estructural formación ↔ mentalidad.
//
// Depende del RIVAL por dos vías: la matriz de contras (mi ofensiva vs SU
// defensiva) y la frecuencia concedida (SU BLOQUE COMPACTO me baja la frecuencia
// de ataque). Por eso la firma es (equipo, rival) y se llama una vez por equipo:
// fuerzaEfectiva(A,B) da el ataque de A ya modificado; fuerzaEfectiva(B,A), el de B.
//
// NOTA (corrección de §20.5): NO existe una MATRIZ_CONTRAS_DEF. Aplicar la matriz
// al ataque del atacante Y su espejo a la defensa del rival contaba dos veces el
// mismo enfrentamiento (ver js/config/mentalidades.js). La matriz se aplica una
// sola vez, al ataque.

export function fuerzaEfectiva(equipo, equipoRival) {
    const f = FORMACIONES[equipo.formacion] || FORMACIONES[FORMACION_DEFAULT];

    const claveOf  = equipo.mentalidadOfensiva  || MENTALIDAD_OF_DEFAULT;
    const claveDef = equipo.mentalidadDefensiva || MENTALIDAD_DEF_DEFAULT;
    const of  = MENTALIDADES_OF[claveOf]  || MENTALIDADES_OF[MENTALIDAD_OF_DEFAULT];
    const def = MENTALIDADES_DEF[claveDef] || MENTALIDADES_DEF[MENTALIDAD_DEF_DEFAULT];

    const claveRivalDef = equipoRival.mentalidadDefensiva || MENTALIDAD_DEF_DEFAULT;
    const rivalDef = MENTALIDADES_DEF[claveRivalDef] || MENTALIDADES_DEF[MENTALIDAD_DEF_DEFAULT];

    // 0. Stats base + modificador plano de formación (§20.5).
    let ataque  = calcularAtaque(equipo.delanteros)                    + f.mod.ataque;
    let medio   = calcularMediocampo(equipo.medios)                    + f.mod.medio;
    let defensa = calcularDefensa(equipo.defensores, equipo.arquero)   + f.mod.defensa;

    // 1. Mods planos de mentalidad propios (ofensiva + defensiva), §19.1/§19.2.
    ataque  += of.ataque;
    medio   += of.medio + def.medio;
    defensa += of.defensa + def.defensa;

    // 2. Matriz de contras (§19.3): mi ofensiva vs LA DEFENSIVA DEL RIVAL, al ataque.
    ataque *= MATRIZ_CONTRAS[claveOf][claveRivalDef];

    // 3. Compatibilidad estructural formación ↔ mentalidad (§19.4).
    ataque  *= compatAtaque(claveOf, f);
    medio   *= compatMedio(claveDef, f);
    defensa *= compatDefensa(claveDef, f);

    // Frecuencia de ataque = mi ofensiva × la frecuencia que ME CONCEDE el rival
    // (BLOQUE COMPACTO rival → −15% ocasiones mías). Calidad = mi ofensiva.
    const frecuencia = of.frecuencia * rivalDef.frecuenciaRival;
    const calidadOcasion = of.calidadOcasion;

    return {
        ataque,
        medio,
        defensa,
        arquero: scoreArquero(equipo.arquero),
        frecuencia,
        calidadOcasion
    };
}


// ==========================================
// ELECCIÓN DEL GOLEADOR (§26)
// ==========================================
//
// Ponderada por posición (DEL×5 / MED×2 / DEF×1 / POR×0) y por el scoreAtaque
// individual. Consume exactamente una tirada del PRNG.

const PESO_POSICION_GOL = { DEL: 5, MED: 2, DEF: 1, POR: 0 };

export function elegirGoleador(equipo, rand) {
    const candidatos = [];

    const agregar = (jugadores, pesoPos) => {
        for (const j of jugadores) {
            const peso = pesoPos * scoreAtaque(j);
            if (peso > 0) candidatos.push({ id: j.id, peso });
        }
    };

    agregar(equipo.delanteros, PESO_POSICION_GOL.DEL);
    agregar(equipo.medios,     PESO_POSICION_GOL.MED);
    agregar(equipo.defensores, PESO_POSICION_GOL.DEF);
    // El arquero tiene peso 0: no entra.

    const total = candidatos.reduce((acc, c) => acc + c.peso, 0);

    let r = rand() * total;
    for (const c of candidatos) {
        r -= c.peso;
        if (r < 0) return c.id;
    }
    return candidatos[candidatos.length - 1].id;
}


// ==========================================
// SIMULACIÓN DEL PARTIDO (§24, §25)
// ==========================================
//
// Por posesiones. Cada posesión: duelo de mediocampo → ¿ocasión? → ¿gol?
// El orden de consumo del PRNG es fijo, lo que garantiza reproducibilidad
// byte por byte para una misma semilla.

export function simularPartido(equipoA, equipoB, semilla) {
    const rand = mulberry32(semilla);

    const fA = fuerzaEfectiva(equipoA, equipoB);
    const fB = fuerzaEfectiva(equipoB, equipoA);

    let golesA = 0;
    let golesB = 0;
    const eventos = [];

    const nPosesiones =
        MOTOR.POSESIONES_MIN + Math.floor(rand() * MOTOR.POSESIONES_RANGO);

    // Probabilidad base de posesión por el duelo de mediocampo (§24, Fase 1),
    // constante en el partido. Se le suma un "tempo" de media cero sorteado UNA
    // vez: el clima de posesión de ESTE partido (ver MOTOR.TEMPO_POSESION).
    const pPosesionBase = probabilidadDuelo(fA.medio, fB.medio);
    const tempo = (rand() - 0.5) * MOTOR.TEMPO_POSESION;
    const pPosesion = Math.max(0.05, Math.min(0.95, pPosesionBase + tempo));

    for (let i = 0; i < nPosesiones; i++) {
        const minuto = Math.floor((i / nPosesiones) * 90) + Math.floor(rand() * 3);

        // FASE 1 — duelo de mediocampo: ¿quién ataca? (con el tempo del partido)
        const atacaA = rand() < pPosesion;

        const atk = atacaA ? fA : fB;
        const def = atacaA ? fB : fA;
        const equipoAtacante = atacaA ? equipoA : equipoB;

        // FASE 2 — ¿se genera ocasión?
        if (rand() < probabilidadDuelo(atk.ataque, def.defensa) * atk.frecuencia) {
            const calidad = atk.ataque
                * (MOTOR.VARIANZA_OCASION_MIN + rand() * MOTOR.VARIANZA_OCASION_SPAN)
                * atk.calidadOcasion;

            // FASE 3 — ¿es gol? (calidad de la ocasión vs. arquero rival)
            if (rand() < probabilidadDuelo(calidad, def.arquero) * MOTOR.FACTOR_GOL) {
                if (atacaA) golesA++; else golesB++;
                eventos.push({
                    minuto,
                    tipo: "GOL",
                    equipo: equipoAtacante.id,
                    autor: elegirGoleador(equipoAtacante, rand)
                });
            } else {
                eventos.push({ minuto, tipo: "ATAJADA", equipo: equipoAtacante.id });
            }
        } else {
            eventos.push({ minuto, tipo: "ATAQUE_CORTADO", equipo: equipoAtacante.id });
        }
    }

    return { golesA, golesB, eventos, semilla };
}
