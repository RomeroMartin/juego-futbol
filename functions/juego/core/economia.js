// ==========================================
// ECONOMÍA — LÓGICA PURA (§13, §14, §15)
// ==========================================
//
// Apertura de paquetes, pity, Fichas, puntos, tienda y venta de repetidos.
//
// Todo acá es PURO y testeable headless: sin DOM, sin localStorage. La fuente de
// azar (`rand`) es inyectable (default Math.random); los tests le pasan un PRNG
// con semilla (mulberry32) para reproducir aperturas.
//
// ⚠️ En la Etapa 6 la apertura corre en el CLIENTE con Math.random. Es inseguro
// a propósito: se mueve a Cloud Functions en la Etapa 8 (§15.0). Por eso NO se
// usa el PRNG del motor acá: no hay nada que "re-verificar" todavía.
//
// 🔑 Clave canónica de rareza: "COMUN" sin tilde (igual que el dataset). Ver
// config/economia.js.

import { JUGADORES } from "../data/jugadores.js";
import { ECONOMIA } from "../config/economia.js";


export const POSICIONES = ["POR", "DEF", "MED", "DEL"];

// Versión de schema del modelo de usuario (§44).
export const SCHEMA_USUARIO = 3;


// ==========================================
// ÍNDICES DEL POOL (por rareza y por rareza+posición)
// ==========================================
//
// Se construyen una sola vez al cargar el módulo. La selección dentro de una
// rareza es UNIFORME (§14.1), así que basta con listas por categoría.

const POOL_POR_RAREZA = {};       // { COMUN: [...jugadores], ... }
const POOL_POR_RAREZA_POS = {};   // { "COMUN|POR": [...], ... }

for (const r of ECONOMIA.ordenRareza) {
    POOL_POR_RAREZA[r] = [];
    for (const p of POSICIONES) POOL_POR_RAREZA_POS[`${r}|${p}`] = [];
}
for (const j of JUGADORES) {
    if (POOL_POR_RAREZA[j.rarity]) POOL_POR_RAREZA[j.rarity].push(j);
    const clave = `${j.rarity}|${j.position}`;
    if (POOL_POR_RAREZA_POS[clave]) POOL_POR_RAREZA_POS[clave].push(j);
}


// ==========================================
// HELPERS DE RAREZA
// ==========================================

// Índice de una rareza en el orden menor→mayor (COMUN=0 … LEYENDA=4).
function idxRareza(r) {
    return ECONOMIA.ordenRareza.indexOf(r);
}

// ¿La rareza `a` es igual o superior a `b`?
function rarezaGte(a, b) {
    return idxRareza(a) >= idxRareza(b);
}


// ==========================================
// SORTEO DE RAREZA (§14)
// ==========================================

// Tira una rareza según las probabilidades por carta de §14.
export function tirarRareza(rand = Math.random) {
    const orden = ECONOMIA.ordenRareza;
    const x = rand();
    let acc = 0;
    for (const r of orden) {
        acc += ECONOMIA.probabilidadesRareza[r];
        if (x < acc) return r;
    }
    return orden[orden.length - 1];   // borde numérico (x ≈ 1)
}

// Tira una rareza pero acotada a `minRareza` o superior, renormalizando los
// pesos de §14. Se usa cuando una garantía obliga a subir la rareza de una carta.
function tirarRarezaMin(minRareza, rand) {
    const orden = ECONOMIA.ordenRareza;
    const permitidas = orden.slice(idxRareza(minRareza));
    const total = permitidas.reduce((a, r) => a + ECONOMIA.probabilidadesRareza[r], 0);
    let x = rand() * total, acc = 0;
    for (const r of permitidas) {
        acc += ECONOMIA.probabilidadesRareza[r];
        if (x < acc) return r;
    }
    return permitidas[permitidas.length - 1];
}


// ==========================================
// SELECCIÓN DE UNA CARTA
// ==========================================
//
// Elige un jugador uniforme dentro de la rareza (§14.1), evitando duplicados
// dentro del mismo paquete (§14.2).
//
// Regla de la ACLARACIÓN 1 (posición forzada + rareza sin esa posición):
// cuando la carta tiene la posición forzada (bienvenida, POSICIONAL o pity de
// arquero) y la rareza sorteada no tiene NINGÚN jugador de esa posición, se BAJA
// de rareza hasta encontrar una que sí tenga. Nunca se cambia la posición. Cada
// bajada se cuenta en `meta.bajadasDeRareza` y se loguea (salvo modo silencioso).

