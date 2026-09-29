// ==========================================
// RE-VERIFICACIÓN DE PARTIDOS (§53.1) — lado servidor
// ==========================================
//
// Reconstruye ambos equipos desde los ids guardados en el registro y re-simula
// con la misma semilla. El motor es determinista (mulberry32, §23), así que el
// marcador tiene que dar EXACTAMENTE igual. Si no coincide, el cliente mintió el
// resultado (§53).
//
// Es un subconjunto de core/partido.js del cliente: acá NO se genera el rival ni
// se arma el relato, solo se re-simula lo que el cliente dice que jugó.

import { simularPartido } from "./motor.js";
import { JUGADORES } from "../data/jugadores.js";
import { FORMACION_DEFAULT, conCategorias } from "../config/formaciones.js";
import { MENTALIDAD_OF_DEFAULT, MENTALIDAD_DEF_DEFAULT } from "../config/mentalidades.js";


const CATALOGO = new Map(JUGADORES.map(j => [j.id, j]));


// Reconstruye un equipo del formato del motor a partir de los ids guardados.
// Lanza si algún id no existe en el catálogo (registro adulterado). conCategorias
// (D1, post-Etapa 10) adosa la categoría esperada de sub-posición por ÍNDICE,
// igual que el cliente (core/partido.js) — mismo orden siempre, el de
// slotsDeFormacion — o el marcador re-simulado acá no va a coincidir con el
// que ya vio el cliente.
function equipoDesdeIds(ids, id) {
    const buscar = (i) => {
        const j = CATALOGO.get(i);
        if (!j) throw new Error(`Jugador inexistente en el catálogo: ${i}`);
        return j;
    };
    return {
        id,
        arquero: buscar(ids.arquero),
        defensores: conCategorias(ids.defensores.map(buscar), "DEF"),
        medios:     conCategorias(ids.medios.map(buscar), "MED"),
        delanteros: conCategorias(ids.delanteros.map(buscar), "DEL"),
        formacion: ids.formacion || FORMACION_DEFAULT,
        mentalidadOfensiva: ids.mentalidadOfensiva || MENTALIDAD_OF_DEFAULT,
        mentalidadDefensiva: ids.mentalidadDefensiva || MENTALIDAD_DEF_DEFAULT
    };
}


// Re-simula el partido del registro. Devuelve el marcador RE-CALCULADO por el
// servidor (la fuente de verdad) y si coincide con lo que trajo el cliente.
export function reVerificar(registro) {
    const usuario = equipoDesdeIds(registro.equipoUsuarioIds, "USUARIO");
    const rival = equipoDesdeIds(registro.equipoRivalIds, "IA");
    const r = simularPartido(usuario, rival, registro.semilla);

    // El resultado (V/E/D) se deriva del marcador RE-SIMULADO, nunca de lo que
    // dijo el cliente.
    const resultado = r.golesA > r.golesB ? "V"
        : r.golesA < r.golesB ? "D" : "E";

    return {
        golesUsuario: r.golesA,
        golesRival: r.golesB,
        resultado,
        coincide: r.golesA === registro.golesUsuario && r.golesB === registro.golesRival
    };
}
