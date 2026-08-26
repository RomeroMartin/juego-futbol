// ==========================================
// test-formaciones-mentalidades.mjs  (Etapa 5, §17, §19, §20.5)
// ==========================================
//
// Tests headless del sistema táctico:
//   - validarXI genérico por formación (§17.1) y generación de slots.
//   - fuerzaEfectiva completa (§20.5): mod de formación + mentalidad + matriz.
//   - la matriz se aplica UNA vez, al ataque del atacante (corrección de §20.5).
//   - fuerzaEquipo (display/§19.5) NO depende de la mentalidad (rival oculto).
//   - la mentalidad correcta gana más que la incorrecta (la táctica pesa).
//   - reproducibilidad con táctica activa.
//
//     node scripts/test-formaciones-mentalidades.mjs

import { JUGADORES } from "../js/data/jugadores.js";
import {
    FORMACIONES, CLAVES_FORMACION, slotsDeFormacion,
    equipoVacioDeFormacion, validarXI
} from "../js/config/formaciones.js";
import { MATRIZ_CONTRAS } from "../js/config/mentalidades.js";
import { fuerzaEquipo, fuerzaEfectiva, simularPartido } from "../js/core/motor.js";

let fallos = 0;
const ok = (cond, msg) => { console.log(`  ${cond ? "✓" : "✗"} ${msg}`); if (!cond) fallos++; };

const POOL = { POR: [], DEF: [], MED: [], DEL: [] };
for (const j of JUGADORES) POOL[j.position].push(j);

// Arma un roster con los cupos EXACTOS de una formación, a partir del pool.
function rosterDe(formacion) {
    const s = FORMACIONES[formacion].slots;
    return {
        id: "T",
        formacion,
        arquero: POOL.POR[0],
        defensores: POOL.DEF.slice(0, s.DEF),
        medios: POOL.MED.slice(0, s.MED),
        delanteros: POOL.DEL.slice(0, s.DEL),
        mentalidadOfensiva: "EQUILIBRADO",
        mentalidadDefensiva: "LINEA_MEDIA"
    };
}

// XI plano (array) desde un roster, para validarXI.
const xiDe = (e) => [e.arquero, ...e.defensores, ...e.medios, ...e.delanteros];


// ------------------------------------------
// 1) SLOTS Y validarXI POR FORMACIÓN (§17.1)
// ------------------------------------------
console.log("\n1) SLOTS Y validarXI POR FORMACIÓN (§17.1)");
for (const clave of CLAVES_FORMACION) {
    const slots = slotsDeFormacion(clave);
    const s = FORMACIONES[clave].slots;
    const total = s.POR + s.DEF + s.MED + s.DEL;
    const okCount = slots.length === total && total === 11;
    const xi = xiDe(rosterDe(clave));
    const v = validarXI(xi, clave);
    ok(okCount && v.valido, `${clave}: 11 slots (${s.POR}-${s.DEF}-${s.MED}-${s.DEL}) y XI válido`);
}

// XI con posición de menos → inválido señalando la posición.
{
    const xi = xiDe(rosterDe("4-3-3")).slice(0, 10); // saca un delantero
    const v = validarXI(xi, "4-3-3");
    ok(!v.valido && v.error === "POSICIONES_INCORRECTAS", "XI incompleto → POSICIONES_INCORRECTAS");
}
// XI con un duplicado → inválido.
{
    const base = xiDe(rosterDe("4-3-3"));
    const xi = [...base.slice(0, 10), base[0]]; // repite el arquero
    const v = validarXI(xi, "4-3-3");
    ok(!v.valido && v.error === "JUGADOR_DUPLICADO", "XI con id repetido → JUGADOR_DUPLICADO");
}
// equipoVacioDeFormacion tiene exactamente los slots de la formación.
{
    const vacio = equipoVacioDeFormacion("3-5-2");
    const claves = Object.keys(vacio).sort();
    const esperadas = slotsDeFormacion("3-5-2").map(s => s.slot).sort();
    ok(JSON.stringify(claves) === JSON.stringify(esperadas) && claves.every(k => vacio[k] === null),
        "equipoVacioDeFormacion('3-5-2') tiene los 11 slots en null");
}


// ------------------------------------------
// 2) MOD DE FORMACIÓN (§20.5, paso 0)
// ------------------------------------------
console.log("\n2) MOD DE FORMACIÓN (§20.5)");
{
    // Mismo pool relativo, distinta formación: el ataque efectivo sigue al mod.
    // 3-4-3 (ataque +7) debe dar más ataque que 5-3-2 (ataque -7) con rosters
    // comparables. Se compara el término de formación aislando la mentalidad neutra.
    const a343 = fuerzaEfectiva({ ...rosterDe("3-4-3") }, rosterDe("3-4-3"));
    const a532 = fuerzaEfectiva({ ...rosterDe("5-3-2") }, rosterDe("5-3-2"));
    ok(a343.ataque > a532.ataque, "3-4-3 (mod ataque +7) rinde más ataque que 5-3-2 (−7)");
    ok(a532.defensa > a343.defensa, "5-3-2 (mod defensa +9) rinde más defensa que 3-4-3 (−9)");
}


