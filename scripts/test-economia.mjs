// ==========================================
// test-economia.mjs  (Etapa 6)
// ==========================================
//
// Tests headless de la economía (§13, §14, §15). Deterministas: usan mulberry32
// como fuente de azar (aunque la economía NO es el motor; acá la semilla es solo
// para reproducir los tests, ver core/economia.js).
//
//     node scripts/test-economia.mjs

import { mulberry32 } from "../js/core/prng.js";
import { ECONOMIA } from "../js/config/economia.js";
import { FORMACIONES } from "../js/config/formaciones.js";
import {
    usuarioNuevo,
    abrirPaquete,
    debeGarantizarArquero,
    debeGarantizarDestacado,
    registrarResultadoEconomia,
    comprarPaquete,
    venderRepetido,
    POSICIONES
} from "../js/core/economia.js";

let fallos = 0;
const ok = (cond, msg) => { console.log(`  ${cond ? "✓" : "✗"} ${msg}`); if (!cond) fallos++; };
const pct = (n, d) => (100 * n / d).toFixed(2) + "%";

// Cuenta jugadores DISTINTOS por posición en una colección.
function distintosPorPosicion(coleccion) {
    const c = { POR: 0, DEF: 0, MED: 0, DEL: 0 };
    for (const item of coleccion) c[item.player.position]++;
    return c;
}

// ¿La colección alcanza para armar un XI válido en ALGUNA de las 6 formaciones
// (§17)? El usuario no está atado al 4-3-3: elige la formación que le cierre con
// lo que tiene. Un XI es válido si cubre los slots de al menos una formación.
function formacionQueAlcanza(coleccion) {
    const c = distintosPorPosicion(coleccion);
    for (const [nombre, def] of Object.entries(FORMACIONES)) {
        const s = def.slots;
        if (c.POR >= s.POR && c.DEF >= s.DEF && c.MED >= s.MED && c.DEL >= s.DEL) {
            return nombre;
        }
    }
    return null;
}


// ============================================================
// 1) 100 usuarios nuevos arman un XI válido con los 5 paquetes
// ============================================================
console.log("\n1) 100 USUARIOS NUEVOS → ¿arman un XI válido (alguna de las 6 formaciones) con los 5 paquetes?");
{
    const N = 100;
    let noAlcanza = 0;
    let bajadas = 0;
    const usoFormacion = {};
    for (let u = 0; u < N; u++) {
        const rand = mulberry32(1000 + u);
        const usuario = usuarioNuevo();
        const coleccion = [];
        // 5 paquetes de bienvenida: el 1º especial (composición), 4 BASICO.
        for (let p = 0; p < ECONOMIA.paquetesBienvenida; p++) {
            const { meta } = abrirPaquete(usuario, coleccion, "BASICO", { silencioso: true }, rand);
            bajadas += meta.bajadasDeRareza;
        }
        const form = formacionQueAlcanza(coleccion);
        if (!form) {
            noAlcanza++;
            const c = distintosPorPosicion(coleccion);
            console.log(`    usuario ${u}: NO alcanza NINGUNA formación → POR${c.POR} DEF${c.DEF} MED${c.MED} DEL${c.DEL}`);
        } else {
            usoFormacion[form] = (usoFormacion[form] || 0) + 1;
        }
    }
    console.log(`   Usuarios que NO alcanzan ninguna formación: ${noAlcanza} / ${N}`);
    console.log(`   Formación con la que arrancan (primera que cierra): ${JSON.stringify(usoFormacion)}`);
    console.log(`   Bajadas de rareza por posición en el proceso: ${bajadas}`);
    ok(noAlcanza === 0, "los 100 usuarios nuevos arman un XI válido en al menos una formación (esperado 0)");
}


// ============================================================
// 2) Con 0 arqueros, el próximo paquete trae uno (§13.2)
// ============================================================
console.log("\n2) 0 ARQUEROS EN COLECCIÓN → el próximo paquete BASICO trae un POR");
{
    const N = 300;
    let sinArquero = 0;
    ok(debeGarantizarArquero(usuarioNuevo(), []), "con colección vacía, debeGarantizarArquero = true");
    for (let s = 0; s < N; s++) {
        const rand = mulberry32(50000 + s);
        const usuario = usuarioNuevo();
        usuario.primerPaqueteEspecialPendiente = false;   // saltear la bienvenida
        const coleccion = [];                             // 0 arqueros
        const { cartas } = abrirPaquete(usuario, coleccion, "BASICO", { silencioso: true }, rand);
        if (!cartas.some(c => c.position === "POR")) sinArquero++;
    }
    console.log(`   Paquetes sin POR: ${sinArquero} / ${N}`);
    ok(sinArquero === 0, "todos los paquetes con 0 arqueros previos traen al menos 1 POR");
}


