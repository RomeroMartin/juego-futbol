// ==========================================
// MENTALIDADES Y MATRIZ DE CONTRAS (§19)
// ==========================================
//
// Valores de balance de las mentalidades. Como D y FACTOR_GOL, los números de
// §19.1/§19.2 son PUNTOS DE PARTIDA: el valor final sale de la medición del
// swing táctico (objetivo ±12 de Fuerza Efectiva, §5) en scripts/simular-balance.mjs.
// Cualquier ajuste queda documentado acá y en ESTADO.md.
//
// DECISIÓN DE MODELADO (mapeo al ÁREA, no al stat):
//   §19.1/§19.2 describen los efectos por stat (Ritmo, Pase, Físico, Regate).
//   Pero la Fuerza Efectiva solo tiene tres áreas (ataque/medio/defensa). Si
//   "+12 Físico en ataque" se aplicara al stat físico —que pesa 0.10 en el
//   scoreAtaque— el efecto real sería +1.2 al área: invisible. Por eso los mods
//   se aplican DIRECTAMENTE al área, mapeando cada stat a su área dominante y
//   respetando los "en ataque" del documento:
//     Ritmo  → ataque   Pase → medio   Físico(en ataque) → ataque   Regate → ataque
//
// DECISIÓN DE MODELADO (frecuencia / calidadOcasion / frecuenciaRival):
//   El motor lee frecuencia y calidadOcasion del ATACANTE (§25). Las usamos:
//     - "+20% frecuencia" (EQUIPO RÁPIDO)          → frecuencia propia
//     - "−20% frec, +15% calidad" (POSESIÓN)       → frecuencia y calidad propias
//     - "−15% ocasiones rivales" (BLOQUE COMPACTO) → frecuenciaRival: multiplica
//       la frecuencia de ataque del RIVAL. Se puede porque calcularFuerzaEfectiva
//       recibe al rival. Plegarlo en `defensa` perdería la distinción entre
//       "concedo menos ocasiones" y "defiendo mejor las que concedo".
//
// FUERA DE ESTA ETAPA: faltas y tarjetas de PRESIÓN ALTA son eventos V1.5 (§27).


// ==========================================
// MENTALIDADES OFENSIVAS (§19.1)
// ==========================================
//
// mods planos al área + multiplicadores de frecuencia/calidad del atacante.

// NOTA (calibración Etapa 5): los valores de §19.1/§19.2 son puntos de partida.
// El swing y el uso óptimo de cada mentalidad se midieron en simular-balance.mjs
// y algunos mods se ajustaron para que NINGUNA supere el 40% de uso óptimo:
//  - PRESIÓN ALTA tenía +14 medio y ganaba la posesión sola (uso 79%): bajado a +6.
//  - POSESIÓN no era óptima nunca (su fila de matriz es toda ≤1.02): se ablandó su
//    penalización de frecuencia y de ritmo para que compita ante LÍNEA MEDIA.
// Los cambios mantienen el CARÁCTER de cada mentalidad (trade-offs de §19).

