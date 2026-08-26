// ==========================================
// PARTIDO vs IA (§29, §30, §31, §53.1)
// ==========================================
//
// Orquesta un partido contra la IA: arma el rival, corre el motor, deriva las
// estadísticas (§29) y el MVP (§30), y arma el registro reproducible (§53.1).
//
// jugarPartido() es PURO (no toca el estado ni localStorage): sirve headless.
// Las funciones de más abajo (construirEquipoUsuario, jugarContraIA, reVerificar)
// son las que usa la UI y sí leen el estado.

import { JUGADORES } from "../data/jugadores.js";
import { simularPartido, fuerzaEquipo } from "./motor.js";
import { generarRivalIA } from "./rivalIA.js";
import { scoreAtaque, scoreDefensor, scoreArquero } from "./formulas.js";
import { FORMACION_DEFAULT } from "../config/formaciones.js";
import { MENTALIDAD_OF_DEFAULT, MENTALIDAD_DEF_DEFAULT } from "../config/mentalidades.js";


// Catálogo id → jugador (para re-verificar partidos desde ids guardados).
const CATALOGO = new Map(JUGADORES.map(j => [j.id, j]));

function mediaAreas(areas) {
    return (areas.ataque + areas.medio + areas.defensa) / 3;
}

function redondear1(x) {
    return Math.round(x * 10) / 10;
}


// ==========================================
// ESTADÍSTICAS DEL PARTIDO (§29)
// ==========================================
//
// Derivadas de los eventos. El motor V1 solo produce GOL / ATAJADA /
// ATAQUE_CORTADO, así que: posesión (cuota de posesiones), llegadas al arco
// (GOL + ATAJADA) y goles. No hay tiros desviados en V1 (serían V1.5).

export function derivarEstadisticas(eventos, idUsuario, idRival) {
    let posU = 0, posR = 0, llU = 0, llR = 0;

    for (const e of eventos) {
        const esUsuario = e.equipo === idUsuario;
        if (esUsuario) posU++; else posR++;
        if (e.tipo === "GOL" || e.tipo === "ATAJADA") {
            if (esUsuario) llU++; else llR++;
        }
    }

    const total = eventos.length || 1;
    const posesionUsuario = Math.round((100 * posU) / total);

    return {
        posesionUsuario,
        posesionRival: 100 - posesionUsuario,
        llegadasUsuario: llU,
        llegadasRival: llR
    };
}


// ==========================================
// MVP DEL PARTIDO (§30)
// ==========================================
//
// Puntaje: Goles ×10 · Atajadas ×3. Asistencias (×6) y Recuperaciones (×2)
// son eventos de V1.5/V2 que el motor todavía NO produce → suman 0 (no es un
// olvido; ver ESTADO.md). El MVP puede ser un jugador del rival.

export function calcularMVP(eventos, equipoUsuario, equipoRival) {
    const stats = new Map(); // clave: "equipoId:playerId"

    const registrar = (equipo, jugadores) => {
        for (const j of jugadores) {
            stats.set(`${equipo.id}:${j.id}`, {
                player: j,
                equipoId: equipo.id,
                equipoNombre: equipo.nombre || equipo.id,
                goles: 0,
                atajadas: 0
            });
        }
    };
    const todos = e => [e.arquero, ...e.defensores, ...e.medios, ...e.delanteros];
    registrar(equipoUsuario, todos(equipoUsuario));
    registrar(equipoRival, todos(equipoRival));

    for (const e of eventos) {
        if (e.tipo === "GOL") {
            const k = `${e.equipo}:${e.autor}`;
            if (stats.has(k)) stats.get(k).goles++;
        } else if (e.tipo === "ATAJADA") {
            // La atajada la hizo el arquero del equipo que DEFENDÍA (el opuesto
            // al que atacó en esa posesión).
            const defensor = e.equipo === equipoUsuario.id ? equipoRival : equipoUsuario;
            const k = `${defensor.id}:${defensor.arquero.id}`;
            if (stats.has(k)) stats.get(k).atajadas++;
        }
    }

    // Puntaje + desempate por score según posición.
    const tiebreak = (j) => {
        if (j.position === "POR") return scoreArquero(j);
        if (j.position === "DEF") return scoreDefensor(j);
        return scoreAtaque(j);
    };

    let mejor = null;
    for (const s of stats.values()) {
        s.puntos = s.goles * 10 + s.atajadas * 3;
        if (
            !mejor ||
            s.puntos > mejor.puntos ||
            (s.puntos === mejor.puntos && tiebreak(s.player) > tiebreak(mejor.player))
        ) {
            mejor = s;
        }
    }

    return {
        id: mejor.player.id,
        nombre: mejor.player.name,
        posicion: mejor.player.position,
        equipoId: mejor.equipoId,
        equipoNombre: mejor.equipoNombre,
        goles: mejor.goles,
        atajadas: mejor.atajadas,
        puntos: mejor.puntos
    };
}


// ==========================================
// PREPARAR PARTIDO (genera rival + semilla, NO simula)
// ==========================================
//
// Se usa para mostrar la pantalla de comparación ANTES de jugar. La UI muestra
// el rival preparado y recién al confirmar llama a resolverPartido().

