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
    TEMPO_POSESION: 0.9,

    // Ventaja de localía (post-Etapa 10, mejora pedida por el grupo). Bono FIJO
    // que se suma a la Fuerza Efectiva SOLO en partidos de torneo con formato
    // ida y vuelta (§40) — nunca en vs IA, amistosos, ni torneos a una vuelta.
    // Mucho más chico que el swing de mentalidad (±12) o el mod de formación
    // (hasta ±9): es un empujoncito, no un factor decisivo. Confirmado con el
    // usuario: +3 Ataque y Medio al local, -1 Ataque al visitante.
    LOCALIA: {
        local:     { ataque: 3, medio: 3 },
        visitante: { ataque: -1 }
    },

    // Tarjetas (Grupo E, post-Etapa 10). Se evalúan una vez por posesión,
    // contra el equipo que DEFIENDE esa posesión (gane o pierda la pelota).
    // Calibrado con scripts/test-tarjetas-penales.mjs para ~4 amarillas por
    // partido en total (confirmado con el usuario — "moderada").
    PROB_TARJETA: 0.19,
    // PRESIÓN ALTA Y RUDA ya documentaba en mentalidades.js un +60% de faltas/
    // tarjetas (V1.5, §27) que nunca se había implementado — es este multiplicador.
    MULT_TARJETA_PRESION: 1.60,
    // De las tarjetas que se muestran (sin ya tener amarilla ese jugador), qué
    // fracción es roja directa en vez de amarilla. Rara a propósito: la mayoría
    // de las rojas del juego van a salir por doble amarilla.
    PROB_ROJA_DIRECTA: 0.02,
    // Penalización a la Fuerza Efectiva del equipo que se queda con uno menos,
    // por el resto de ESE partido (no se recalcula equipo a equipo, es un
    // multiplicador fijo sobre ataque/medio/defensa). Confirmado con el
    // usuario: -12%.
    PENALIZACION_ROJA: 0.88,

    // Penales (Grupo E, post-Etapa 10). Fracción de las ocasiones generadas
    // (FASE 2 exitosa) que se resuelven como penal en vez de remate normal.
    //
    // CONFLICTO DE CALIBRACIÓN (resuelto con el usuario): el pedido original
    // era "~1 penal cada 4-5 partidos" (la frecuencia real del fútbol). Un
    // penal convierte MUCHO más que un remate abierto (remate abierto: techo
    // matemático ~31%, dado por FACTOR_GOL; penal: 65-85% con PENAL_PISO/
    // RANGO de abajo). Meter esa "válvula de alta conversión" aunque sea poco
    // frecuente engorda desproporcionadamente la cola de goleadas (§33: 5+
    // goles ≤11%, el "piso de Poisson" calibrado en la Etapa 5) mucho más de
    // lo que mueve el promedio — medido con scripts/simular-balance.mjs: con
    // la frecuencia real (~1 cada 4-5) el 5+ sube a ~11.8%, rompiendo el
    // techo. Bajar la conversión del penal casi no ayuda (es la FRECUENCIA la
    // que domina la cola, no cuánto convierte). El usuario priorizó no romper
    // el techo del 11% ya documentado: PROB_PENAL quedó en 1 penal cada ~23
    // partidos, bastante más raro que el pedido original. Recalibrar el motor
    // entero (D/FACTOR_GOL/VARIANZA_OCASION) para hacerle lugar de verdad a
    // los penales sin este trade-off queda pendiente como una tarea aparte,
    // después de cerrar el resto de las mejoras — ver ESTADO.md.
    PROB_PENAL: 0.003,
    // Conversión de penal = PISO + duelo(pateador, arquero) × RANGO (65-85%).
    // Un piso alto (a diferencia de FACTOR_GOL, que es para remates abiertos)
    // porque un penal siempre favorece mucho al pateador; el RANGO es lo que
    // el arquero puede torcer con sus propias stats — "a veces ataje el
    // arquero". No es la palanca principal del conflicto de arriba (la
    // frecuencia domina la cola de goleadas), pero une los dos.
    PENAL_PISO: 0.65,
    PENAL_RANGO: 0.20
};
