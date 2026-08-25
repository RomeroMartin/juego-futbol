// ==========================================
// test-rival-ia.mjs  (Etapa 3)
// ==========================================
//
// Tests headless del rival IA y del partido vs IA:
//   - % de victoria del usuario por dificultad (50 partidos c/u).
//   - Variedad del rival (20 rivales misma dificultad → cuántos XI distintos).
//   - Nombres ficticios: cero colisión con los 30 clubes reales del dataset.
//   - Perfiles no degenerados (ninguna área se desvía >12 de la media).
//   - Re-verificación por semilla (§53.1).
//
//     node scripts/test-rival-ia.mjs

import { JUGADORES } from "../js/data/jugadores.js";
import { generarRivalIA, DIFICULTADES } from "../js/core/rivalIA.js";
import { jugarPartido, reVerificar } from "../js/core/partido.js";
import { PREFIJOS, NUCLEOS, NUCLEOS_PLURALES } from "../js/data/nombresRival.js";
import { fuerzaEfectiva } from "../js/core/motor.js";

let fallos = 0;
const ok = (cond, msg) => { console.log(`  ${cond ? "✓" : "✗"} ${msg}`); if (!cond) fallos++; };


// Pool para armar equipos de usuario de prueba.
const POOL = { POR: [], DEF: [], MED: [], DEL: [] };
for (const j of JUGADORES) POOL[j.position].push(j);
for (const k in POOL) POOL[k].sort((a, b) => a.overall - b.overall);

const near = (cat, niv, n) => {
    let w = 3, c = POOL[cat].filter(j => Math.abs(j.overall - niv) <= w);
    while (c.length < n) { w += 2; c = POOL[cat].filter(j => Math.abs(j.overall - niv) <= w); }
    const p = c.slice(), o = [];
    for (let i = 0; i < n; i++) o.push(p.splice(Math.floor(Math.random() * p.length), 1)[0]);
    return o;
};
const equipoUsuario = (niv) => ({
    id: "USUARIO",
    arquero: near("POR", niv, 1)[0],
    defensores: near("DEF", niv, 4),
    medios: near("MED", niv, 3),
    delanteros: near("DEL", niv, 3)
});
const media = a => (a.ataque + a.medio + a.defensa) / 3;
const idsXI = e => [e.arquero.id, ...e.defensores.map(j => j.id), ...e.medios.map(j => j.id), ...e.delanteros.map(j => j.id)].sort((a, b) => a - b).join(",");


// ------------------------------------------
// 1) % de victoria por dificultad (50 c/u)
// ------------------------------------------
console.log("\n1) % DE VICTORIA DEL USUARIO POR DIFICULTAD (50 partidos, XI nivel 70)");
const resultadosPorDif = {};
for (const dif of DIFICULTADES) {
    let v = 0, e = 0, d = 0;
    for (let i = 0; i < 50; i++) {
        const reg = jugarPartido(equipoUsuario(70), dif);
        if (reg.resultado === "V") v++; else if (reg.resultado === "E") e++; else d++;
    }
    resultadosPorDif[dif] = { v, e, d };
    console.log(`  ${dif.padEnd(7)} → V ${v}  E ${e}  D ${d}   (victorias ${(100 * v / 50).toFixed(0)}%)`);
}
ok(resultadosPorDif.FACIL.v > resultadosPorDif.FACIL.d, "FÁCIL: ganás más de lo que perdés");
ok(resultadosPorDif.ELITE.d > resultadosPorDif.ELITE.v, "ÉLITE: perdés más de lo que ganás");
ok(resultadosPorDif.FACIL.v >= resultadosPorDif.NORMAL.v &&
   resultadosPorDif.NORMAL.v >= resultadosPorDif.ELITE.v,
   "Monotonía: victorias FÁCIL ≥ NORMAL ≥ ÉLITE");