function elegirCarta(rarezaInicial, posicion, ids, rand, meta) {
    const orden = ECONOMIA.ordenRareza;
    let idx = idxRareza(rarezaInicial);

    // Paso 1 — Aclaración 1: bajar si la posición forzada no existe en la rareza.
    if (posicion) {
        let idx2 = idx;
        while (idx2 >= 0 && POOL_POR_RAREZA_POS[`${orden[idx2]}|${posicion}`].length === 0) {
            idx2--;
        }
        if (idx2 >= 0 && idx2 < idx) {
            meta.bajadasDeRareza++;
            if (!meta.silencioso) {
                console.warn(
                    `[economía] Bajada de rareza: ${orden[idx]} no tiene ${posicion}; ` +
                    `se usa ${orden[idx2]} (§13.1 / Aclaración 1).`
                );
            }
        }
        if (idx2 >= 0) idx = idx2;
    }

    // Paso 2: elegir uniforme evitando duplicados. Si la rareza está agotada de
    // no-repetidos (fallback muy improbable), se baja una rareza más. Esa bajada
    // por duplicado NO cuenta como "bajada de rareza por posición".
    for (; idx >= 0; idx--) {
        const r = orden[idx];
        const pool = posicion ? POOL_POR_RAREZA_POS[`${r}|${posicion}`] : POOL_POR_RAREZA[r];
        const candidatos = pool.filter(j => !ids.has(j.id));
        if (candidatos.length > 0) {
            const elegido = candidatos[Math.floor(rand() * candidatos.length)];
            ids.add(elegido.id);
            return elegido;
        }
    }
    return null;   // sin candidatos en ninguna rareza (imposible con este pool)
}

// Llena una carta: sortea la rareza (acotada por `rarezaMinima` si se pide) y
// elige el jugador con la regla de arriba.
function llenarCarta(posicion, rarezaMinima, ids, rand, meta) {
    const rareza = rarezaMinima ? tirarRarezaMin(rarezaMinima, rand) : tirarRareza(rand);
    return elegirCarta(rareza, posicion, ids, rand, meta);
}


// ==========================================
// GARANTÍAS (reemplazo de la carta más floja)
// ==========================================

// Índice de la carta de MENOR rareza (la que menos duele reemplazar). Se puede
// excluir una posición (p. ej. no pisar el arquero que otra garantía ya metió).
function indiceMasFloja(cartas, excluirPosicion) {
    let mejor = -1, mejorIdx = Infinity;
    for (let i = 0; i < cartas.length; i++) {
        if (excluirPosicion && cartas[i].position === excluirPosicion) continue;
        const r = idxRareza(cartas[i].rarity);
        if (r < mejorIdx) { mejorIdx = r; mejor = i; }
    }
    // Si todas eran de la posición excluida, no excluir.
    if (mejor === -1) return indiceMasFloja(cartas, null);
    return mejor;
}

// Reemplaza la carta más floja por una nueva con la restricción pedida.
function reemplazarUnaCarta(cartas, ids, posicion, rarezaMinima, rand, meta, excluirPosicion) {
    const idx = indiceMasFloja(cartas, excluirPosicion);
    ids.delete(cartas[idx].id);
    cartas[idx] = llenarCarta(posicion, rarezaMinima, ids, rand, meta);
}


// ==========================================
// PITY (§13.2, §13.3)
// ==========================================

// ¿El próximo paquete debe garantizar un arquero? (§13.2)
export function debeGarantizarArquero(usuario, coleccion) {
    const tieneArquero = coleccion.some(item => (item.player || item).position === "POR");
    if (!tieneArquero) return true;
    if (usuario.paquetesDesdeUltimoArquero >= ECONOMIA.pityArqueroMax) return true;
    return false;
}

// ¿El próximo paquete debe garantizar un DESTACADO o superior? (§13.3)
export function debeGarantizarDestacado(usuario) {
    return usuario.paquetesDesdeUltimoDestacado >= ECONOMIA.pityRarezaMax;
}

// Actualiza los contadores de pity según lo que salió en el paquete.
function actualizarPity(usuario, cartas) {
    const hayArquero = cartas.some(c => c.position === "POR");
    usuario.paquetesDesdeUltimoArquero = hayArquero
        ? 0 : usuario.paquetesDesdeUltimoArquero + 1;

    const hayDestacado = cartas.some(c => rarezaGte(c.rarity, ECONOMIA.rarezaPityObjetivo));
    usuario.paquetesDesdeUltimoDestacado = hayDestacado
        ? 0 : usuario.paquetesDesdeUltimoDestacado + 1;
}