export function prepararPartido(equipoUsuario, dificultad, opciones = {}) {
    const usuario = { ...equipoUsuario, id: "USUARIO", nombre: "Tu equipo" };
    const rand = opciones.randRival ?? Math.random;

    // Calidad base del usuario (sin táctica): con esto se calibra el rival.
    const areasUsuario = fuerzaEquipo(usuario);
    const fuerzaUsuario = mediaAreas(areasUsuario);
    const rival = generarRivalIA(fuerzaUsuario, dificultad, rand);
    const semilla = opciones.semilla ?? Math.floor(rand() * 0x7fffffff);

    return { usuario, dificultad, areasUsuario, fuerzaUsuario, rival, semilla };
}


// ==========================================
// RESOLVER PARTIDO (simula un partido preparado)
// ==========================================
//
// Devuelve el registro completo (NO lo guarda).

export function resolverPartido(prep) {
    const { usuario, dificultad, areasUsuario, fuerzaUsuario, rival, semilla } = prep;

    const r = simularPartido(usuario, rival.equipo, semilla);
    const golesUsuario = r.golesA;
    const golesRival = r.golesB;

    const stats = derivarEstadisticas(r.eventos, usuario.id, rival.equipo.id);
    const mvp = calcularMVP(r.eventos, usuario, rival.equipo);

    const resultado = golesUsuario > golesRival ? "V"
        : golesUsuario < golesRival ? "D" : "E";

    // Se guardan también la formación y las mentalidades: sin ellas, re-simular
    // desde los ids daría OTRO marcador (la Fuerza Efectiva depende de la táctica).
    const ids = (e) => ({
        arquero: e.arquero.id,
        defensores: e.defensores.map(j => j.id),
        medios: e.medios.map(j => j.id),
        delanteros: e.delanteros.map(j => j.id),
        formacion: e.formacion || FORMACION_DEFAULT,
        mentalidadOfensiva: e.mentalidadOfensiva || MENTALIDAD_OF_DEFAULT,
        mentalidadDefensiva: e.mentalidadDefensiva || MENTALIDAD_DEF_DEFAULT
    });

    return {
        id: Date.now() + "-" + Math.floor(Math.random() * 1e6),
        fecha: new Date().toISOString(),
        dificultad,
        semilla,
        rivalNombre: rival.nombre,
        offsetSolicitado: rival.offsetSolicitado,
        offsetReal: redondear1(rival.offsetReal),
        capado: rival.capado,
        golesUsuario,
        golesRival,
        resultado,
        fuerzaUsuario: {
            ataque: redondear1(areasUsuario.ataque),
            medio: redondear1(areasUsuario.medio),
            defensa: redondear1(areasUsuario.defensa),
            media: redondear1(fuerzaUsuario)
        },
        fuerzaRival: {
            ataque: redondear1(rival.areas.ataque),
            medio: redondear1(rival.areas.medio),
            defensa: redondear1(rival.areas.defensa),
            media: redondear1(rival.fuerzaMedia)
        },
        equipoUsuarioIds: ids(usuario),
        equipoRivalIds: ids(rival.equipo),
        // Táctica de ambos, para el análisis post-partido (§19.5). La del rival
        // recién se REVELA acá, después de jugar; nunca antes.
        tactica: {
            usuario: {
                formacion: usuario.formacion || FORMACION_DEFAULT,
                mentalidadOfensiva: usuario.mentalidadOfensiva || MENTALIDAD_OF_DEFAULT,
                mentalidadDefensiva: usuario.mentalidadDefensiva || MENTALIDAD_DEF_DEFAULT
            },
            rival: {
                formacion: rival.formacion,
                mentalidadOfensiva: rival.mentalidadOfensiva,
                mentalidadDefensiva: rival.mentalidadDefensiva
            }
        },
        mvp,
        estadisticas: stats,
        eventos: r.eventos
    };
}


// ==========================================
// JUGAR PARTIDO (preparar + resolver, puro/headless)
// ==========================================

export function jugarPartido(equipoUsuario, dificultad, opciones = {}) {
    return resolverPartido(prepararPartido(equipoUsuario, dificultad, opciones));
}


// ==========================================
// RE-VERIFICAR UN PARTIDO (§53.1)
// ==========================================
//
// Reconstruye ambos equipos desde los ids guardados y re-simula con la semilla.
// Debe dar el mismo marcador.

function equipoDesdeIds(ids, id) {
    return {
        id,
        arquero: CATALOGO.get(ids.arquero),
        defensores: ids.defensores.map(i => CATALOGO.get(i)),
        medios: ids.medios.map(i => CATALOGO.get(i)),
        delanteros: ids.delanteros.map(i => CATALOGO.get(i)),
        // Restaurar la táctica es imprescindible para reproducir el marcador.
        formacion: ids.formacion || FORMACION_DEFAULT,
        mentalidadOfensiva: ids.mentalidadOfensiva || MENTALIDAD_OF_DEFAULT,
        mentalidadDefensiva: ids.mentalidadDefensiva || MENTALIDAD_DEF_DEFAULT
    };
}

export function reVerificar(registro) {
    const usuario = equipoDesdeIds(registro.equipoUsuarioIds, "USUARIO");
    const rival = equipoDesdeIds(registro.equipoRivalIds, "IA");
    const r = simularPartido(usuario, rival, registro.semilla);
    return {
        golesUsuario: r.golesA,
        golesRival: r.golesB,
        coincide: r.golesA === registro.golesUsuario && r.golesB === registro.golesRival
    };
}
