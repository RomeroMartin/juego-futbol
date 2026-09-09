// ==========================================
// CONFIGURACIÓN DEL MOTOR DE PARTIDO
// ==========================================
//
// Perillas de balance del motor (§22, §24, §25). Son las ÚNICAS constantes que
// se tocan al calibrar contra la tabla de §33. Valores de balance: solo acá,
// nunca hardcodeados sueltos en el motor.

export const MOTOR = {
    // Varianza del duelo (§22). D bajo = más determinista; D alto = más azar.
    // Punto de partida del documento: 18. Etapa 2 lo calibró a 70 (pool real).
    // RECALIBRADO a 56 en la Etapa 5: el tempo de posesión (ver abajo) diluye la
    // señal de fuerza para bajar los empates, así que hace falta un D un poco más
    // determinista para que el favorito +10 vuelva al 63-68% de §33.
    D: 56,

    // Factor de realismo goleador de la Fase 3 (§25). Sin él salen 7-5.
    // Punto de partida del documento: 0.42. Etapa 2: 0.36. RECALIBRADO a 0.31 en
    // la Etapa 5 para bajar la cola de 5+ goles al límite de §33 manteniendo el
    // promedio ≥ 2.4.
    FACTOR_GOL: 0.31,

    // Cantidad de posesiones por partido (§24): 18 a 26.
    // nPosesiones = POSESIONES_MIN + floor(rand() * POSESIONES_RANGO)
    POSESIONES_MIN: 18,
    POSESIONES_RANGO: 9,

    // Varianza de la calidad de la ocasión (§25). La calidad de cada ocasión es
    // el ataque × un factor aleatorio en [MIN, MIN+SPAN]. Es la perilla de
    // VARIANZA del marcador: una banda más ancha engorda las dos colas (más 0-0
    // y más goleadas de 5+); una más angosta las achica. Junto con FACTOR_GOL
    // cierra la deuda de §33 (empates 18-22% y 5+ ≤8%) que quedó abierta en la
    // Etapa 2. Punto de partida del documento: 0.8 + 0.4. CALIBRADA a 0.95 + 0.1
    // (banda angosta) para acercar la distribución de goles a sub-Poisson y bajar
    // la cola de 5+.
    VARIANZA_OCASION_MIN: 0.95,
    VARIANZA_OCASION_SPAN: 0.1,

    // Tempo de posesión por partido (§24). Cada partido tiene su propio "clima":
    // a veces un equipo controla la pelota más de lo que su mediocampo predice
    // (momentum, expulsiones, un planteo que salió). Se modela como un corrimiento
    // ALEATORIO de la probabilidad de posesión, SORTEADO UNA VEZ por partido y con
    // media cero: no cambia el total esperado de goles (no toca las colas de 5+),
    // pero hace que los partidos parejos se definan más seguido.
    //
    // POR QUÉ EXISTE: con posesiones independientes, dos equipos parejos empatan
    // ~26% de las veces (piso de Poisson), por encima del 18-22% de §33. La
    // asimetría de posesión por partido es la "varianza" que baja los empates sin
    // inflar las goleadas, cerrando la deuda de §33 abierta en la Etapa 2. Es lo
    // que §24 anticipa cuando dice que la posesión varía partido a partido.
    // 0 = posesión pura por fuerza (comportamiento Etapa 2). CALIBRADO a 1.0
    // (empates parejos ~18-20%, sin inflar la cola de 5+).
    TEMPO_POSESION: 0.9
};