export const MENTALIDADES_OF = {
    EQUIPO_RAPIDO: {
        etiqueta: "EQUIPO RÁPIDO",
        // +10 Ritmo en ataque → ataque; −8 Pase → medio
        ataque: +7, medio: -8, defensa: 0,
        frecuencia: 1.20,      // +20% frecuencia de ataques
        calidadOcasion: 0.90   // −10% calidad de ocasión
    },
    JUEGO_ABIERTO: {
        etiqueta: "JUEGO ABIERTO",
        // +12 Físico en ataque, −6 Regate → neto ataque
        ataque: +1, medio: 0, defensa: 0,
        frecuencia: 1.00,
        calidadOcasion: 1.00
        // El "amplitud +15" de §19.1 se modela en la compatibilidad estructural
        // (§19.4): JUEGO ABIERTO rinde según la amplitud de la formación.
    },
    POSESION: {
        etiqueta: "POSESIÓN",
        // +12 Pase → medio; −10 Ritmo → ataque
        ataque: -6, medio: +12, defensa: 0,
        frecuencia: 0.88,      // −12% frecuencia de ataques
        calidadOcasion: 1.18   // +18% calidad de ocasión
    },
    EQUILIBRADO: {
        etiqueta: "EQUILIBRADO",
        ataque: 0, medio: 0, defensa: 0,
        frecuencia: 1.00,
        calidadOcasion: 1.00
    },

    // ------------------------------------------
    // NUEVAS (D2, post-Etapa 10). Mismo criterio de modelado que arriba: mods
    // planos al área + frecuencia/calidadOcasion propias. Puntos de partida
    // pensados por el concepto futbolístico de cada una; el valor final, como
    // las de §19.1, sale de scripts/simular-balance.mjs (ninguna > 40% de uso
    // óptimo). Su verdadero carácter también vive en MATRIZ_CONTRAS más abajo
    // (a quién le gana, a quién le pierde) — los mods son solo el punto de
    // partida "en el vacío", sin rival.
    // ------------------------------------------

    CONTRAGOLPE: {
        etiqueta: "CONTRAGOLPE",
        // Cede el mediocampo a propósito (no busca la pelota) para golpear
        // rápido y con pocos toques apenas la recupera. El corte de
        // frecuencia arrancó muy fuerte (0.75) y la dejaba casi sin uso —
        // se suavizó dos veces (0.85, después 0.90) para que la calidad de
        // ocasión (subida a 1.40) alcance a compensarlo.
        ataque: +9, medio: -9, defensa: 0,
        frecuencia: 0.90,      // ataca menos seguido...
        calidadOcasion: 1.40   // ...pero cuando lo hace, es una ocasión clara
    },
    JUEGO_DIRECTO: {
        etiqueta: "JUEGO DIRECTO",
        // Se salta el mediocampo con pelotazos largos a los delanteros. La
        // penalización de medio arrancó muy fuerte (-12) y la dejaba casi sin
        // uso — se suavizó a -8.
        ataque: +10, medio: -8, defensa: 0,
        frecuencia: 1.15,      // más intentos, más rápido
        calidadOcasion: 0.85   // pelotazo largo: menos preciso que jugado
    },
    ATAQUE_TOTAL: {
        etiqueta: "ATAQUE TOTAL",
        // Todo el equipo vuelca al frente. Su riesgo real (queda expuesto
        // atrás) vive sobre todo en la matriz, no acá — pero el mod plano
        // arrancó demasiado alto (dominaba >40% de uso óptimo, ver
        // simular-balance.mjs) y se bajó.
        ataque: +9, medio: +2, defensa: 0,
        frecuencia: 1.08,
        calidadOcasion: 0.90   // cantidad de gente arriba, no siempre calidad
    },
    DESBORDE_INDIVIDUAL: {
        etiqueta: "DESBORDE INDIVIDUAL",
        // Juego 1v1 por los costados con jugadores de buen regate/ritmo, no
        // centros al área (eso es JUEGO ABIERTO). También necesita amplitud
        // (ver compatAtaque más abajo).
        ataque: +6, medio: -4, defensa: 0,
        frecuencia: 1.05,
        calidadOcasion: 1.10   // ganar el 1v1 suele ser una ocasión clara
    }
};


// ==========================================
// MENTALIDADES DEFENSIVAS (§19.2)
// ==========================================
//
// mods planos al área + frecuenciaRival (multiplicador sobre la frecuencia de
// ataque del rival).

export const MENTALIDADES_DEF = {
    BLOQUE_COMPACTO: {
        etiqueta: "BLOQUE COMPACTO",
        // +12 def contra ataques por el centro / −10 def contra centros al área:
        // el motor no modela canales, así que se aplica el neto. Su fuerza real es
        // conceder menos ocasiones (frecuenciaRival). Cede posesión: −5 medio.
        medio: -5, defensa: +5,
        frecuenciaRival: 0.82   // −18% ocasiones rivales
    },
    PRESION_ALTA: {
        etiqueta: "PRESIÓN ALTA Y RUDA",
        // +14 Mediocampo (recuperación alta); −15 Defensa ante contraataques.
        // El +14 hacía que PRESIÓN ganara la posesión sola (uso 79%): bajado a +2,
        // y su riesgo real profundizado a −24 defensa (amplifica el "−15 Defensa
        // ante contraataques" del doc: PRESIÓN queda MUY expuesta atrás).
        // NOTA (límite estructural): su uso óptimo se estabiliza ~48-52%, NO baja
        // de 40%, porque hay 4 mentalidades ofensivas y solo 3 defensivas — por el
        // principio del palomar, alguna defensiva es la mejor respuesta a ≥2
        // ofensivas. Bajarla más a la fuerza volvería a PRESIÓN un "trap"
        // degenerado (peor diseño). Ver ESTADO.md. El spread real (BLOQUE 35% /
        // LÍNEA 16%) mantiene la elección como una decisión, no una obligada.
        medio: +2, defensa: -24,
        frecuenciaRival: 1.00
        // +25% recuperar en campo rival y +60% faltas/tarjetas: V1.5 (§27).
    },
    LINEA_MEDIA: {
        etiqueta: "LÍNEA MEDIA",
        medio: 0, defensa: 0,
        frecuenciaRival: 1.00
    },

    // ------------------------------------------
    // NUEVAS (D2, post-Etapa 10). Mismo criterio que arriba.
    // ------------------------------------------

    CERROJO: {
        etiqueta: "CERROJO",
        // El bloque bajo, compacto, de toda la vida: cede la pelota sin
        // problema (no le importa no tenerla) a cambio de un área muy difícil
        // de perforar. También tiene compatibilidad estructural con la
        // densidad central (ver compatDefensa más abajo).
        medio: -10, defensa: +16,
        frecuenciaRival: 0.75   // concede muy pocas ocasiones limpias
    },
    LINEA_ADELANTADA: {
        etiqueta: "LÍNEA ADELANTADA",
        // Línea de fondo muy subida para achicar el campo y jugar en offside.
        // Aprieta bien el medio, pero deja un espacio enorme a la espalda
        // (su verdadero costo vive en la matriz, contra quien juega rápido y
        // en profundidad).
        medio: +6, defensa: -14,
        frecuenciaRival: 0.85
    },
    REPLIEGUE_TRAS_PERDIDA: {
        etiqueta: "REPLIEGUE TRAS PÉRDIDA",
        // No presiona arriba: apenas se pierde la pelota, todo el equipo
        // retrocede rápido a su posición para no dejar espacios sueltos. Los
        // mods planos son chicos a propósito — su fuerza real es específica:
        // corta las salidas rápidas del rival (ver matriz, especialmente
        // contra CONTRAGOLPE y ATAQUE TOTAL).
        medio: -2, defensa: +3,
        frecuenciaRival: 0.92
    }
};


