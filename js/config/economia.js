// ==========================================
// CONFIGURACIÓN DE ECONOMÍA (§13, §14, §15.7)
// ==========================================
//
// Todos los valores de balance económico viven acá, nunca desparramados por el
// código. Ajustar el balance debe ser cambiar un número en este archivo.
//
// La Etapa 6 activa la economía completa: paquetes de bienvenida, pity,
// probabilidades de rareza, Fichas, tienda, venta de repetidos y el contador de
// puntos con su Pack PREMIUM.
//
// 🔑 CLAVE CANÓNICA DE RAREZA: "COMUN" (sin tilde ni Ñ), igual que el dataset
// (`js/data/jugadores.js`, campo `rarity`). La tilde ("COMÚN") existe SOLO en
// las etiquetas que ve el usuario (ETIQUETA_RAREZA). Si en el código se compara
// contra "COMÚN" con tilde, no matchea nada y el bug es silencioso.

export const ECONOMIA = {
    paquetesBienvenida: 5,
    sobrePorPartidoTorneo: true,
    minParticipantesParaSobre: 4,
    puntosParaPack: 50,
    puntos: {
        torneo:   { victoria: 3, empate: 1, derrota: 0 },
        amistoso: { victoria: 3, empate: 1, derrota: 0 },
        ia:       { victoria: 0, empate: 0, derrota: 0 }   // la IA nunca suma puntos
    },
    topeAmistososConPuntosPorDia: 3,   // los torneos no necesitan tope
    packRecompensa: { cantidad: 3, tipo: "PREMIUM" },
    fichas: { porPartido: 10, porVictoria: 25, porEmpate: 10, primeroDelDia: 50 },
    precios: { BASICO: 300, PREMIUM: 1200, POSICIONAL: 500 },

    // ------------------------------------------
    // Paquetes: tamaño y tipos (§14, §15.5)
    // ------------------------------------------
    jugadoresPorPaquete: 6,

    // Cada tipo de paquete define qué garantiza al abrirse.
    //   - garantizaRareza: rareza MÍNIMA garantizada en al menos una carta.
    //   - posicionElegible: el usuario elige una posición al ABRIRLO y las 6
    //     cartas son de esa posición (§15.5, "de una posición a elegir").
    tiposPaquete: {
        BASICO:     { garantizaRareza: null,        posicionElegible: false },
        PREMIUM:    { garantizaRareza: "DESTACADO", posicionElegible: false },
        POSICIONAL: { garantizaRareza: null,        posicionElegible: true }
    },

    // ------------------------------------------
    // Probabilidades de rareza POR CARTA (§14)
    // ------------------------------------------
    // Cada una de las 6 cartas se tira de forma independiente. La suma DEBE dar
    // exactamente 1.0 (validado abajo con console.assert).
    probabilidadesRareza: {
        COMUN:     0.62,
        ORO:       0.26,
        DESTACADO: 0.09,
        ESTRELLA:  0.027,
        LEYENDA:   0.003
    },

    // Orden de rareza de MENOR a MAYOR. Es la fuente de verdad para:
    //   - comparar "DESTACADO o superior" (pity de rareza §13.3);
    //   - la regla de "bajar de rareza" cuando una posición forzada no tiene
    //     jugadores de la rareza sorteada (ver core/economia.js).
    ordenRareza: ["COMUN", "ORO", "DESTACADO", "ESTRELLA", "LEYENDA"],

    // ------------------------------------------
    // Paquete de bienvenida (§13.1)
    // ------------------------------------------
    // El PRIMER paquete que abre un usuario nuevo tiene composición garantizada
    // por posición y al menos 1 carta de `rarezaMinima` o superior. Los otros 4
    // son BASICO estándar (con el pity de arquero ya activo).
    primerPaqueteBienvenida: {
        composicion: { POR: 1, DEF: 2, MED: 2, DEL: 1 },   // suma 6
        rarezaMinima: "ORO"
    },

    // ------------------------------------------
    // Pity (§13.2, §13.3)
    // ------------------------------------------
    // Arquero: si el usuario tiene 0 arqueros, el próximo paquete garantiza 1
    // POR; y si pasaron `pityArqueroMax` paquetes sin ningún POR, el siguiente lo
    // garantiza.
    pityArqueroMax: 5,
    // Rareza: cada `pityRarezaMax` paquetes sin DESTACADO o superior, el paquete
    // siguiente garantiza al menos 1 `rarezaPityObjetivo`.
    pityRarezaMax: 10,
    rarezaPityObjetivo: "DESTACADO",

    // ------------------------------------------
    // Venta de repetidos (§15.4)
    // ------------------------------------------
    // Fichas por vender un repetido, según rareza. SOLO se puede vender un
    // jugador con quantity ≥ 2 (nunca la última copia).
    venderRepetido: {
        COMUN:     20,
        ORO:       50,
        DESTACADO: 120,
        ESTRELLA:  400,
        LEYENDA:   1500
    }
};


// ==========================================
// ETIQUETAS DE RAREZA (solo presentación)
// ==========================================
//
// La clave canónica es sin tilde; acá se le pone la tilde para el usuario.

export const ETIQUETA_RAREZA = {
    COMUN:     "COMÚN",
    ORO:       "ORO",
    DESTACADO: "DESTACADO",
    ESTRELLA:  "ESTRELLA",
    LEYENDA:   "LEYENDA"
};

export function etiquetaRareza(rareza) {
    return ETIQUETA_RAREZA[rareza] || rareza;
}


// ==========================================
// VALIDACIÓN DE PESOS (§14, principio "los pesos suman 1.0")
// ==========================================

const _sumaProb = Object.values(ECONOMIA.probabilidadesRareza)
    .reduce((a, b) => a + b, 0);

console.assert(
    Math.abs(_sumaProb - 1.0) < 1e-9,
    `Las probabilidades de rareza (§14) deben sumar 1.0, suman ${_sumaProb}`
);