// ==========================================
// GENERACIÓN DEL PRIMER PAQUETE DE BIENVENIDA (§13.1)
// ==========================================
//
// Composición garantizada por posición (1 POR / 2 DEF / 2 MED / 1 DEL) y al
// menos 1 carta de la rareza mínima (ORO) o superior.

function generarBienvenida(rand, meta) {
    const comp = ECONOMIA.primerPaqueteBienvenida.composicion;
    const min = ECONOMIA.primerPaqueteBienvenida.rarezaMinima;

    const cartas = [];
    const ids = new Set();

    for (const pos of POSICIONES) {
        for (let k = 0; k < (comp[pos] || 0); k++) {
            cartas.push(llenarCarta(pos, null, ids, rand, meta));
        }
    }

    // Garantía de rareza mínima, conservando la posición de la carta (la
    // composición es una promesa explícita, la rareza es el sorteo).
    if (!cartas.some(c => rarezaGte(c.rarity, min))) {
        const idx = indiceMasFloja(cartas, null);
        const pos = cartas[idx].position;
        ids.delete(cartas[idx].id);
        cartas[idx] = llenarCarta(pos, min, ids, rand, meta);
    }

    return cartas;
}


// ==========================================
// GENERACIÓN DE UN PAQUETE ESTÁNDAR (§14)
// ==========================================
//
// BASICO / PREMIUM: 6 cartas sin restricción de posición.
// POSICIONAL: 6 cartas de la posición elegida por el usuario al abrir.
//
// Garantías aplicadas después del sorteo base:
//   - Arquero (§13.2): solo en paquetes SIN posición fija. Un POSICIONAL nunca
//     rompe su promesa de posición para meter un arquero (si es POSICIONAL POR,
//     ya son todos arqueros; si es de otra posición, el pity se resuelve en el
//     próximo paquete no-posicional).
//   - Rareza (§13.3 pity, o garantía del tipo PREMIUM): se sube UNA carta a la
//     rareza objetivo, conservando la posición del paquete si la hubiera.

function generarEstandar(posicion, conf, usuario, coleccion, rand, meta) {
    const n = ECONOMIA.jugadoresPorPaquete;

    // Garantías decididas ANTES de generar (leen el estado previo del usuario).
    const garantizaArquero = !posicion && debeGarantizarArquero(usuario, coleccion);
    const rarezaMin = conf.garantizaRareza || (debeGarantizarDestacado(usuario)
        ? ECONOMIA.rarezaPityObjetivo : null);

    const cartas = [];
    const ids = new Set();
    for (let i = 0; i < n; i++) {
        cartas.push(llenarCarta(posicion, null, ids, rand, meta));
    }

    // Garantía de arquero.
    if (garantizaArquero && !cartas.some(c => c.position === "POR")) {
        reemplazarUnaCarta(cartas, ids, "POR", null, rand, meta, null);
        meta.garantiaArquero = true;
    }

    // Garantía de rareza (no pisar el arquero recién garantizado).
    if (rarezaMin && !cartas.some(c => rarezaGte(c.rarity, rarezaMin))) {
        const excluir = meta.garantiaArquero ? "POR" : null;
        reemplazarUnaCarta(cartas, ids, posicion, rarezaMin, rand, meta, excluir);
        meta.garantiaRareza = true;
    }

    return cartas;
}


// ==========================================
// ABRIR PAQUETE (punto de entrada)
// ==========================================
//
// Genera las 6 cartas, actualiza los contadores de pity y el estado de
// bienvenida en `usuario`, y suma las cartas a `coleccion`. Devuelve
// { cartas, meta }. Muta `usuario` y `coleccion` (el llamador persiste después).
//
// opciones:
//   - posicion:   requerida para paquetes POSICIONAL.
//   - silencioso: no loguea las bajadas de rareza (para los tests en volumen).

