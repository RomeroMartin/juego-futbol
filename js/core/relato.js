// ==========================================
// RELATO DEL PARTIDO (§28)
// ==========================================
//
// Convierte los eventos ya calculados de un partido en un relato con minutos y
// nombres reales del XI. Es PURA PRESENTACIÓN: no toca el motor ni recalcula
// nada. Reconstruye los nombres desde los ids guardados en el registro, así
// que también funciona para re-ver un partido del historial.
//
// Usa un PRNG sembrado desde la semilla del partido (independiente del stream
// del motor) para elegir plantillas: el mismo partido se relata siempre igual.

import { JUGADORES } from "../data/jugadores.js";
import { mulberry32 } from "./prng.js";
import { PLANTILLAS, INICIO } from "../data/plantillasRelato.js";

const CATALOGO = new Map(JUGADORES.map(j => [j.id, j]));

function equipoDesdeIds(ids) {
    return {
        arquero: CATALOGO.get(ids.arquero),
        defensores: ids.defensores.map(i => CATALOGO.get(i)),
        medios: ids.medios.map(i => CATALOGO.get(i)),
        delanteros: ids.delanteros.map(i => CATALOGO.get(i))
    };
}


// Genera el relato como array de líneas: { minuto, tipo, texto, esGol, equipoId }.
export function generarRelato(registro) {
    const usuario = equipoDesdeIds(registro.equipoUsuarioIds);
    const rival = equipoDesdeIds(registro.equipoRivalIds);
    const nombreUsuario = "Tu equipo";
    const nombreRival = registro.rivalNombre;

    // Stream de PRNG propio del relato (separado del motor).
    const rand = mulberry32((registro.semilla ^ 0x9e3779b9) >>> 0);
    const elegir = (arr) => arr[Math.floor(rand() * arr.length)];
    // Atacante "de peligro": delanteros y mediocampistas.
    const atacantePeligro = (equipo) => {
        const cand = [...equipo.delanteros, ...equipo.medios];
        return cand[Math.floor(rand() * cand.length)];
    };

    const lineas = [];

    // Línea de inicio.
    lineas.push({
        minuto: 0,
        tipo: "INICIO",
        esGol: false,
        equipoId: null,
        texto: elegir(INICIO)
            .replace("{USUARIO}", nombreUsuario)
            .replace("{RIVAL}", nombreRival)
    });

    // Una línea por evento.
    for (const e of registro.eventos) {
        const atacaUsuario = e.equipo === "USUARIO";
        const equipoAtacante = atacaUsuario ? usuario : rival;
        const equipoDefensor = atacaUsuario ? rival : usuario;
        const nombreAtacante = atacaUsuario ? nombreUsuario : nombreRival;

        let texto;
        if (e.tipo === "GOL") {
            const goleador = CATALOGO.get(e.autor);
            texto = elegir(PLANTILLAS.GOL)
                .replace("{GOLEADOR}", goleador ? goleador.name : "el delantero")
                .replace("{EQUIPO}", nombreAtacante);
        } else if (e.tipo === "ATAJADA") {
            texto = elegir(PLANTILLAS.ATAJADA)
                .replace("{ARQUERO}", equipoDefensor.arquero.name)
                .replace("{ATACANTE}", atacantePeligro(equipoAtacante).name);
        } else { // ATAQUE_CORTADO
            const defensor = equipoDefensor.defensores[
                Math.floor(rand() * equipoDefensor.defensores.length)
            ];
            texto = elegir(PLANTILLAS.ATAQUE_CORTADO)
                .replace("{DEFENSOR}", defensor.name)
                .replace("{ATACANTE}", atacantePeligro(equipoAtacante).name);
        }

        lineas.push({
            minuto: e.minuto,
            tipo: e.tipo,
            esGol: e.tipo === "GOL",
            equipoId: e.equipo,
            texto
        });
    }

    // Línea de final con el marcador.
    lineas.push({
        minuto: 90,
        tipo: "FINAL",
        esGol: false,
        equipoId: null,
        texto: `Final del partido: ${nombreUsuario} ${registro.golesUsuario} - ${registro.golesRival} ${nombreRival}.`
    });

    return lineas;
}