// ==========================================
// MATRIZ DE CONTRAS (§19.3) — ÚNICA MATRIZ
// ==========================================
//
// Multiplicador sobre el ATAQUE del que ataca: MATRIZ[miOfensiva][suDefensiva].
//
// IMPORTANTE — corrección de §20.5 del documento maestro:
//   El doc invocaba además una MATRIZ_CONTRAS_DEF (espejo sobre la defensa del
//   rival). Es un DOBLE CONTEO: el motor calcula la ocasión como
//   probabilidadDuelo(ataqueA, defensaB); aplicar ×1.18 al ataque Y ×0.82 a la
//   defensa cuenta dos veces el mismo enfrentamiento (el diferencial real se iba
//   a ~36%, el doble de lo calibrado en §19.3).
//   Solución correcta: UNA sola matriz, aplicada al ataque del atacante. Como
//   fuerzaEfectiva(A,B) se llama para cada equipo cuando ataca, el sistema queda
//   simétrico y cada enfrentamiento se cuenta una sola vez.

// Ampliada en D2 (post-Etapa 10) de 4×3 a 8×6. Las 12 celdas originales
// (columnas BLOQUE_COMPACTO/PRESION_ALTA/LINEA_MEDIA de las filas de
// siempre) NO se tocan — ya estaban calibradas. Las celdas nuevas siguen la
// misma lógica futbolística de las de al lado: quién le saca ventaja a quién
// por cómo juega, no solo por los mods planos de arriba.
export const MATRIZ_BASE = {
    EQUIPO_RAPIDO:       { BLOQUE_COMPACTO: 0.88, PRESION_ALTA: 1.18, LINEA_MEDIA: 1.00, CERROJO: 0.92, LINEA_ADELANTADA: 1.22, REPLIEGUE_TRAS_PERDIDA: 0.88 },
    JUEGO_ABIERTO:       { BLOQUE_COMPACTO: 1.15, PRESION_ALTA: 0.94, LINEA_MEDIA: 1.00, CERROJO: 0.90, LINEA_ADELANTADA: 0.95, REPLIEGUE_TRAS_PERDIDA: 1.03 },
    POSESION:            { BLOQUE_COMPACTO: 0.92, PRESION_ALTA: 0.85, LINEA_MEDIA: 1.02, CERROJO: 0.88, LINEA_ADELANTADA: 0.95, REPLIEGUE_TRAS_PERDIDA: 1.00 },
    EQUILIBRADO:         { BLOQUE_COMPACTO: 1.00, PRESION_ALTA: 1.00, LINEA_MEDIA: 1.00, CERROJO: 1.00, LINEA_ADELANTADA: 1.00, REPLIEGUE_TRAS_PERDIDA: 1.00 },
    // Contragolpe necesita que el rival se haya adelantado: brutal contra la
    // línea alta, flojo contra quien nunca sube (CERROJO) o contra quien
    // justamente está diseñado para cortarle la salida rápida (REPLIEGUE).
    CONTRAGOLPE:         { BLOQUE_COMPACTO: 0.90, PRESION_ALTA: 1.25, LINEA_MEDIA: 1.00, CERROJO: 0.92, LINEA_ADELANTADA: 1.28, REPLIEGUE_TRAS_PERDIDA: 0.82 },
    // Juego directo se salta la presión jugando por arriba; pierde precisión
    // contra un bloque compacto y ordenado.
    JUEGO_DIRECTO:       { BLOQUE_COMPACTO: 0.92, PRESION_ALTA: 1.16, LINEA_MEDIA: 1.00, CERROJO: 0.88, LINEA_ADELANTADA: 1.18, REPLIEGUE_TRAS_PERDIDA: 1.00 },
    // Ataque total es todo o nada: se frustra contra cualquier rival ordenado
    // (bloque bajo o el repliegue que castiga justo ese desborde de gente
    // hacia arriba) y solo rinde de verdad contra otro estilo igual de
    // arriesgado (presión alta, línea adelantada).
    ATAQUE_TOTAL:        { BLOQUE_COMPACTO: 0.85, PRESION_ALTA: 1.08, LINEA_MEDIA: 1.00, CERROJO: 0.80, LINEA_ADELANTADA: 1.10, REPLIEGUE_TRAS_PERDIDA: 0.82 },
    // Desborde individual gana los 1v1: le cuesta contra una presión rápida
    // que no lo deja encarar, le rinde contra una línea alta (velocidad de
    // encare) y es parejo contra un bloque compacto (el desborde crea su
    // propia ocasión aunque el área esté cerrada).
    DESBORDE_INDIVIDUAL: { BLOQUE_COMPACTO: 1.08, PRESION_ALTA: 0.88, LINEA_MEDIA: 1.00, CERROJO: 0.95, LINEA_ADELANTADA: 1.12, REPLIEGUE_TRAS_PERDIDA: 0.95 }
};