export function abrirPaquete(usuario, coleccion, tipo, opciones = {}, rand = Math.random) {
    const conf = ECONOMIA.tiposPaquete[tipo];
    if (!conf) throw new Error(`Tipo de paquete desconocido: ${tipo}`);

    const meta = {
        tipo,
        bajadasDeRareza: 0,
        silencioso: !!opciones.silencioso,
        garantiaArquero: false,
        garantiaRareza: false,
        especialBienvenida: false
    };

    // El primer paquete de un usuario nuevo es el de bienvenida garantizado
    // (§13.1). Solo aplica si el paquete es BASICO (un usuario nuevo únicamente
    // tiene BASICO de bienvenida; nunca abre un PREMIUM/POSICIONAL como primero).
    const esBienvenida = usuario.primerPaqueteEspecialPendiente === true && tipo === "BASICO";

    let cartas;
    if (esBienvenida) {
        cartas = generarBienvenida(rand, meta);
        meta.especialBienvenida = true;
    } else {
        let posicion = null;
        if (conf.posicionElegible) {
            posicion = opciones.posicion;
            if (!POSICIONES.includes(posicion)) {
                throw new Error(`Un paquete POSICIONAL requiere una posición válida (recibí: ${posicion}).`);
            }
        }
        cartas = generarEstandar(posicion, conf, usuario, coleccion, rand, meta);
    }

    actualizarPity(usuario, cartas);
    if (esBienvenida) usuario.primerPaqueteEspecialPendiente = false;

    agregarCartas(coleccion, cartas);

    return { cartas, meta };
}


// ==========================================
// COLECCIÓN
// ==========================================

// Suma cartas a la colección (una entrada por jugador con `quantity`).
export function agregarCartas(coleccion, cartas) {
    for (const player of cartas) {
        const existente = coleccion.find(item => item.player.id === player.id);
        if (existente) existente.quantity++;
        else coleccion.push({ player, quantity: 1 });
    }
    return coleccion;
}


// ==========================================
// RESULTADO DE PARTIDO: FICHAS Y PUNTOS
// ==========================================
//
// 🔴 LA REGLA QUE SOSTIENE LA ECONOMÍA (§15.0, §15.3):
//   - Los partidos vs IA otorgan FICHAS pero NUNCA puntos.
//   - El sobre pre-partido es exclusivo de torneos (Etapa 10), acá no se dispara.

const NOMBRE_RESULTADO = { V: "victoria", E: "empate", D: "derrota" };

// Fecha local en formato "YYYY-MM-DD" (para el "primer partido del día" y el
// tope diario de amistosos).
export function fechaHoy(d = new Date()) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
}

// Puntos del partido (§15.3, §15.3.2). Muta el contador diario de amistosos.
export function puntosDelPartido(usuario, tipo, resultado, hoy = fechaHoy()) {
    if (tipo === "IA") return 0;                       // la IA nunca suma (§15.3)

    const tabla = tipo === "TORNEO" ? ECONOMIA.puntos.torneo : ECONOMIA.puntos.amistoso;
    const pts = tabla[NOMBRE_RESULTADO[resultado]];

    if (tipo === "TORNEO") return pts;                 // sin tope: el fixture ya lo limita

    // AMISTOSO: solo los primeros N del día suman puntos (§15.3.2).
    if (usuario.fechaContadorAmistosos !== hoy) {
        usuario.fechaContadorAmistosos = hoy;
        usuario.amistososConPuntosHoy = 0;
    }
    if (usuario.amistososConPuntosHoy >= ECONOMIA.topeAmistososConPuntosPorDia) {
        return 0;
    }
    usuario.amistososConPuntosHoy++;
    return pts;
}

// Aplica el resultado de un partido a la economía del usuario: Fichas (§15.4),
// puntos (§15.3) y el Pack PREMIUM al llegar a 50 (§15.3). Devuelve un resumen
// para la UI. `packsPremiumOtorgados` es la cantidad de paquetes PREMIUM que el
// llamador debe sumar al inventario.
export function registrarResultadoEconomia(usuario, tipo, resultado, hoy = fechaHoy()) {
    // Fichas (§15.4) — se otorgan SIEMPRE, incluso vs IA.
    let fichas = ECONOMIA.fichas.porPartido;
    if (resultado === "V") fichas += ECONOMIA.fichas.porVictoria;
    else if (resultado === "E") fichas += ECONOMIA.fichas.porEmpate;

    const primeroDelDia = usuario.ultimoPartidoDelDia !== hoy;
    if (primeroDelDia) fichas += ECONOMIA.fichas.primeroDelDia;

    usuario.monedas.fichas += fichas;
    usuario.ultimoPartidoDelDia = hoy;

    // Puntos (§15.3). Vs IA siempre 0.
    const puntos = puntosDelPartido(usuario, tipo, resultado, hoy);
    usuario.puntosAcumulados += puntos;

    // Pack PREMIUM al llegar a 50 (§15.3). Un while por si un golpe grande de
    // puntos cruzara dos umbrales (imposible hoy con 3 pts máx, pero robusto).
    let packsPremiumOtorgados = 0;
    while (usuario.puntosAcumulados >= ECONOMIA.puntosParaPack) {
        usuario.puntosAcumulados -= ECONOMIA.puntosParaPack;
        usuario.packsPremiumGanados++;
        packsPremiumOtorgados += ECONOMIA.packRecompensa.cantidad;
    }

    return {
        fichas,
        puntos,
        primeroDelDia,
        packsPremiumOtorgados,
        tipoPackRecompensa: ECONOMIA.packRecompensa.tipo
    };
}


