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
// Profesional argentina y reporta la composición del pool. Sirve para verificar
// que la distribución real coincide con lo que asume §11 del documento maestro
// ANTES de congelar nada de rareza.
//
// La lógica de parseo, mapeo de posiciones y rareza vive en lib/dataset.js
// (única copia, compartida con convertir-dataset.js).

const {
    leerCSV,
    filtrarLiga,
    categoriaDe,
    rarezaPorPercentil,
    LIGA_ARGENTINA
} = require("./lib/dataset.js");

const ORDEN_CATEGORIAS = ["POR", "DEF", "MED", "DEL"];
const ORDEN_RAREZAS = ["LEYENDA", "ESTRELLA", "DESTACADO", "ORO", "COMUN"];

// Cantidades que asume §11.1 para ~869 jugadores (referencia de comparación).
const RAREZA_ESPERADA = {
    LEYENDA:   9,
    ESTRELLA:  35,
    DESTACADO: 130,
    ORO:       260,
    COMUN:     435
};


function barra(cantidad, maximo, ancho = 40) {
    const largo = maximo === 0 ? 0 : Math.round((cantidad / maximo) * ancho);
    return "█".repeat(largo);
}

function mediana(ordenados) {
    const n = ordenados.length;
    if (n === 0) return 0;
    const mitad = Math.floor(n / 2);
    return n % 2 === 0
        ? (ordenados[mitad - 1] + ordenados[mitad]) / 2
        : ordenados[mitad];
}


function main() {
    let csv;
    try {
        csv = leerCSV();
    } catch (e) {
        console.error("\n✗ " + e.message + "\n");
        process.exit(1);
    }

    const { idx, filas } = csv;
    const iPos = idx["Position"], iOvr = idx["OVR"], iTeam = idx["Team"];
    const pool = filtrarLiga(filas, idx);

    console.log("=".repeat(60));
    console.log(`ANÁLISIS DEL POOL — Liga "${LIGA_ARGENTINA}"`);
    console.log("=".repeat(60));

    // --- Total ---
    console.log(`\nTOTAL DE JUGADORES: ${pool.length}`);
    console.log(`CLUBES: ${new Set(pool.map(f => f[iTeam])).size}`);

    // --- Por posición (4 categorías) ---
    const porCategoria = { POR: 0, DEF: 0, MED: 0, DEL: 0 };
    const sinMapear = new Set();
    for (const f of pool) {
        const cat = categoriaDe(f[iPos]);
        if (!cat) { sinMapear.add(f[iPos]); continue; }
        porCategoria[cat]++;
    }

    console.log("\nCANTIDAD POR POSICIÓN (4 categorías del juego):");
    const maxCat = Math.max(...Object.values(porCategoria));
    for (const cat of ORDEN_CATEGORIAS) {
        console.log(`  ${cat}  ${String(porCategoria[cat]).padStart(4)}  ${barra(porCategoria[cat], maxCat)}`);
    }
    if (sinMapear.size > 0) {
        console.log(`\n  ⚠️  Posiciones granulares sin mapear: ${[...sinMapear].join(", ")}`);
    }

    // --- Foco: arqueros (cuello de botella de torneos, §37) ---
    console.log(`\n➜ ARQUEROS (POR): ${porCategoria.POR}   (el cuello de botella de los torneos, §37)`);
    console.log(`  Test de la Etapa 1: se pide al menos 60. ${porCategoria.POR >= 60 ? "✓ CUMPLE" : "✗ NO CUMPLE"}`);

    // --- Desglose granular ---
    const granular = new Map();
    for (const f of pool) granular.set(f[iPos], (granular.get(f[iPos]) || 0) + 1);
    console.log("\nDesglose granular (se conserva como detailedPosition):");
    [...granular.entries()].sort((a, b) => b[1] - a[1]).forEach(([p, n]) => {
        console.log(`  ${(categoriaDe(p) || "??").padEnd(3)} ${p.padEnd(4)} ${String(n).padStart(4)}`);
    });

    // --- Overall ---
    const ovrs = pool.map(f => Number(f[iOvr])).sort((a, b) => a - b);
    const min = ovrs[0], max = ovrs[ovrs.length - 1];
    const media = ovrs.reduce((a, b) => a + b, 0) / ovrs.length;
    console.log("\nOVERALL:");
    console.log(`  mín: ${min}   máx: ${max}   media: ${media.toFixed(1)}   mediana: ${mediana(ovrs)}`);

    // --- Histograma ---
    console.log("\nHISTOGRAMA DE OVERALL:");
    const histo = new Map();
    for (const o of ovrs) histo.set(o, (histo.get(o) || 0) + 1);
    const maxHisto = Math.max(...histo.values());
    for (let o = min; o <= max; o++) {
        const n = histo.get(o) || 0;
        console.log(`  ${String(o).padStart(3)}  ${String(n).padStart(4)}  ${barra(n, maxHisto, 50)}`);
    }

    // --- Por rareza (§11.2) ---
    const ordenadoAsc = [...pool].sort((a, b) => Number(a[iOvr]) - Number(b[iOvr]));
    const n = ordenadoAsc.length;
    const porRareza = { LEYENDA: 0, ESTRELLA: 0, DESTACADO: 0, ORO: 0, COMUN: 0 };
    ordenadoAsc.forEach((f, i) => {
        porRareza[rarezaPorPercentil((i / n) * 100)]++;
    });

    console.log("\nCANTIDAD POR RAREZA (percentiles de §11.2):");
    console.log("  rareza      pool   §11 espera");
    for (const r of ORDEN_RAREZAS) {
        console.log(`  ${r.padEnd(10)} ${String(porRareza[r]).padStart(5)}   ${String(RAREZA_ESPERADA[r]).padStart(5)}`);
    }

    console.log("\n" + "=".repeat(60));
}

main();
