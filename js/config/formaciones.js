// ==========================================
// FORMACIONES COMO DATO (§17)
// ==========================================
//
// Las formaciones se modelan como datos, no como código: agregar una formación
// es agregar una entrada a este objeto (§17).
//
// En esta etapa (Etapa 0) solo existe la 4-3-3, pero se modela con la
// ESTRUCTURA COMPLETA de §17 para que la Etapa 5 solo tenga que sumar entradas,
// sin refactorizar nada. Los campos `amplitud`, `densidadCentral` y `mod`
// llevan sus valores de §17 pero TODAVÍA NO SE USAN: entran en juego recién en
// la Etapa 5 (interacción formación ↔ mentalidad, §19, y fuerza efectiva,
// §20.5). Hoy lo único que se lee es `slots`.

export const FORMACIONES = {
    "4-3-3": {
        slots: { POR: 1, DEF: 4, MED: 3, DEL: 3 },

        // --- No se usan hasta la Etapa 5 ---
        amplitud: 70,            // cuánto usa los costados (0–100), §17
        densidadCentral: 45,     // gente en el corredor central (0–100), §17
        mod: { ataque: +3, medio: 0, defensa: 0 }   // modificador de formación, §20.5
    }
};


// Formación por defecto de la etapa.
export const FORMACION_DEFAULT = "4-3-3";
