// ==========================================
// analizar-pool.js  (Etapa 1)
// ==========================================
//
// Script de análisis del pool. NO es parte del juego servido: es una
// herramienta de línea de comandos que se corre en Node:
//
//     node scripts/analizar-pool.js
//
// Lee el CSV crudo de data-raw/ (§10.2, no versionado), filtra la Liga
// Profesional argentina y reporta la composición del pool ANTES de que se
// defina nada de rareza en el juego (Etapa 1, Paso 2). Sirve para verificar
// que la distribución real coincide con lo que asume §11 del documento maestro.
//
// Está escrito en CommonJS a propósito: es tooling de Node que corre sin
// configuración, sin package.json y sin npm. El código del juego (js/) sigue
// siendo módulos ES para el navegador.

const fs = require("fs");
const path = require("path");

// ------------------------------------------
// Config
// ------------------------------------------

const RUTA_CSV = path.join(__dirname, "..", "data-raw", "EAFC26Men.csv");

// String EXACTO con el que la Liga Profesional argentina figura en este
// dataset (verificado en el Paso 1: son 869 jugadores en 30 clubes).
const LIGA_ARGENTINA = "LPF";

// Mapeo de las 12 posiciones granulares del dataset a las 4 categorías del
// juego (§9). Decisión de la Etapa 1 (mapeo estándar): CAM y volantes por
// afuera son MEDIO; solo centrodelanteros y extremos son DELANTERO.
const MAPA_POSICION = {
    GK:  "POR",
    CB:  "DEF", RB: "DEF", LB: "DEF", RWB: "DEF", LWB: "DEF",
    CDM: "MED", CM: "MED", CAM: "MED", LM: "MED", RM: "MED",
    ST:  "DEL", CF: "DEL", LW: "DEL", RW: "DEL"
};

const ORDEN_CATEGORIAS = ["POR", "DEF", "MED", "DEL"];

// Umbrales de rareza por percentil (§11.2). Idénticos a los que usará
// asignarRarezas() en el conversor.
function rarezaPorPercentil(percentil) {
    if (percentil >= 99) return "LEYENDA";
    if (percentil >= 95) return "ESTRELLA";
    if (percentil >= 80) return "DESTACADO";
    if (percentil >= 50) return "ORO";
    return "COMUN";
}

const ORDEN_RAREZAS = ["LEYENDA", "ESTRELLA", "DESTACADO", "ORO", "COMUN"];

// Cantidades que asume §11.1 para ~869 jugadores (referencia de comparación).
const RAREZA_ESPERADA = {
    LEYENDA:   9,
    ESTRELLA:  35,
    DESTACADO: 130,
    ORO:       260,
    COMUN:     435
};


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


// ------------------------------------------
// Helpers de reporte
// ------------------------------------------

function barra(cantidad, maximo, ancho = 40) {
    const largo = maximo === 0 ? 0 : Math.round((cantidad / maximo) * ancho);
    return "█".repeat(largo);
}

function mediana(numerosOrdenados) {
    const n = numerosOrdenados.length;
    if (n === 0) return 0;
    const mitad = Math.floor(n / 2);
    return n % 2 === 0
        ? (numerosOrdenados[mitad - 1] + numerosOrdenados[mitad]) / 2
        : numerosOrdenados[mitad];
}


// ------------------------------------------
// Main
// ------------------------------------------

