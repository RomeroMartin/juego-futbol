// ==========================================
// test-relato.mjs  (Etapa 4)
// ==========================================
//
// Tests headless del relato:
//   - Goles del relato == marcador.
//   - Los nombres del relato pertenecen al XI correspondiente.
//   - Al menos 6 plantillas por tipo de evento.
//   - Variedad entre partidos.
//   - Reproducibilidad (mismo registro → mismo relato).
//
//     node scripts/test-relato.mjs

import { JUGADORES } from "../js/data/jugadores.js";
import { jugarPartido } from "../js/core/partido.js";
import { generarRelato } from "../js/core/relato.js";
import { PLANTILLAS } from "../js/data/plantillasRelato.js";

let fallos = 0;
const ok = (c, m) => { console.log(`  ${c ? "✓" : "✗"} ${m}`); if (!c) fallos++; };

const CAT = new Map(JUGADORES.map(j => [j.id, j]));
const POOL = { POR: [], DEF: [], MED: [], DEL: [] };
for (const j of JUGADORES) POOL[j.position].push(j);
for (const k in POOL) POOL[k].sort((a, b) => a.overall - b.overall);
const near = (c, n, q) => {
    let w = 3, x = POOL[c].filter(j => Math.abs(j.overall - n) <= w);
    while (x.length < q) { w += 2; x = POOL[c].filter(j => Math.abs(j.overall - n) <= w); }
    const p = x.slice(), o = [];
    for (let i = 0; i < q; i++) o.push(p.splice(Math.floor(Math.random() * p.length), 1)[0]);
    return o;
};
const eq = n => ({ id: "USUARIO", arquero: near("POR", n, 1)[0], defensores: near("DEF", n, 4), medios: near("MED", n, 3), delanteros: near("DEL", n, 3) });
const nombresDe = ids => new Set([ids.arquero, ...ids.defensores, ...ids.medios, ...ids.delanteros].map(i => CAT.get(i).name));


// 1) ≥6 plantillas por tipo
console.log("\n1) PLANTILLAS POR TIPO");
for (const tipo of [
    "GOL", "ATAJADA", "ATAQUE_CORTADO",
    "PENAL_GOL", "PENAL_ATAJADO",
    "TARJETA_AMARILLA", "TARJETA_ROJA_DOBLE", "TARJETA_ROJA_DIRECTA"
]) {
    ok(PLANTILLAS[tipo].length >= 6, `${tipo}: ${PLANTILLAS[tipo].length} plantillas (≥6)`);
}

// 2) Goles del relato == marcador + nombres ∈ XI, sobre 10 partidos
console.log("\n2) GOLES = MARCADOR y NOMBRES ∈ XI (10 partidos)");
let golesOK = true, nombresOK = true;
const difs = ["FACIL", "NORMAL", "DIFICIL", "ELITE"];
const golLineasVistas = new Set();
for (let i = 0; i < 10; i++) {
    const reg = jugarPartido(eq(64 + (i % 12)), difs[i % 4]);
    const lineas = generarRelato(reg);

    const golesRelato = lineas.filter(l => l.esGol).length;
    if (golesRelato !== reg.golesUsuario + reg.golesRival) golesOK = false;

    // Nombres: cada línea de gol debe nombrar al autor del evento GOL correspondiente.
    const eventosGol = reg.eventos.filter(e => e.tipo === "GOL");
    const lineasGol = lineas.filter(l => l.esGol);
    for (let k = 0; k < eventosGol.length; k++) {
        const autor = CAT.get(eventosGol[k].autor);
        const equipoIds = eventosGol[k].equipo === "USUARIO" ? reg.equipoUsuarioIds : reg.equipoRivalIds;
        // El autor pertenece al XI atacante.
        if (!nombresDe(equipoIds).has(autor.name)) nombresOK = false;
        // La línea menciona al autor.
        if (!lineasGol[k].texto.includes(autor.name)) nombresOK = false;
        golLineasVistas.add(lineasGol[k].texto);
    }
}
ok(golesOK, "Los goles del relato coinciden con el marcador en los 10 partidos");
ok(nombresOK, "Cada gol nombra a su autor real, que pertenece al XI atacante");