// ------------------------------------------
// 2) Variedad del rival (20 en misma dificultad)
// ------------------------------------------
console.log("\n2) VARIEDAD: 20 rivales NORMAL contra el mismo usuario");
const u = equipoUsuario(68);
const xis = new Set();
const clubesVistos = new Set();
for (let i = 0; i < 20; i++) {
    const rival = generarRivalIA(media(fuerzaEfectiva(u, u)), "NORMAL");
    xis.add(idsXI(rival.equipo));
    [rival.equipo.arquero, ...rival.equipo.defensores, ...rival.equipo.medios, ...rival.equipo.delanteros]
        .forEach(j => clubesVistos.add(j.club));
}
console.log(`  XI distintos: ${xis.size}/20 | clubes distintos vistos: ${clubesVistos.size}`);
ok(xis.size >= 15, "Al menos 15 XI distintos de 20 (variedad real)");


// ------------------------------------------
// 3) Nombres ficticios: cero colisión con clubes reales
// ------------------------------------------
console.log("\n3) NOMBRES FICTICIOS vs CLUBES REALES");
const clubesReales = new Set(JUGADORES.map(j => j.club));
console.log(`  clubes reales en el dataset: ${clubesReales.size}`);
// Espacio COMPLETO de nombres generables.
const nombresGenerables = new Set();
for (const p of PREFIJOS) for (const n of NUCLEOS) nombresGenerables.add(`${p} ${n}`);
for (const n of NUCLEOS_PLURALES) nombresGenerables.add(`Los ${n}`);
console.log(`  nombres generables: ${nombresGenerables.size}`);
const colisiones = [...nombresGenerables].filter(n => clubesReales.has(n));
// Chequeo extra: ningún núcleo/plural coincide EXACTO con un club real.
const tokenColision = [...NUCLEOS, ...NUCLEOS_PLURALES].filter(n => clubesReales.has(n));
ok(colisiones.length === 0, `Ningún nombre generable es un club real (colisiones: ${colisiones.length})`);
ok(tokenColision.length === 0, `Ningún núcleo coincide con un club real (${tokenColision.join(", ") || "ninguno"})`);


// ------------------------------------------
// 4) Perfiles no degenerados
// ------------------------------------------
console.log("\n4) PERFILES NO DEGENERADOS (área no se desvía >12 de la media)");
let peorDesvio = 0;
for (let i = 0; i < 200; i++) {
    const dif = DIFICULTADES[i % 4];
    const rival = generarRivalIA(media(fuerzaEfectiva(equipoUsuario(50 + (i % 30)), equipoUsuario(60))), dif);
    const a = rival.areas, m = rival.fuerzaMedia;
    const dev = Math.max(Math.abs(a.ataque - m), Math.abs(a.medio - m), Math.abs(a.defensa - m));
    if (dev > peorDesvio) peorDesvio = dev;
}
console.log(`  peor desvío de área observado: ${peorDesvio.toFixed(1)}`);
ok(peorDesvio <= 12.0001, "Ningún rival tiene un área que se desvíe >12 de su media");


// ------------------------------------------
// 5) Re-verificación por semilla (§53.1)
// ------------------------------------------
console.log("\n5) RE-VERIFICACIÓN POR SEMILLA");
let reOK = true;
for (let i = 0; i < 30; i++) {
    const reg = jugarPartido(equipoUsuario(66 + (i % 8)), DIFICULTADES[i % 4]);
    const v = reVerificar(reg);
    if (!v.coincide) { reOK = false; console.log("  ✗ no coincide:", reg.golesUsuario, reg.golesRival, "vs", v.golesUsuario, v.golesRival); }
}
ok(reOK, "30 partidos: re-simular con la semilla guardada da el mismo marcador");


// ------------------------------------------
// 6) Capado comunicado
// ------------------------------------------
console.log("\n6) CAPADO (ÉLITE contra un usuario muy fuerte)");
const fuerte = equipoUsuario(80);
const rElite = generarRivalIA(media(fuerzaEfectiva(fuerte, fuerte)), "ELITE");
console.log(`  usuario fuerza ${media(fuerzaEfectiva(fuerte, fuerte)).toFixed(1)} | ÉLITE pedía +14 | offset real ${rElite.offsetReal.toFixed(1)} | capado: ${rElite.capado}`);
ok(rElite.capado === true, "Contra un usuario tope, ÉLITE queda capado (offset real < solicitado)");


console.log(`\n${fallos === 0 ? "✓ TODOS LOS TESTS OK" : "✗ " + fallos + " test(s) fallaron"}`);
process.exit(fallos === 0 ? 0 : 1);