// ============================================================
// 3) 10 paquetes sin DESTACADO → el 11 lo garantiza (§13.3)
// ============================================================
console.log("\n3) PITY DE RAREZA: 10 sin DESTACADO → el 11 garantiza DESTACADO+");
{
    // Umbrales del contador.
    const u9 = usuarioNuevo();  u9.paquetesDesdeUltimoDestacado = 9;
    const u10 = usuarioNuevo(); u10.paquetesDesdeUltimoDestacado = 10;
    ok(!debeGarantizarDestacado(u9), "con 9 paquetes sin DESTACADO todavía NO se garantiza");
    ok(debeGarantizarDestacado(u10), "con 10 paquetes sin DESTACADO el siguiente SÍ se garantiza");

    const orden = ECONOMIA.ordenRareza;
    const idxObj = orden.indexOf(ECONOMIA.rarezaPityObjetivo);
    const N = 300;
    let sinDestacado = 0;
    for (let s = 0; s < N; s++) {
        const rand = mulberry32(90000 + s);
        const usuario = usuarioNuevo();
        usuario.primerPaqueteEspecialPendiente = false;
        usuario.paquetesDesdeUltimoDestacado = 10;   // el próximo debe garantizar
        const coleccion = [{ player: { id: -1, position: "POR", rarity: "COMUN" }, quantity: 1 }]; // ya tiene arquero
        const { cartas } = abrirPaquete(usuario, coleccion, "BASICO", { silencioso: true }, rand);
        if (!cartas.some(c => orden.indexOf(c.rarity) >= idxObj)) sinDestacado++;
    }
    console.log(`   Paquetes garantizados sin DESTACADO+: ${sinDestacado} / ${N}`);
    ok(sinDestacado === 0, "el paquete nº 11 siempre trae al menos 1 DESTACADO o superior");
}


// ============================================================
// 4) 10.000 aperturas → distribución de rareza converge a §14
// ============================================================
console.log("\n4) DISTRIBUCIÓN DE RAREZA (10.000 paquetes, sin pity, vs §14)");
{
    const rand = mulberry32(7);
    const usuario = usuarioNuevo();
    usuario.primerPaqueteEspecialPendiente = false;
    // Colección con un arquero para que el pity de arquero no dispare.
    const coleccion = [{ player: { id: -1, position: "POR", rarity: "COMUN" }, quantity: 1 }];

    const conteo = { COMUN: 0, ORO: 0, DESTACADO: 0, ESTRELLA: 0, LEYENDA: 0 };
    let total = 0;
    const N = 10000;
    for (let p = 0; p < N; p++) {
        // Neutralizar el pity para medir la distribución PURA de §14.
        usuario.paquetesDesdeUltimoArquero = 0;
        usuario.paquetesDesdeUltimoDestacado = 0;
        const { cartas } = abrirPaquete(usuario, coleccion, "BASICO", { silencioso: true }, rand);
        for (const c of cartas) { conteo[c.rarity]++; total++; }
    }
    console.log(`   Cartas totales: ${total}`);
    console.log("   Rareza      | real     | objetivo §14");
    let maxDesvio = 0;
    for (const r of ECONOMIA.ordenRareza) {
        const real = conteo[r] / total;
        const obj = ECONOMIA.probabilidadesRareza[r];
        const desvio = Math.abs(real - obj);
        maxDesvio = Math.max(maxDesvio, desvio);
        console.log(`   ${r.padEnd(11)} | ${pct(conteo[r], total).padStart(7)} | ${(obj * 100).toFixed(1)}%`);
    }
    // Tolerancia amplia por rarezas raras (LEYENDA 0.3%); con 60k cartas alcanza.
    ok(maxDesvio < 0.02, `la distribución converge a §14 (desvío máx ${(maxDesvio * 100).toFixed(2)}% < 2%)`);
}


