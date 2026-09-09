// ==========================================
// PRNG CON SEMILLA (§23)
// ==========================================
//
// mulberry32: generador pseudoaleatorio determinista. Se usa en el MOTOR DE
// PARTIDO en lugar de Math.random() por dos razones (§23):
//
//   1. Testeo de balance: simular 10.000 partidos de forma reproducible.
//   2. Anti-trampa: el servidor re-verifica un partido reproduciendo la semilla.
//
// Un partido es 100% reproducible a partir de { semilla, equipoA, equipoB }.
//
// Math.imul y los corrimientos de bits NO son azar: son la aritmética del
// generador. La ÚNICA fuente de azar del motor es esta función; Math.random()
// está prohibido en el motor.

export function mulberry32(semilla) {
    return function () {
        semilla |= 0;
        semilla = (semilla + 0x6D2B79F5) | 0;
        let t = Math.imul(semilla ^ (semilla >>> 15), 1 | semilla);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