// ==========================================
// TIENDA (§15.5)
// ==========================================
//
// Descuenta Fichas. El llamador suma el paquete al inventario. No abre el
// paquete: comprar y abrir son pasos separados (el POSICIONAL elige posición al
// abrirse, no al comprarse).
export function comprarPaquete(usuario, tipo) {
    const precio = ECONOMIA.precios[tipo];
    if (precio === undefined) return { ok: false, error: `Tipo de paquete inválido: ${tipo}` };
    if (usuario.monedas.fichas < precio) {
        return { ok: false, error: "No te alcanzan las Fichas." };
    }
    usuario.monedas.fichas -= precio;
    return { ok: true, tipo, precio };
}


// ==========================================
// VENTA DE REPETIDOS (§15.4)
// ==========================================
//
// Solo se puede vender un jugador con quantity ≥ 2: nunca la última copia.
export function venderRepetido(usuario, coleccion, playerId) {
    const item = coleccion.find(i => i.player.id === playerId);
    if (!item) return { ok: false, error: "No tenés ese jugador." };
    if (item.quantity < 2) return { ok: false, error: "No podés vender tu última copia." };

    const rareza = item.player.rarity;
    const valor = ECONOMIA.venderRepetido[rareza];
    if (valor === undefined) return { ok: false, error: `Rareza sin precio de venta: ${rareza}` };

    item.quantity--;
    usuario.monedas.fichas += valor;
    return { ok: true, valor, rareza, quantity: item.quantity };
}


// ==========================================
// MODELOS POR DEFECTO (§44)
// ==========================================

// Modelo de usuario de un jugador nuevo (§44).
export function usuarioNuevo() {
    return {
        schemaVersion: SCHEMA_USUARIO,

        // Monedas como objeto (§48.3). `premium` sin uso en V1 pero existe.
        monedas: { fichas: 0, premium: 0 },

        // Contador de puntos para el Pack PREMIUM (§15.3).
        puntosAcumulados: 0,
        packsPremiumGanados: 0,
        amistososConPuntosHoy: 0,
        fechaContadorAmistosos: null,

        // Contadores de pity (§13.2, §13.3).
        paquetesDesdeUltimoArquero: 0,
        paquetesDesdeUltimoDestacado: 0,

        // Estado de bienvenida.
        paquetesBienvenidaReclamados: false,   // ¿ya se acreditaron los 5 BASICO?
        primerPaqueteEspecialPendiente: true,  // ¿el próximo abre la composición garantizada?

        ultimoPartidoDelDia: null
    };
}

// Inventario de paquetes por tipo. Los de bienvenida y las recompensas son
// BASICO/PREMIUM; el POSICIONAL solo entra por compra en la tienda.
export function inventarioNuevo() {
    return { BASICO: 0, PREMIUM: 0, POSICIONAL: 0 };
}

// Acredita los 5 paquetes de bienvenida (§13.1, §15.1) una sola vez. Muta
// `usuario` e `inventario`. Idempotente: si ya se reclamaron, no hace nada.
export function reclamarBienvenidaSiCorresponde(usuario, inventario) {
    if (!usuario.paquetesBienvenidaReclamados) {
        inventario.BASICO += ECONOMIA.paquetesBienvenida;
        usuario.paquetesBienvenidaReclamados = true;
    }
    return { usuario, inventario };
}

// Total de paquetes en el inventario (para el header).
export function totalPaquetes(inventario) {
    return (inventario.BASICO || 0) + (inventario.PREMIUM || 0) + (inventario.POSICIONAL || 0);
}