// ============================================================
// 5) 20 partidos vs IA: Fichas suben, puntos quedan en 0 (§15.3)
// ============================================================
console.log("\n5) 20 PARTIDOS vs IA → Fichas suben, contador de puntos = 0");
{
    const usuario = usuarioNuevo();
    const hoy = "2026-08-26";
    const resultados = ["V", "E", "D"];
    let esperadoFichas = 0;
    let algunPunto = false;
    for (let i = 0; i < 20; i++) {
        const res = resultados[i % 3];
        const r = registrarResultadoEconomia(usuario, "IA", res, hoy);
        esperadoFichas += r.fichas;
        if (r.puntos !== 0) algunPunto = true;
    }
    ok(!algunPunto, "ningún partido vs IA otorgó puntos");
    // Primer partido del día: +50; el resto no. Fichas por resultado: V+25, E+10, D+0.
    console.log(`   Fichas acumuladas: ${usuario.monedas.fichas} · puntos: ${usuario.puntosAcumulados}`);
    ok(usuario.monedas.fichas > 0, "las Fichas subieron jugando vs IA");
    ok(usuario.monedas.fichas === esperadoFichas, "las Fichas coinciden con la suma esperada");
    ok(usuario.puntosAcumulados === 0, "el contador de puntos quedó en 0 (la IA no suma)");
    ok(usuario.packsPremiumGanados === 0, "no se otorgó ningún Pack PREMIUM jugando vs IA");

    // Control: un partido de TORNEO SÍ sumaría puntos (código de Etapa 10 ya listo).
    const u2 = usuarioNuevo();
    registrarResultadoEconomia(u2, "TORNEO", "V", hoy);
    ok(u2.puntosAcumulados === ECONOMIA.puntos.torneo.victoria,
        `un partido de torneo sí suma puntos (${u2.puntosAcumulados})`);
}


// ============================================================
// 6) Comprar un paquete con Fichas descuenta el monto correcto (§15.5)
// ============================================================
console.log("\n6) COMPRA EN LA TIENDA → descuenta el monto correcto");
{
    const usuario = usuarioNuevo();
    usuario.monedas.fichas = 1000;
    const r = comprarPaquete(usuario, "BASICO");
    ok(r.ok && usuario.monedas.fichas === 1000 - ECONOMIA.precios.BASICO,
        `BASICO (${ECONOMIA.precios.BASICO}): 1000 → ${usuario.monedas.fichas}`);

    const r2 = comprarPaquete(usuario, "PREMIUM");   // 1200 > 700 restantes
    ok(!r2.ok && usuario.monedas.fichas === 700,
        "sin Fichas suficientes la compra se rechaza y no descuenta");
}


// ============================================================
// 7) Vender un repetido con quantity 1 no se puede (§15.4)
// ============================================================
console.log("\n7) VENTA DE REPETIDOS → quantity 1 no se puede; quantity ≥ 2 sí");
{
    const usuario = usuarioNuevo();
    const coleccion = [
        { player: { id: 1, position: "DEL", rarity: "ORO" }, quantity: 1 },
        { player: { id: 2, position: "DEF", rarity: "COMUN" }, quantity: 3 }
    ];
    const r1 = venderRepetido(usuario, coleccion, 1);
    ok(!r1.ok && usuario.monedas.fichas === 0, "no se puede vender la última copia (quantity 1)");

    const r2 = venderRepetido(usuario, coleccion, 2);
    ok(r2.ok && usuario.monedas.fichas === ECONOMIA.venderRepetido.COMUN && coleccion[1].quantity === 2,
        `se vende un repetido (quantity 3→2) y suma ${ECONOMIA.venderRepetido.COMUN} Fichas`);
}


// ============================================================
// 8) POSICIONAL 500x por posición: SIEMPRE de la posición pedida
// ============================================================
console.log("\n8) PAQUETE POSICIONAL → las 6 cartas son SIEMPRE de la posición pedida");
{
    const totalBajadas = {};
    let violaciones = 0;
    for (const pos of POSICIONES) {
        const rand = mulberry32(20000 + pos.charCodeAt(0));
        let bajadas = 0;
        for (let p = 0; p < 500; p++) {
            const usuario = usuarioNuevo();
            usuario.primerPaqueteEspecialPendiente = false;
            const coleccion = [];
            const { cartas, meta } = abrirPaquete(
                usuario, coleccion, "POSICIONAL", { posicion: pos, silencioso: true }, rand
            );
            bajadas += meta.bajadasDeRareza;
            if (cartas.length !== 6 || cartas.some(c => c.position !== pos)) violaciones++;
        }
        totalBajadas[pos] = bajadas;
    }
    console.log("   Bajadas de rareza por posición (500 paquetes c/u):");
    for (const pos of POSICIONES) {
        const b = totalBajadas[pos];
        console.log(`     ${pos}: ${b} bajadas en 3000 cartas (${pct(b, 3000)})`);
    }
    ok(violaciones === 0, "en 2000 paquetes POSICIONAL, TODAS las cartas respetan la posición pedida");
}


// ============================================================
console.log(`\n${fallos === 0 ? "✅ TODO EN VERDE" : `❌ ${fallos} FALLO(S)`}`);
process.exit(fallos === 0 ? 0 : 1);
