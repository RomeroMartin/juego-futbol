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
// FUERZA EFECTIVA (punto de entrada, §20.5)
// ==========================================
//
// Lo que el motor consume realmente. HOY devuelve las tres áreas base más
// `frecuencia` y `calidadOcasion` neutros (1). En la Etapa 5, ACÁ se insertan
// el modificador de formación, las mentalidades y la matriz de contras (§19,
// §20.5) — que dependen del rival, por eso `equipoRival` ya está en la firma —
// sin tener que reescribir el motor. NO implementar esos modificadores todavía.

export function fuerzaEfectiva(equipo, equipoRival) {
    // `equipoRival` no se usa todavía (lo usará la matriz de contras, Etapa 5).
    void equipoRival;

    return {
        ataque:        calcularAtaque(equipo.delanteros),
        medio:         calcularMediocampo(equipo.medios),
        defensa:       calcularDefensa(equipo.defensores, equipo.arquero),
        arquero:       scoreArquero(equipo.arquero),
        frecuencia:    1,   // modificado por mentalidad ofensiva en la Etapa 5
        calidadOcasion: 1   // modificado por mentalidad ofensiva en la Etapa 5
    };
}


// Escalar de fuerza que "ve" el motor: media de las tres áreas. Es la métrica
// con la que se bucketean los partidos en la simulación de balance (§33).
// NO se usa la Valoración: en la Etapa 5 la fuerza efectiva depende del rival
// (matriz de contras) y la Valoración deja de ser predictiva por diseño.
export function fuerzaEfectivaMedia(equipo, equipoRival) {
    const f = fuerzaEfectiva(equipo, equipoRival);
    return (f.ataque + f.medio + f.defensa) / 3;
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

    for (let i = 0; i < nPosesiones; i++) {
        const minuto = Math.floor((i / nPosesiones) * 90) + Math.floor(rand() * 3);

        // FASE 1 — duelo de mediocampo: ¿quién ataca?
        const atacaA = rand() < probabilidadDuelo(fA.medio, fB.medio);

        const atk = atacaA ? fA : fB;
        const def = atacaA ? fB : fA;
        const equipoAtacante = atacaA ? equipoA : equipoB;

        // FASE 2 — ¿se genera ocasión?
        if (rand() < probabilidadDuelo(atk.ataque, def.defensa) * atk.frecuencia) {
            const calidad = atk.ataque * (0.8 + rand() * 0.4) * atk.calidadOcasion;

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