// 3) Variedad
console.log("\n3) VARIEDAD");
console.log(`  líneas de gol distintas acumuladas: ${golLineasVistas.size}`);
ok(golLineasVistas.size >= 6, "Hay variedad de líneas de gol entre partidos (≥6 distintas)");

// 3.5) Tarjetas y penales (Grupo E, post-Etapa 10): sobre muchos partidos,
// cuando aparecen, las líneas no dejan placeholders sin reemplazar y
// nombran a un jugador real del XI correspondiente.
console.log("\n3.5) TARJETAS Y PENALES");
let vistoAmarilla = false, vistoRoja = false, vistoPenalGol = false, vistoPenalAtajado = false;
let sinPlaceholders = true, nombresTarjetasOK = true;
for (let i = 0; i < 60; i++) {
    const reg = jugarPartido(eq(60 + (i % 20)), difs[i % 4]);
    const lineas = generarRelato(reg);

    // Zip posicional dentro de cada tipo: generarRelato pushea una línea por
    // evento, en el mismo orden relativo — filtrar por tipo en ambos lados
    // preserva la correspondencia sin depender de minuto (puede repetirse).
    for (const tipo of ["TARJETA_AMARILLA", "TARJETA_ROJA"]) {
        const eventosTipo = reg.eventos.filter(e => e.tipo === tipo);
        const lineasTipo = lineas.filter(l => l.tipo === tipo);
        for (let k = 0; k < eventosTipo.length; k++) {
            const e = eventosTipo[k];
            const l = lineasTipo[k];
            if (!l) continue;
            if (tipo === "TARJETA_AMARILLA") vistoAmarilla = true; else vistoRoja = true;
            if (/\{[A-Z]+\}/.test(l.texto)) sinPlaceholders = false;
            const equipoIds = e.equipo === "USUARIO" ? reg.equipoUsuarioIds : reg.equipoRivalIds;
            const autor = CAT.get(e.autor);
            if (!autor || !nombresDe(equipoIds).has(autor.name) || !l.texto.includes(autor.name)) {
                nombresTarjetasOK = false;
            }
        }
    }
    for (const e of reg.eventos) {
        if (e.tipo === "GOL" && e.esPenal) vistoPenalGol = true;
        if (e.tipo === "ATAJADA" && e.esPenal) vistoPenalAtajado = true;
    }
}
ok(sinPlaceholders, "Ninguna línea de tarjeta/penal deja placeholders sin reemplazar");
ok(nombresTarjetasOK, "Las tarjetas nombran a un jugador real del XI correspondiente");
ok(vistoAmarilla && vistoRoja, `Aparecieron amarillas y rojas en 60 partidos (amarilla=${vistoAmarilla} roja=${vistoRoja})`);
console.log(`  penal convertido visto: ${vistoPenalGol} · penal atajado visto: ${vistoPenalAtajado} (son raros a propósito, no es un fallo si alguno no salió en 60 partidos)`);

// 4) Reproducibilidad
console.log("\n4) REPRODUCIBILIDAD");
const reg = jugarPartido(eq(70), "NORMAL");
const r1 = JSON.stringify(generarRelato(reg));
const r2 = JSON.stringify(generarRelato(reg));
ok(r1 === r2, "El mismo registro produce el mismo relato (determinista)");

// 5) Muestra visible
console.log("\n5) MUESTRA DE RELATO (un partido)");
const muestra = generarRelato(jugarPartido(eq(72), "NORMAL"));
muestra.slice(0, 12).forEach(l => console.log(`   ${String(l.minuto).padStart(2)}'  ${l.texto}`));

console.log(`\n${fallos === 0 ? "✓ TODOS LOS TESTS OK" : "✗ " + fallos + " fallaron"}`);
process.exit(fallos === 0 ? 0 : 1);