function main() {
    if (!fs.existsSync(RUTA_CSV)) {
        console.error(`\n✗ No encuentro el CSV en: ${RUTA_CSV}`);
        console.error("  Bajá el dataset y dejalo en data-raw/ (ver README, sección Dataset).\n");
        process.exit(1);
    }

    const filas = parseCSV(fs.readFileSync(RUTA_CSV, "utf8"));
    const header = filas[0];
    const idx = {};
    header.forEach((h, i) => idx[h] = i);

    const iLiga = idx["League"];
    const iPos  = idx["Position"];
    const iOvr  = idx["OVR"];
    const iTeam = idx["Team"];

    const datos = filas.slice(1).filter(f => f.length === header.length);
    const pool = datos.filter(f => f[iLiga] === LIGA_ARGENTINA);

    console.log("=".repeat(60));
    console.log(`ANÁLISIS DEL POOL — Liga "${LIGA_ARGENTINA}"`);
    console.log("=".repeat(60));

    // --- Total ---
    console.log(`\nTOTAL DE JUGADORES: ${pool.length}`);
    const clubes = new Set(pool.map(f => f[iTeam]));
    console.log(`CLUBES: ${clubes.size}`);

    // --- Por posición (4 categorías) ---
    const porCategoria = { POR: 0, DEF: 0, MED: 0, DEL: 0 };
    const granularSinMapear = new Set();
    for (const f of pool) {
        const cat = MAPA_POSICION[f[iPos]];
        if (!cat) { granularSinMapear.add(f[iPos]); continue; }
        porCategoria[cat]++;
    }

    console.log("\nCANTIDAD POR POSICIÓN (4 categorías del juego):");
    const maxCat = Math.max(...Object.values(porCategoria));
    for (const cat of ORDEN_CATEGORIAS) {
        const n = porCategoria[cat];
        console.log(`  ${cat}  ${String(n).padStart(4)}  ${barra(n, maxCat)}`);
    }

    if (granularSinMapear.size > 0) {
        console.log(`\n  ⚠️  Posiciones granulares sin mapear: ${[...granularSinMapear].join(", ")}`);
    }

    // --- Foco: arqueros (cuello de botella de torneos, §37) ---
    console.log(`\n➜ ARQUEROS (POR): ${porCategoria.POR}   (el cuello de botella de los torneos, §37)`);
    console.log(`  Test de la Etapa 1: se pide al menos 60. ${porCategoria.POR >= 60 ? "✓ CUMPLE" : "✗ NO CUMPLE"}`);

    // --- Desglose granular (informativo; se guarda como detailedPosition) ---
    const granular = new Map();
    for (const f of pool) granular.set(f[iPos], (granular.get(f[iPos]) || 0) + 1);
    console.log("\nDesglose granular (se conserva como detailedPosition):");
    [...granular.entries()].sort((a, b) => b[1] - a[1]).forEach(([p, n]) => {
        console.log(`  ${(MAPA_POSICION[p] || "??").padEnd(3)} ${p.padEnd(4)} ${String(n).padStart(4)}`);
    });

    // --- Overall: min, max, media, mediana ---
    const ovrs = pool.map(f => Number(f[iOvr])).sort((a, b) => a - b);
    const min = ovrs[0];
    const max = ovrs[ovrs.length - 1];
    const media = ovrs.reduce((a, b) => a + b, 0) / ovrs.length;
    const med = mediana(ovrs);

    console.log("\nOVERALL:");
    console.log(`  mín: ${min}   máx: ${max}   media: ${media.toFixed(1)}   mediana: ${med}`);

    // --- Histograma de Overall ---
    console.log("\nHISTOGRAMA DE OVERALL:");
    const histo = new Map();
    for (const o of ovrs) histo.set(o, (histo.get(o) || 0) + 1);
    const maxHisto = Math.max(...histo.values());
    for (let o = min; o <= max; o++) {
        const n = histo.get(o) || 0;
        console.log(`  ${String(o).padStart(3)}  ${String(n).padStart(4)}  ${barra(n, maxHisto, 50)}`);
    }

    // --- Cantidad por rareza (§11.2, mismo método que asignarRarezas) ---
    const ordenadoAsc = [...pool].sort((a, b) => Number(a[iOvr]) - Number(b[iOvr]));
    const n = ordenadoAsc.length;
    const porRareza = { LEYENDA: 0, ESTRELLA: 0, DESTACADO: 0, ORO: 0, COMUN: 0 };
    ordenadoAsc.forEach((f, i) => {
        const percentil = (i / n) * 100;
        porRareza[rarezaPorPercentil(percentil)]++;
    });

    console.log("\nCANTIDAD POR RAREZA (percentiles de §11.2):");
    console.log("  rareza      pool   §11 espera");
    for (const r of ORDEN_RAREZAS) {
        const got = porRareza[r];
        const exp = RAREZA_ESPERADA[r];
        console.log(`  ${r.padEnd(10)} ${String(got).padStart(5)}   ${String(exp).padStart(5)}`);
    }

    console.log("\n" + "=".repeat(60));
}

main();