// ------------------------------------------
// 3) MATRIZ DE CONTRAS: una sola vez, al ataque (§19.3, §20.5 corregido)
// ------------------------------------------
console.log("\n3) MATRIZ DE CONTRAS (una sola vez, al ataque del atacante)");
{
    const yo = rosterDe("4-3-3");
    yo.mentalidadOfensiva = "EQUIPO_RAPIDO";
    // Rival con PRESIÓN ALTA: EQUIPO RÁPIDO la rompe (matriz > 1 → más ataque).
    const rivalPresion = { ...rosterDe("4-3-3"), mentalidadDefensiva: "PRESION_ALTA" };
    // Rival con BLOQUE COMPACTO: EQUIPO RÁPIDO se estrella (matriz < 1 → menos ataque).
    const rivalBloque = { ...rosterDe("4-3-3"), mentalidadDefensiva: "BLOQUE_COMPACTO" };

    const aVsPresion = fuerzaEfectiva(yo, rivalPresion).ataque;
    const aVsBloque = fuerzaEfectiva(yo, rivalBloque).ataque;
    ok(aVsPresion > aVsBloque, "EQUIPO RÁPIDO: más ataque vs PRESIÓN que vs BLOQUE (matriz aplicada)");
    ok(MATRIZ_CONTRAS.EQUIPO_RAPIDO.PRESION_ALTA > 1 && MATRIZ_CONTRAS.EQUIPO_RAPIDO.BLOQUE_COMPACTO < 1,
        "matriz efectiva: RÁPIDO×PRESIÓN >1 y RÁPIDO×BLOQUE <1 (relaciones de §19.3)");

    // La DEFENSA propia NO lleva multiplicador de matriz (no hay doble conteo):
    // cambia la mentalidad OFENSIVA del rival y mi defensa base no se mueve.
    const rivalOfA = { ...rosterDe("4-3-3"), mentalidadOfensiva: "EQUIPO_RAPIDO" };
    const rivalOfB = { ...rosterDe("4-3-3"), mentalidadOfensiva: "POSESION" };
    const dA = fuerzaEfectiva(yo, rivalOfA).defensa;
    const dB = fuerzaEfectiva(yo, rivalOfB).defensa;
    ok(Math.abs(dA - dB) < 1e-9, "mi defensa NO depende de la ofensiva rival (sin MATRIZ_CONTRAS_DEF)");
}


// ------------------------------------------
// 4) fuerzaEquipo (display §19.5) NO revela mentalidad
// ------------------------------------------
console.log("\n4) fuerzaEquipo (display) es rival-independiente y sin mentalidad (§19.5)");
{
    const base = rosterDe("4-3-3");
    const conRapido = { ...base, mentalidadOfensiva: "EQUIPO_RAPIDO" };
    const conPosesion = { ...base, mentalidadOfensiva: "POSESION" };
    const f1 = fuerzaEquipo(conRapido);
    const f2 = fuerzaEquipo(conPosesion);
    ok(f1.ataque === f2.ataque && f1.medio === f2.medio && f1.defensa === f2.defensa,
        "fuerzaEquipo ignora la mentalidad (lo que se muestra antes del partido no la filtra)");
}


// ------------------------------------------
// 5) LA TÁCTICA PESA: correcta gana más que incorrecta
// ------------------------------------------
console.log("\n5) LA MENTALIDAD CORRECTA GANA MÁS QUE LA INCORRECTA");
{
    // Dos equipos del mismo pool (parejos). El rival juega PRESIÓN ALTA fija.
    const rival = { ...rosterDe("4-3-3"), id: "R", mentalidadDefensiva: "PRESION_ALTA" };
    const correcta = { ...rosterDe("4-3-3"), id: "Y", mentalidadOfensiva: "EQUIPO_RAPIDO" }; // rompe PRESIÓN
    const incorrecta = { ...rosterDe("4-3-3"), id: "Y", mentalidadOfensiva: "POSESION" };     // castigada por PRESIÓN
    let vc = 0, vi = 0;
    for (let s = 1; s <= 400; s++) {
        if (simularPartido(correcta, rival, s * 7).golesA > simularPartido(correcta, rival, s * 7).golesB) vc++;
        if (simularPartido(incorrecta, rival, s * 7).golesA > simularPartido(incorrecta, rival, s * 7).golesB) vi++;
    }
    console.log(`   correcta (RÁPIDO) gana ${vc}/400 · incorrecta (POSESIÓN) gana ${vi}/400`);
    ok(vc > vi, "la mentalidad correcta gana más partidos que la incorrecta contra el mismo rival");
}


// ------------------------------------------
// 6) REPRODUCIBILIDAD CON TÁCTICA
// ------------------------------------------
console.log("\n6) REPRODUCIBILIDAD CON TÁCTICA ACTIVA");
{
    const A = { ...rosterDe("3-4-3"), id: "A", mentalidadOfensiva: "JUEGO_ABIERTO", mentalidadDefensiva: "BLOQUE_COMPACTO" };
    const B = { ...rosterDe("4-2-3-1"), id: "B", mentalidadOfensiva: "POSESION", mentalidadDefensiva: "PRESION_ALTA" };
    const r1 = simularPartido(A, B, 123456);
    const r2 = simularPartido(A, B, 123456);
    ok(JSON.stringify(r1) === JSON.stringify(r2), "misma semilla + misma táctica → idéntico byte a byte");
}


console.log(`\n${fallos === 0 ? "✓ TODOS LOS TESTS OK" : "✗ " + fallos + " test(s) fallaron"}`);
process.exit(fallos === 0 ? 0 : 1);