// Escala del swing de la matriz. Con D=70 (calibrado en Etapa 2) la curva es
// mucho más plana que la que asumía §19.3, así que los multiplicadores mueven
// menos la probabilidad. Este factor amplifica el desvío respecto de 1.0
// MANTENIENDO las relaciones relativas de §19.3, para que la ventaja táctica
// valga ~±12 puntos de Fuerza Efectiva (§5). Valor final fijado por medición
// (scripts/simular-balance.mjs). 1.0 = matriz de §19.3 tal cual.
export const MATRIZ_ESCALA = 3.4;

// MATRIZ_CONTRAS efectiva = base escalada. Objeto MUTABLE (la simulación de
// balance puede rescalarlo in place para barrer valores, como hace con MOTOR.D).
export const MATRIZ_CONTRAS = {};

// Reconstruye MATRIZ_CONTRAS con una escala dada: m → 1 + (m − 1) × escala.
export function setMatrizEscala(escala) {
    for (const of in MATRIZ_BASE) {
        MATRIZ_CONTRAS[of] = MATRIZ_CONTRAS[of] || {};
        for (const def in MATRIZ_BASE[of]) {
            MATRIZ_CONTRAS[of][def] = 1 + (MATRIZ_BASE[of][def] - 1) * escala;
        }
    }
}

setMatrizEscala(MATRIZ_ESCALA);


// ==========================================
// COMPATIBILIDAD ESTRUCTURAL FORMACIÓN ↔ MENTALIDAD (§19.4)
// ==========================================
//
// Multiplicadores sobre el área correspondiente, según los ejes de la formación.
// Fórmulas y rangos de §19.4 verbatim.

// JUEGO ABIERTO y DESBORDE INDIVIDUAL necesitan amplitud (D2: el desborde 1v1
// también vive de tener banda para encarar, mismo rango que JUEGO ABIERTO).
export function compatAtaque(claveOfensiva, formacion) {
    if (claveOfensiva === "JUEGO_ABIERTO" || claveOfensiva === "DESBORDE_INDIVIDUAL") {
        return 0.75 + (formacion.amplitud / 100) * 0.5;
    }
    return 1.0;
}

// PRESIÓN ALTA necesita gente en el medio (rango 0.98–1.12).
export function compatMedio(claveDefensiva, formacion) {
    if (claveDefensiva === "PRESION_ALTA") {
        return 0.80 + (formacion.densidadCentral / 100) * 0.4;
    }
    return 1.0;
}

// BLOQUE COMPACTO con poca densidad central es un contrasentido (rango
// 0.99–1.09). CERROJO (D2) necesita densidad central TODAVÍA más que BLOQUE
// COMPACTO —vive de tener gente atrás bloqueando el área— (rango 0.95–1.19).
export function compatDefensa(claveDefensiva, formacion) {
    if (claveDefensiva === "BLOQUE_COMPACTO") {
        return 0.85 + (formacion.densidadCentral / 100) * 0.3;
    }
    if (claveDefensiva === "CERROJO") {
        return 0.75 + (formacion.densidadCentral / 100) * 0.4;
    }
    return 1.0;
}


// ==========================================
// LISTAS Y DEFAULTS
// ==========================================

export const CLAVES_OFENSIVA = Object.keys(MENTALIDADES_OF);
export const CLAVES_DEFENSIVA = Object.keys(MENTALIDADES_DEF);

export const MENTALIDAD_OF_DEFAULT = "EQUILIBRADO";
export const MENTALIDAD_DEF_DEFAULT = "LINEA_MEDIA";
