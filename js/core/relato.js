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
import { PLANTILLAS, INICIO, ENTRETIEMPO, SEGUNDO_TIEMPO } from "../data/plantillasRelato.js";

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
    // "Tu equipo" en vs IA; en torneo/amistoso llega el nombre real del equipo.
    const nombreUsuario = registro.nombreUsuario || "Tu equipo";
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

    // Marco del entretiempo (post-Etapa 10): se inserta una sola vez, justo
    // antes del primer evento de la segunda mitad. Si el partido no tuviera
    // ningún evento a partir del 45' (raro), se inserta igual antes del FINAL.
    let entretiempoInsertado = false;
    const insertarEntretiempo = () => {
        if (entretiempoInsertado) return;
        entretiempoInsertado = true;
        lineas.push({ minuto: 45, tipo: "ENTRETIEMPO", esGol: false, equipoId: null, texto: elegir(ENTRETIEMPO) });
        lineas.push({ minuto: 45, tipo: "SEGUNDO_TIEMPO", esGol: false, equipoId: null, texto: elegir(SEGUNDO_TIEMPO) });
    };

    // Una línea por evento.
    for (const e of registro.eventos) {
        if (e.minuto >= 45) insertarEntretiempo();

        const atacaUsuario = e.equipo === "USUARIO";
        const equipoAtacante = atacaUsuario ? usuario : rival;
        const equipoDefensor = atacaUsuario ? rival : usuario;
        const nombreAtacante = atacaUsuario ? nombreUsuario : nombreRival;

        let texto;
        if (e.tipo === "GOL") {
            const goleador = CATALOGO.get(e.autor);
            const plantillas = e.esPenal ? PLANTILLAS.PENAL_GOL : PLANTILLAS.GOL;
            texto = elegir(plantillas)
                .replace("{GOLEADOR}", goleador ? goleador.name : "el delantero")
                .replace("{EQUIPO}", nombreAtacante);
        } else if (e.tipo === "ATAJADA") {
            const plantillas = e.esPenal ? PLANTILLAS.PENAL_ATAJADO : PLANTILLAS.ATAJADA;
            texto = elegir(plantillas)
                .replace("{ARQUERO}", equipoDefensor.arquero.name)
                .replace("{ATACANTE}", atacantePeligro(equipoAtacante).name);
        } else if (e.tipo === "TARJETA_AMARILLA") {
            const jugador = CATALOGO.get(e.autor);
            texto = elegir(PLANTILLAS.TARJETA_AMARILLA)
                .replace("{JUGADOR}", jugador ? jugador.name : "el jugador");
        } else if (e.tipo === "TARJETA_ROJA") {
            const jugador = CATALOGO.get(e.autor);
            const plantillas = e.segundaAmarilla ? PLANTILLAS.TARJETA_ROJA_DOBLE : PLANTILLAS.TARJETA_ROJA_DIRECTA;
            texto = elegir(plantillas)
                .replace("{JUGADOR}", jugador ? jugador.name : "el jugador");
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

    insertarEntretiempo();   // por si ningún evento llegó a la segunda mitad

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
