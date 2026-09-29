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
// CATEGORÍA DE SUB-POSICIÓN POR SLOT (§18 ampliado, D1, post-Etapa 10)
// ==========================================
//
// De qué lado de la cancha se espera que juegue cada slot dentro de su línea:
// CENTRAL, IZQUIERDA o DERECHA. DEF y MED comparten el mismo patrón según la
// cantidad de jugadores en la línea (una línea de 3 es "toda central" — el
// fútbol real no tiene laterales en una defensa/mediocampo de 3, esos
// espacios los cubren los carrileros, que en este juego caen en la línea de
// al lado); DEL tiene patrón propio (un ataque de 2 son dos centrodelanteros,
// sin puntas — las puntas solo aparecen en un ataque de 3). El orden va de
// izquierda a derecha tal como se dibuja en la cancha (construirCancha en
// ui/equipo.js: mismo orden de slots, mismo orden visual).
const CATEGORIAS_DEF_MED = {
    3: ["CENTRAL", "CENTRAL", "CENTRAL"],
    4: ["IZQUIERDA", "CENTRAL", "CENTRAL", "DERECHA"],
    5: ["IZQUIERDA", "CENTRAL", "CENTRAL", "CENTRAL", "DERECHA"]
};
const CATEGORIAS_DEL = {
    1: ["CENTRAL"],
    2: ["CENTRAL", "CENTRAL"],
    3: ["IZQUIERDA", "CENTRAL", "DERECHA"]
};

// Categorías de una línea (POR no tiene sub-posición: devuelve null).
export function categoriasLinea(position, cantidad) {
    if (position === "POR") return null;
    if (position === "DEL") return CATEGORIAS_DEL[cantidad] || CATEGORIAS_DEL[1];
    return CATEGORIAS_DEF_MED[cantidad] || null;
}


// ==========================================
// SLOTS DE UNA FORMACIÓN
// ==========================================
//
// Genera la lista de slots (id + posición + categoría) de una formación, de
// arriba hacia abajo. Ej. 4-3-3 → [del1,del2,del3, med1,med2,med3,
// def1..def4, por1]. Los ids son deterministas: así, al cambiar de
// formación, los jugadores que siguen entrando conservan su slot.

export function slotsDeFormacion(clave) {
    const f = FORMACIONES[clave] || FORMACIONES[FORMACION_DEFAULT];
    const lista = [];

    for (const pos of ORDEN_LINEAS) {
        const cantidad = f.slots[pos];
        const categorias = categoriasLinea(pos, cantidad);
        for (let i = 1; i <= cantidad; i++) {
            lista.push({
                slot: `${PREFIJO_SLOT[pos]}${i}`,
                position: pos,
                categoria: categorias ? categorias[i - 1] : null
            });
        }
    }

    return lista;
}


// Adosa la categoría esperada de sub-posición (D1) a cada jugador de una
// línea YA ARMADA como array plano (típicamente rehidratada desde ids
// guardados, sin el string de slot original). Asume que el array está en el
// MISMO ORDEN que produce slotsDeFormacion para esa línea — así se arman
// siempre los equipos del motor (construirEquipoUsuario, equipoDesdeIds,
// construirEquipoDesdeTeam, etc.), tanto acá como en el servidor, o la
// Fuerza Efectiva re-simulada no va a coincidir con la ya jugada.
export function conCategorias(jugadores, position) {
    const cats = categoriasLinea(position, jugadores.length) || [];
    return jugadores.map((j, i) => ({ ...j, _categoriaSlot: cats[i] || null }));
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
