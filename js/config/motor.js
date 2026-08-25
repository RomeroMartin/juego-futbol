// ==========================================
// CONFIGURACIÓN DEL MOTOR DE PARTIDO
// ==========================================
//
// Perillas de balance del motor (§22, §24, §25). Son las ÚNICAS constantes que
// se tocan al calibrar contra la tabla de §33. Valores de balance: solo acá,
// nunca hardcodeados sueltos en el motor.

export const MOTOR = {
    // Varianza del duelo (§22). D bajo = más determinista; D alto = más azar.
    // Punto de partida del documento: 18. CALIBRADO a 70 con el pool real
    // (scripts/simular-balance.mjs, §33): la Fuerza Efectiva del pool argentino
    // comprime a un rango ~52–74, así que hace falta mucho más D que 18 para
    // que la curva de victoria no sea casi determinista.
    D: 70,

    // Factor de realismo goleador de la Fase 3 (§25). Sin él salen 7-5.
    // Punto de partida del documento: 0.42. CALIBRADO a 0.36 para que el
    // promedio de goles quede en 2.44 (rango 2.4–3.2).
    FACTOR_GOL: 0.36,

    // Cantidad de posesiones por partido (§24): 18 a 26.
    // nPosesiones = POSESIONES_MIN + floor(rand() * POSESIONES_RANGO)
    POSESIONES_MIN: 18,
    POSESIONES_RANGO: 9
};
