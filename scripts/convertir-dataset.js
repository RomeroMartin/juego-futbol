// ==========================================
// convertir-dataset.js  (Etapa 1)
// ==========================================
//
// Toma el CSV crudo de data-raw/, filtra la Liga Profesional argentina, mapea
// cada jugador al modelo de datos de §8, asigna rareza por percentiles (§11.2)
// y GENERA js/data/jugadores.js.
//
//     node scripts/convertir-dataset.js
//
// IMPORTANTE: genera un módulo ES .js (export const JUGADORES = [...]), NUNCA
// un .json. Un .json obligaría a fetch() asíncrono y a volver async todo el
// arranque del juego, sin ninguna ganancia. Decisión registrada en ESTADO.md.
//
// CommonJS: es tooling de Node. El código del juego (js/) es ESM para el
// navegador.

const fs = require("fs");
const path = require("path");
const {
    leerCSV,
    filtrarLiga,
    categoriaDe,
    asignarRarezas,
    TEMPORADA,
    LIGA_ARGENTINA
} = require("./lib/dataset.js");

const RUTA_SALIDA = path.join(__dirname, "..", "js", "data", "jugadores.js");

const ORDEN_CATEGORIAS = ["POR", "DEF", "MED", "DEL"];
const TITULO_CATEGORIA = {
    POR: "ARQUEROS",
    DEF: "DEFENSORES",
    MED: "MEDIOCAMPISTAS",
    DEL: "DELANTEROS"
};


// Primera posición alternativa (§8 secondaryPosition), mapeada a categoría.
// "['ST', 'LM']" -> "ST" -> "DEL". null si no tiene alternativas.
function secondaryPositionDe(textoAlternativas) {
    if (!textoAlternativas) return null;
    const tokens = textoAlternativas.match(/[A-Z]+/g);
    if (!tokens || tokens.length === 0) return null;
    return categoriaDe(tokens[0]);
}

function num(valor) {
    const n = Number(valor);
    return Number.isFinite(n) ? n : null;
}


// Construye el objeto jugador del modelo §8 a partir de una fila del CSV.
function construirJugador(f, idx) {
    const granular = f[idx["Position"]];
    const categoria = categoriaDe(granular);
    const esArquero = categoria === "POR";

    return {
        id: num(f[idx["ID"]]),
        schemaVersion: 3,

        // Identidad
        name: f[idx["Name"]],
        shortName: null,
        club: f[idx["Team"]],
        clubId: null,
        nationality: f[idx["Nation"]] || null,
        age: num(f[idx["Age"]]),

        // Posición (4 categorías del juego + posición granular del dataset)
        position: categoria,
        detailedPosition: granular,
        secondaryPosition: secondaryPositionDe(f[idx["Alternative positions"]]),

        // Stats
        overall: num(f[idx["OVR"]]),
        pace: num(f[idx["PAC"]]),
        shooting: num(f[idx["SHO"]]),
        passing: num(f[idx["PAS"]]),
        dribbling: num(f[idx["DRI"]]),
        defending: num(f[idx["DEF"]]),
        physical: num(f[idx["PHY"]]),

        // Stats de arquero: solo para POR, null para jugadores de campo (§8)
        gkDiving:      esArquero ? num(f[idx["GK Diving"]])      : null,
        gkHandling:    esArquero ? num(f[idx["GK Handling"]])    : null,
        gkPositioning: esArquero ? num(f[idx["GK Positioning"]]) : null,
        gkReflexes:    esArquero ? num(f[idx["GK Reflexes"]])    : null,
        gkKicking:     esArquero ? num(f[idx["GK Kicking"]])     : null,

        // Metadata de juego
        rarity: null,          // la completa asignarRarezas()
        season: TEMPORADA,
        photo: null
    };
}


