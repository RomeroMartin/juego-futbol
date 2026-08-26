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

export const MATRIZ_BASE = {
    EQUIPO_RAPIDO: { BLOQUE_COMPACTO: 0.88, PRESION_ALTA: 1.18, LINEA_MEDIA: 1.00 },
    JUEGO_ABIERTO: { BLOQUE_COMPACTO: 1.15, PRESION_ALTA: 0.94, LINEA_MEDIA: 1.00 },
    POSESION:      { BLOQUE_COMPACTO: 0.92, PRESION_ALTA: 0.85, LINEA_MEDIA: 1.02 },
    EQUILIBRADO:   { BLOQUE_COMPACTO: 1.00, PRESION_ALTA: 1.00, LINEA_MEDIA: 1.00 }
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

// JUEGO ABIERTO necesita amplitud (rango 0.95–1.13).
export function compatAtaque(claveOfensiva, formacion) {
    if (claveOfensiva === "JUEGO_ABIERTO") {
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

// BLOQUE COMPACTO con poca densidad central es un contrasentido (rango 0.99–1.09).
export function compatDefensa(claveDefensiva, formacion) {
    if (claveDefensiva === "BLOQUE_COMPACTO") {
        return 0.85 + (formacion.densidadCentral / 100) * 0.3;
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
