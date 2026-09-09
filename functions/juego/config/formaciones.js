// ==========================================
// FORMACIONES COMO DATO (§17)
// ==========================================
//
// Las formaciones se modelan como datos, no como código: agregar una formación
// es agregar una entrada a este objeto (§17). Los valores (slots, amplitud,
// densidadCentral, mod) son los de §17 verbatim.
//
// Los dos ejes tácticos (§17):
//  - amplitud (0–100): cuánto usa el equipo los costados.
//  - densidadCentral (0–100): cuánta gente hay en el corredor central.
// Ambos entran en juego en la compatibilidad estructural formación ↔ mentalidad
// (§19.4). `mod` es el modificador plano de formación que se suma a cada área
// ANTES de las mentalidades (§20.5).

export const FORMACIONES = {
    "4-3-3":   { slots: { POR: 1, DEF: 4, MED: 3, DEL: 3 }, amplitud: 70, densidadCentral: 45, mod: { ataque: +3, medio:  0, defensa:  0 } },
    "4-4-2":   { slots: { POR: 1, DEF: 4, MED: 4, DEL: 2 }, amplitud: 60, densidadCentral: 60, mod: { ataque: -2, medio: +4, defensa: +2 } },
    "4-2-3-1": { slots: { POR: 1, DEF: 4, MED: 5, DEL: 1 }, amplitud: 50, densidadCentral: 70, mod: { ataque: -5, medio: +7, defensa: +3 } },
    "3-5-2":   { slots: { POR: 1, DEF: 3, MED: 5, DEL: 2 }, amplitud: 40, densidadCentral: 80, mod: { ataque: +2, medio: +5, defensa: -6 } },
    "3-4-3":   { slots: { POR: 1, DEF: 3, MED: 4, DEL: 3 }, amplitud: 75, densidadCentral: 50, mod: { ataque: +7, medio: +2, defensa: -9 } },
    "5-3-2":   { slots: { POR: 1, DEF: 5, MED: 3, DEL: 2 }, amplitud: 45, densidadCentral: 65, mod: { ataque: -7, medio: -2, defensa: +9 } }
};


// Formación por defecto (la del hito de Etapa 4).
export const FORMACION_DEFAULT = "4-3-3";

// Lista ordenada de claves, para poblar selectores y elegir al azar (IA).
export const CLAVES_FORMACION = Object.keys(FORMACIONES);


// Orden de líneas en la cancha, de arriba (ataque) hacia abajo (arco).
const ORDEN_LINEAS = ["DEL", "MED", "DEF", "POR"];

// Prefijo de slot por posición (los ids de slot son estables: def1, med2, ...).
const PREFIJO_SLOT = { POR: "por", DEF: "def", MED: "med", DEL: "del" };


// ==========================================
// SLOTS DE UNA FORMACIÓN
// ==========================================
//
// Genera la lista de slots (id + posición) de una formación, de arriba hacia
// abajo. Ej. 4-3-3 → [del1,del2,del3, med1,med2,med3, def1..def4, por1].
// Los ids son deterministas: así, al cambiar de formación, los jugadores que
// siguen entrando conservan su slot.

export function slotsDeFormacion(clave) {
    const f = FORMACIONES[clave] || FORMACIONES[FORMACION_DEFAULT];
    const lista = [];

    for (const pos of ORDEN_LINEAS) {
        const cantidad = f.slots[pos];
        for (let i = 1; i <= cantidad; i++) {
            lista.push({ slot: `${PREFIJO_SLOT[pos]}${i}`, position: pos });
        }
    }

    return lista;
}


// Objeto de equipo vacío (todos los slots en null) para una formación.
export function equipoVacioDeFormacion(clave) {
    const vacio = {};
    for (const { slot } of slotsDeFormacion(clave)) {
        vacio[slot] = null;
    }
    return vacio;
}


// ==========================================
// VALIDACIÓN DEL XI (§17.1) — GENÉRICA
// ==========================================
//
// PURA: recibe un array de jugadores (con `id` y `position`) y la clave de
// formación. Devuelve { valido, error?, pos?, faltan? }. Debe cumplir EXACTO
// los slots de la formación elegida.

export function validarXI(xi, clave) {
    const req = (FORMACIONES[clave] || FORMACIONES[FORMACION_DEFAULT]).slots;
    const conteo = { POR: 0, DEF: 0, MED: 0, DEL: 0 };
    const idsVistos = new Set();

    for (const j of xi) {
        if (idsVistos.has(j.id)) {
            return { valido: false, error: "JUGADOR_DUPLICADO" };
        }
        idsVistos.add(j.id);
        conteo[j.position]++;
    }

    for (const pos of ["POR", "DEF", "MED", "DEL"]) {
        if (conteo[pos] !== req[pos]) {
            return {
                valido: false,
                error: "POSICIONES_INCORRECTAS",
                pos,
                faltan: req[pos] - conteo[pos]
            };
        }
    }

    return { valido: true };
}