// Serializa un jugador como texto JS legible.
function serializarJugador(j) {
    const s = v => JSON.stringify(v);
    return `    {
        id: ${j.id},
        schemaVersion: ${j.schemaVersion},

        // Identidad
        name: ${s(j.name)},
        shortName: ${s(j.shortName)},
        club: ${s(j.club)},
        clubId: ${s(j.clubId)},
        nationality: ${s(j.nationality)},
        age: ${s(j.age)},

        // Posición
        position: ${s(j.position)},
        detailedPosition: ${s(j.detailedPosition)},
        secondaryPosition: ${s(j.secondaryPosition)},

        // Stats
        overall: ${j.overall},
        pace: ${j.pace},
        shooting: ${j.shooting},
        passing: ${j.passing},
        dribbling: ${j.dribbling},
        defending: ${j.defending},
        physical: ${j.physical},

        // Stats de arquero (null para jugadores de campo)
        gkDiving: ${s(j.gkDiving)},
        gkHandling: ${s(j.gkHandling)},
        gkPositioning: ${s(j.gkPositioning)},
        gkReflexes: ${s(j.gkReflexes)},
        gkKicking: ${s(j.gkKicking)},

        // Metadata de juego
        rarity: ${s(j.rarity)},
        season: ${s(j.season)},
        photo: ${s(j.photo)}
    }`;
}


function main() {
    const { idx, filas } = leerCSV();
    const poolFilas = filtrarLiga(filas, idx);

    console.log(`Liga "${LIGA_ARGENTINA}": ${poolFilas.length} jugadores.`);

    let jugadores = poolFilas.map(f => construirJugador(f, idx));

    // Validación: nadie sin categoría, sin id o sin overall.
    const invalidos = jugadores.filter(
        j => j.position === null || j.id === null || j.overall === null
    );
    if (invalidos.length > 0) {
        console.error(`✗ ${invalidos.length} jugadores inválidos (posición/id/overall). Abortando.`);
        console.error("  Ejemplos:", invalidos.slice(0, 3).map(j => j.name || "(sin nombre)"));
        process.exit(1);
    }

    // Rareza por percentiles (§11.2).
    asignarRarezas(jugadores);

    // Orden de salida: por categoría (POR/DEF/MED/DEL), y dentro por overall desc.
    jugadores.sort((a, b) => {
        const ca = ORDEN_CATEGORIAS.indexOf(a.position);
        const cb = ORDEN_CATEGORIAS.indexOf(b.position);
        if (ca !== cb) return ca - cb;
        if (b.overall !== a.overall) return b.overall - a.overall;
        return a.name.localeCompare(b.name);
    });

    // Ensamblar el archivo con comentarios por grupo.
    const cabecera = `// ==========================================
// DATOS DE JUGADORES — Liga Profesional Argentina
// ==========================================
//
// ⚙️ ARCHIVO GENERADO por scripts/convertir-dataset.js a partir del dataset
// de EA FC 26 (ver README, sección "Dataset"). NO editar a mano: para
// actualizarlo, reemplazar el CSV en data-raw/ y volver a correr el conversor.
//
// Modelo de datos: §8. Rareza por percentiles: §11.2. Se exporta como módulo
// ES (export const JUGADORES), NO como .json (ver ESTADO.md).
//
// Temporada: ${TEMPORADA}. Total: ${jugadores.length} jugadores.

export const JUGADORES = [
`;

    let cuerpo = "";
    let categoriaActual = null;
    jugadores.forEach((j, i) => {
        if (j.position !== categoriaActual) {
            categoriaActual = j.position;
            if (i > 0) cuerpo += "\n";
            cuerpo += `\n    // =========================\n`;
            cuerpo += `    // ${TITULO_CATEGORIA[j.position]}\n`;
            cuerpo += `    // =========================\n\n`;
        }
        cuerpo += serializarJugador(j);
        cuerpo += i < jugadores.length - 1 ? ",\n" : "\n";
    });

    const salida = cabecera + cuerpo + "\n];\n";
    fs.writeFileSync(RUTA_SALIDA, salida, "utf8");

    // Resumen.
    const porCat = { POR: 0, DEF: 0, MED: 0, DEL: 0 };
    const porRar = {};
    for (const j of jugadores) {
        porCat[j.position]++;
        porRar[j.rarity] = (porRar[j.rarity] || 0) + 1;
    }

    console.log(`\n✓ Generado ${path.relative(path.join(__dirname, ".."), RUTA_SALIDA)} con ${jugadores.length} jugadores.`);
    console.log("  Por posición:", JSON.stringify(porCat));
    console.log("  Por rareza:  ", JSON.stringify(porRar));
}

main();
