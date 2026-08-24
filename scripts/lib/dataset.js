// ==========================================
// scripts/lib/dataset.js  (Etapa 1)
// ==========================================
//
// Lógica compartida por las herramientas de dataset (analizar-pool.js y
// convertir-dataset.js). CommonJS: es tooling de Node, no código del juego.
//
// Acá vive la ÚNICA copia del mapeo de posiciones y del método de rareza, para
// que las dos herramientas no se desincronicen.

const fs = require("fs");
const path = require("path");

// Ruta del CSV crudo (§10.2, no versionado, en data-raw/).
const RUTA_CSV = path.join(__dirname, "..", "..", "data-raw", "EAFC26Men.csv");

// String EXACTO de la Liga Profesional argentina en este dataset (Paso 1).
const LIGA_ARGENTINA = "LPF";

// Temporada del dataset (EA FC 26).
const TEMPORADA = "2026";

// Mapeo de las posiciones granulares del dataset a las 4 categorías del
// juego (§9). Decisión de la Etapa 1 (mapeo estándar): CAM y volantes por
// afuera son MEDIO; solo centrodelanteros y extremos son DELANTERO.
const MAPA_POSICION = {
    GK:  "POR",
    CB:  "DEF", RB: "DEF", LB: "DEF", RWB: "DEF", LWB: "DEF",
    CDM: "MED", CM: "MED", CAM: "MED", LM: "MED", RM: "MED",
    ST:  "DEL", CF: "DEL", LW: "DEL", RW: "DEL"
};

function categoriaDe(posicionGranular) {
    return MAPA_POSICION[posicionGranular] || null;
}


// ------------------------------------------
// Parser CSV (comillas + comas dentro de campos)
// ------------------------------------------

function parseCSV(texto) {
    const filas = [];
    let campo = "";
    let fila = [];
    let enComillas = false;

    for (let i = 0; i < texto.length; i++) {
        const c = texto[i];
        if (enComillas) {
            if (c === '"') {
                if (texto[i + 1] === '"') { campo += '"'; i++; }
                else enComillas = false;
            } else campo += c;
        } else {
            if (c === '"') enComillas = true;
            else if (c === ",") { fila.push(campo); campo = ""; }
            else if (c === "\n") { fila.push(campo); filas.push(fila); fila = []; campo = ""; }
            else if (c === "\r") { /* ignorar */ }
            else campo += c;
        }
    }
    if (campo.length > 0 || fila.length > 0) { fila.push(campo); filas.push(fila); }
    return filas;
}


// Lee el CSV y devuelve { header, idx, filas } donde idx["Columna"] = índice.
function leerCSV(ruta = RUTA_CSV) {
    if (!fs.existsSync(ruta)) {
        throw new Error(
            `No encuentro el CSV en: ${ruta}\n` +
            "Bajá el dataset y dejalo en data-raw/ (ver README, sección Dataset)."
        );
    }
    const filas = parseCSV(fs.readFileSync(ruta, "utf8"));
    const header = filas[0];
    const idx = {};
    header.forEach((h, i) => idx[h] = i);
    const datos = filas.slice(1).filter(f => f.length === header.length);
    return { header, idx, filas: datos };
}


// Devuelve solo las filas de la Liga Profesional argentina.
function filtrarLiga(filas, idx, liga = LIGA_ARGENTINA) {
    return filas.filter(f => f[idx["League"]] === liga);
}


// ------------------------------------------
// Rareza por percentil (§11.2)
// ------------------------------------------

function rarezaPorPercentil(percentil) {
    if (percentil >= 99) return "LEYENDA";
    if (percentil >= 95) return "ESTRELLA";
    if (percentil >= 80) return "DESTACADO";
    if (percentil >= 50) return "ORO";
    return "COMUN";
}

// Asigna rarity a cada jugador del pool según su percentil de overall (§11.2).
// Muta los objetos y devuelve el pool ordenado ascendente por overall.
function asignarRarezas(pool) {
    const ordenado = [...pool].sort((a, b) => a.overall - b.overall);
    const n = ordenado.length;
    ordenado.forEach((jugador, i) => {
        const percentil = (i / n) * 100;
        jugador.rarity = rarezaPorPercentil(percentil);
    });
    return ordenado;
}


module.exports = {
    RUTA_CSV,
    LIGA_ARGENTINA,
    TEMPORADA,
    MAPA_POSICION,
    categoriaDe,
    parseCSV,
    leerCSV,
    filtrarLiga,
    rarezaPorPercentil,
    asignarRarezas
};
