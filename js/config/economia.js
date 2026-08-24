// ==========================================
// CONFIGURACIÓN DE ECONOMÍA (§15.7)
// ==========================================
//
// Todos los valores de balance económico viven acá, nunca desparramados por el
// código. Ajustar el balance debe ser cambiar un número en este archivo.
//
// La mayoría de estos valores todavía NO se usan en la Etapa 0 (la economía
// completa es la Etapa 6). Se definen ahora para que el resto del proyecto ya
// lea desde un único lugar. Lo único que se usa en esta etapa es
// `paquetesBienvenida`.

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
    precios: { BASICO: 300, PREMIUM: 1200, POSICIONAL: 500 }
};
