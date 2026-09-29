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
    calcularAtaqueTactico,
    calcularMediocampoTactico,
    calcularDefensaTactico,
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

export function fuerzaEfectiva(equipo, equipoRival, extra = null) {
    const f = FORMACIONES[equipo.formacion] || FORMACIONES[FORMACION_DEFAULT];

    const claveOf  = equipo.mentalidadOfensiva  || MENTALIDAD_OF_DEFAULT;
    const claveDef = equipo.mentalidadDefensiva || MENTALIDAD_DEF_DEFAULT;
    const of  = MENTALIDADES_OF[claveOf]  || MENTALIDADES_OF[MENTALIDAD_OF_DEFAULT];
    const def = MENTALIDADES_DEF[claveDef] || MENTALIDADES_DEF[MENTALIDAD_DEF_DEFAULT];

    const claveRivalDef = equipoRival.mentalidadDefensiva || MENTALIDAD_DEF_DEFAULT;
    const rivalDef = MENTALIDADES_DEF[claveRivalDef] || MENTALIDADES_DEF[MENTALIDAD_DEF_DEFAULT];

    // 0. Stats base (YA con la penalización de fuera de posición, D1: la
    // ubicación en la cancha es táctica, igual que la formación y la
    // mentalidad) + modificador plano de formación (§20.5).
    let ataque  = calcularAtaqueTactico(equipo.delanteros)                  + f.mod.ataque;
    let medio   = calcularMediocampoTactico(equipo.medios)                  + f.mod.medio;
    let defensa = calcularDefensaTactico(equipo.defensores, equipo.arquero) + f.mod.defensa;

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

    // 4. Bono/penalización FIJO adicional (ej. localía en torneos ida y vuelta,
    // post-Etapa 10): se suma al final, DESPUÉS de todos los multiplicadores,
    // como un empujón chico y constante — no un factor que se agranda con el
    // resto de la táctica. `null` (default) para cualquier partido que no lo
    // pida explícitamente: vs IA, amistosos y torneos a una sola vuelta.
    if (extra) {
        ataque  += extra.ataque  || 0;
        medio   += extra.medio   || 0;
        defensa += extra.defensa || 0;
    }

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
// PENAL — pateador (Grupo E, post-Etapa 10)
// ==========================================
//
// El pateador NO se sortea (a diferencia del goleador de juego): es el
// delantero con mejor `shooting` (la stat de "definición"). Toda formación
// tiene al menos 1 delantero (§17), así que `delanteros` nunca está vacío.

export function mejorPateador(equipo) {
    return equipo.delanteros.reduce(
        (mejor, j) => (j.shooting > mejor.shooting ? j : mejor),
        equipo.delanteros[0]
    );
}


// ==========================================
// TARJETAS — jugador que comete la falta (Grupo E, post-Etapa 10)
// ==========================================
//
// Uniforme entre los jugadores de campo (sin el arquero) del equipo que
// defiende esa posesión. Consume exactamente una tirada del PRNG.

export function elegirJugadorFalta(equipo, rand) {
    const candidatos = [...equipo.defensores, ...equipo.medios, ...equipo.delanteros];
    return candidatos[Math.floor(rand() * candidatos.length)];
}


// ==========================================
// SIMULACIÓN DEL PARTIDO (§24, §25)
// ==========================================
//
// Por posesiones. Cada posesión: duelo de mediocampo → ¿ocasión? → ¿gol?
// El orden de consumo del PRNG es fijo, lo que garantiza reproducibilidad
// byte por byte para una misma semilla.

export function simularPartido(equipoA, equipoB, semilla, opciones = null) {
    const rand = mulberry32(semilla);

    const fA = fuerzaEfectiva(equipoA, equipoB, opciones?.extraA);
    const fB = fuerzaEfectiva(equipoB, equipoA, opciones?.extraB);

    let golesA = 0;
    let golesB = 0;
    const eventos = [];

    // Tarjetas por jugador en ESTE partido (Grupo E, post-Etapa 10): id →
    // cantidad de amarillas (1 = ya tiene una; al llegar a la 2ª es roja).
    // `rojaAplicada` asegura que la penalización de jugar con uno menos se
    // sume UNA sola vez por equipo, aunque haya más de una expulsión.
    const tarjetasA = new Map();
    const tarjetasB = new Map();
    let rojaAplicadaA = false;
    let rojaAplicadaB = false;

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
        const equipoDefensor = atacaA ? equipoB : equipoA;

        // FASE 2 — ¿se genera ocasión?
        if (rand() < probabilidadDuelo(atk.ataque, def.defensa) * atk.frecuencia) {
            // Penal (Grupo E, post-Etapa 10): una fracción chica de las
            // ocasiones generadas se resuelven como penal en vez de remate
            // normal — pateador fijo (mejor definición) contra el arquero.
            if (rand() < MOTOR.PROB_PENAL) {
                const pateador = mejorPateador(equipoAtacante);
                const probConversion = MOTOR.PENAL_PISO
                    + probabilidadDuelo(scoreAtaque(pateador), def.arquero) * MOTOR.PENAL_RANGO;

                if (rand() < probConversion) {
                    if (atacaA) golesA++; else golesB++;
                    eventos.push({
                        minuto, tipo: "GOL", equipo: equipoAtacante.id,
                        autor: pateador.id, esPenal: true
                    });
                } else {
                    eventos.push({ minuto, tipo: "ATAJADA", equipo: equipoAtacante.id, esPenal: true });
                }
            } else {
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
            }
        } else {
            eventos.push({ minuto, tipo: "ATAQUE_CORTADO", equipo: equipoAtacante.id });
        }

        // Tarjetas (Grupo E, post-Etapa 10): se evalúan siempre, contra quien
        // defendió esta posesión (gane o pierda la pelota).
        const mentDefDefensor = equipoDefensor.mentalidadDefensiva || MENTALIDAD_DEF_DEFAULT;
        const probTarjeta = MOTOR.PROB_TARJETA
            * (mentDefDefensor === "PRESION_ALTA" ? MOTOR.MULT_TARJETA_PRESION : 1);

        if (rand() < probTarjeta) {
            const jugador = elegirJugadorFalta(equipoDefensor, rand);
            const esA = equipoDefensor === equipoA;
            const mapaTarjetas = esA ? tarjetasA : tarjetasB;
            const yaAmarillo = mapaTarjetas.get(jugador.id) === 1;
            const esRojaDirecta = !yaAmarillo && rand() < MOTOR.PROB_ROJA_DIRECTA;

            if (yaAmarillo || esRojaDirecta) {
                mapaTarjetas.set(jugador.id, 2);
                eventos.push({
                    minuto, tipo: "TARJETA_ROJA", equipo: equipoDefensor.id,
                    autor: jugador.id, segundaAmarilla: yaAmarillo
                });
                if (esA && !rojaAplicadaA) {
                    rojaAplicadaA = true;
                    fA.ataque *= MOTOR.PENALIZACION_ROJA;
                    fA.medio *= MOTOR.PENALIZACION_ROJA;
                    fA.defensa *= MOTOR.PENALIZACION_ROJA;
                } else if (!esA && !rojaAplicadaB) {
                    rojaAplicadaB = true;
                    fB.ataque *= MOTOR.PENALIZACION_ROJA;
                    fB.medio *= MOTOR.PENALIZACION_ROJA;
                    fB.defensa *= MOTOR.PENALIZACION_ROJA;
                }
            } else {
                mapaTarjetas.set(jugador.id, 1);
                eventos.push({ minuto, tipo: "TARJETA_AMARILLA", equipo: equipoDefensor.id, autor: jugador.id });
            }
        }
    }

    return { golesA, golesB, eventos, semilla };
}
