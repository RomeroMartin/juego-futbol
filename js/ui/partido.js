// ==========================================
// UI DEL PARTIDO vs IA (§29, §30, §31)
// ==========================================

import { estado } from "../core/estado.js";
import { agregarAlHistorial, cargarHistorial } from "../core/storage.js";
import { calcularValoracion } from "../core/formulas.js";
import { OFFSET_DIFICULTAD } from "../core/rivalIA.js";
import { prepararPartido, resolverPartido } from "../core/partido.js";
import { generarRelato } from "../core/relato.js";
import { slotsDeFormacion } from "../config/formaciones.js";
import { MENTALIDADES_OF, MENTALIDADES_DEF, MATRIZ_CONTRAS } from "../config/mentalidades.js";
import { showScreen } from "./navegacion.js";


// Estado del flujo de partido.
let partidoPreparado = null;
let ultimaDificultad = null;
let ultimoRegistro = null;
let relatoTimer = null;


// Info de presentación de cada dificultad.
const DIF_INFO = {
    FACIL:   { etiqueta: "FÁCIL",   desc: "Rival más flojo. Buen lugar para probar el equipo." },
    NORMAL:  { etiqueta: "NORMAL",  desc: "Rival a tu mismo nivel." },
    DIFICIL: { etiqueta: "DIFÍCIL", desc: "Rival superior. Vas a sufrir." },
    ELITE:   { etiqueta: "ÉLITE",   desc: "Rival al máximo que permita el plantel." }
};
const ORDEN_DIF = ["FACIL", "NORMAL", "DIFICIL", "ELITE"];

const f1 = (x) => (x === null || x === undefined ? "—" : x.toFixed(1));
const signo = (x) => (x >= 0 ? "+" : "");


// ==========================================
// ARMAR EL EQUIPO DEL USUARIO DESDE EL ESTADO
// ==========================================

export function construirEquipoUsuario() {
    const jugadorDe = (slot) => {
        const playerId = estado.team[slot];
        if (playerId === null || playerId === undefined) return null;
        const item = estado.collection.find(e => e.player.id === playerId);
        return item ? item.player : null;
    };

    // Los slots salen de la formación activa (§17.1), no de un 4-3-3 fijo.
    const equipo = {
        id: "USUARIO",
        arquero: null,
        defensores: [],
        medios: [],
        delanteros: [],
        formacion: estado.formacion,
        mentalidadOfensiva: estado.mentalidadOfensiva,
        mentalidadDefensiva: estado.mentalidadDefensiva
    };

    const destino = { POR: null, DEF: "defensores", MED: "medios", DEL: "delanteros" };

    for (const { slot, position } of slotsDeFormacion(estado.formacion)) {
        const jugador = jugadorDe(slot);
        if (!jugador) return null;   // XI incompleto: no se puede competir (§17.2).
        if (position === "POR") equipo.arquero = jugador;
        else equipo[destino[position]].push(jugador);
    }

    if (!equipo.arquero) return null;

    return equipo;
}


// ==========================================
// PANTALLA: ELEGIR DIFICULTAD
// ==========================================

export function renderCompetir() {
    const equipo = construirEquipoUsuario();
    const invalido = document.getElementById("competeInvalido");
    const grid = document.getElementById("dificultadContenido");

    invalido.hidden = equipo !== null;

    grid.innerHTML = ORDEN_DIF.map(dif => {
        const info = DIF_INFO[dif];
        const off = OFFSET_DIFICULTAD[dif];
        return `
            <button
                class="dificultad-card ${equipo ? "" : "disabled"}"
                data-dificultad="${dif}"
                ${equipo ? "" : "disabled"}
            >
                <span class="dificultad-nombre">${info.etiqueta}</span>
                <span class="dificultad-offset">${signo(off)}${off} Fuerza Efectiva</span>
                <span class="dificultad-desc">${info.desc}</span>
            </button>
        `;
    }).join("");

    grid.querySelectorAll(".dificultad-card:not(.disabled)").forEach(card => {
        card.addEventListener("click", () => elegirDificultad(card.dataset.dificultad));
    });
}


function elegirDificultad(dificultad) {
    const equipo = construirEquipoUsuario();
    if (!equipo) return;

    partidoPreparado = prepararPartido(equipo, dificultad);
    ultimaDificultad = dificultad;
    renderComparacion(partidoPreparado);
    showScreen("comparacionScreen");
}


// ==========================================
// PANTALLA: COMPARACIÓN PREVIA
// ==========================================
//
// Muestra las 3 áreas + Valoración de ambos. NO muestra el XI del rival.

function columnaEquipo(titulo, subtitulo, areas) {
    const val = calcularValoracion(areas.ataque, areas.medio, areas.defensa);
    return `
        <div class="comparacion-col">
            <span class="comparacion-titulo">${titulo}</span>
            <span class="comparacion-subtitulo">${subtitulo}</span>
            <div class="comparacion-fila"><span>Ataque</span><strong>${f1(areas.ataque)}</strong></div>
            <div class="comparacion-fila"><span>Mediocampo</span><strong>${f1(areas.medio)}</strong></div>
            <div class="comparacion-fila"><span>Defensa</span><strong>${f1(areas.defensa)}</strong></div>
            <div class="comparacion-fila comparacion-valoracion"><span>Valoración</span><strong>${f1(val)}</strong></div>
        </div>
    `;
}

export function renderComparacion(prep) {
    const cont = document.getElementById("comparacionContenido");
    const info = DIF_INFO[prep.dificultad];

    // §19.5: del rival se ve su formación y sus stats, NUNCA su mentalidad.
    cont.innerHTML = `
        <p class="comparacion-dificultad">Dificultad: <strong>${info.etiqueta}</strong></p>
        <div class="comparacion-grid">
            ${columnaEquipo("MI EQUIPO", "Formación " + estado.formacion, prep.areasUsuario)}
            <div class="comparacion-vs">VS</div>
            ${columnaEquipo(prep.rival.equipo.nombre, "Formación " + prep.rival.formacion, prep.rival.areas)}
        </div>
    `;

    // Aviso de capado (§ regla: comunicar cuando no se alcanza el offset pedido).
    const capAviso = document.getElementById("capAviso");
    const off = prep.rival.offsetReal;
    if (prep.rival.capado) {
        capAviso.hidden = false;
        capAviso.innerHTML = `
            ⚠️ <strong>${info.etiqueta}</strong> apuntaba a ${signo(prep.rival.offsetSolicitado)}${prep.rival.offsetSolicitado},
            pero el plantel argentino no da para tanto. El rival quedó
            <strong>${signo(off)}${Math.round(off)}</strong> sobre tu Fuerza Efectiva —
            estás jugando contra el techo del pool, no contra una dificultad más baja.
        `;
    } else {
        capAviso.hidden = true;
        capAviso.innerHTML = "";
    }
}


// ==========================================
// COMENZAR PARTIDO
// ==========================================

function comenzarPartido() {
    if (!partidoPreparado) return;

    const registro = resolverPartido(partidoPreparado);
    agregarAlHistorial(registro);
    ultimaDificultad = registro.dificultad;
    ultimoRegistro = registro;

    // Relato progresivo antes del resultado.
    reproducirRelato(generarRelato(registro));
    showScreen("relatoScreen");
}


// ==========================================
// PANTALLA: RELATO PROGRESIVO
// ==========================================

const RETARDO_LINEA = 900;   // ms entre líneas
const RETARDO_GOL = 1500;    // los goles respiran un poco más

function reproducirRelato(lineas) {
    detenerRelato();

    const cont = document.getElementById("relatoLineas");
    const boton = document.getElementById("relatoAvanzar");
    cont.innerHTML = "";
    boton.textContent = "SALTEAR ▶";

    let i = 0;
    const paso = () => {
        if (i >= lineas.length) {
            boton.textContent = "VER RESULTADO ▶";
            relatoTimer = null;
            return;
        }
        const l = lineas[i++];
        const clase = l.esGol ? "relato-linea relato-gol"
            : (l.tipo === "INICIO" || l.tipo === "FINAL") ? "relato-linea relato-marco"
            : "relato-linea";
        const minuto = (l.tipo === "INICIO") ? "" : `${l.minuto}'`;
        cont.insertAdjacentHTML("beforeend",
            `<div class="${clase}"><span class="relato-min">${minuto}</span><span class="relato-texto">${l.texto}</span></div>`);
        cont.scrollTop = cont.scrollHeight;
        relatoTimer = setTimeout(paso, l.esGol ? RETARDO_GOL : RETARDO_LINEA);
    };
    paso();
}

function detenerRelato() {
    if (relatoTimer) {
        clearTimeout(relatoTimer);
        relatoTimer = null;
    }
}

// El botón saltea (durante el relato) o va al resultado (al terminar).
function terminarRelato() {
    detenerRelato();
    if (ultimoRegistro) {
        renderResultado(ultimoRegistro);
        showScreen("resultadoScreen");
    }
}


// ==========================================
// PANTALLA: RESULTADO
// ==========================================

const ETIQUETA_RESULTADO = {
    V: { texto: "GANASTE", clase: "res-victoria" },
    E: { texto: "EMPATE", clase: "res-empate" },
    D: { texto: "PERDISTE", clase: "res-derrota" }
};

// ==========================================
// ANÁLISIS TÁCTICO POST-PARTIDO (§19.5)
// ==========================================
//
// Recién ACÁ se revela la mentalidad del rival. Cada línea explica qué pasó con
// el enfrentamiento de mentalidades, usando el porcentaje REAL aplicado por la
// matriz de contras (ya escalado, no el nominal de §19.3). Enseña el sistema sin
// tutorial: se aprende viendo por qué el partido salió como salió.

function pct(mult) {
    return Math.round((mult - 1) * 100);
}

function fraseAtaque(miOf, suDef, mult) {
    const p = pct(mult);
    if (p >= 2)  return `Tu <strong>${miOf}</strong> encontró espacios contra su ${suDef}. <span class="tact-plus">(+${p}% ataque)</span>`;
    if (p <= -2) return `Tu <strong>${miOf}</strong> se estrelló contra su ${suDef}. <span class="tact-minus">(${p}% ataque)</span>`;
    return `Tu <strong>${miOf}</strong> no sacó ventaja táctica contra su ${suDef}. <span class="tact-neutro">(neutro)</span>`;
}

function fraseDefensa(suOf, miDef, mult) {
    const p = pct(mult);
    if (p >= 2)  return `Su <strong>${suOf}</strong> encontró espacios contra tu ${miDef}. <span class="tact-minus">(+${p}% ataque rival)</span>`;
    if (p <= -2) return `Su <strong>${suOf}</strong> se estrelló contra tu ${miDef}. <span class="tact-plus">(${p}% ataque rival)</span>`;
    return `Su <strong>${suOf}</strong> no sacó ventaja táctica contra tu ${miDef}. <span class="tact-neutro">(neutro)</span>`;
}

function bloqueTactico(reg) {
    if (!reg.tactica) return "";   // partidos viejos del historial (pre-Etapa 5).

    const t = reg.tactica;
    const uOf  = MENTALIDADES_OF[t.usuario.mentalidadOfensiva].etiqueta;
    const uDef = MENTALIDADES_DEF[t.usuario.mentalidadDefensiva].etiqueta;
    const rOf  = MENTALIDADES_OF[t.rival.mentalidadOfensiva].etiqueta;
    const rDef = MENTALIDADES_DEF[t.rival.mentalidadDefensiva].etiqueta;

    // Ataque: mi ofensiva vs su defensiva. Defensa: su ofensiva vs mi defensiva.
    const multAtk = MATRIZ_CONTRAS[t.usuario.mentalidadOfensiva][t.rival.mentalidadDefensiva];
    const multDef = MATRIZ_CONTRAS[t.rival.mentalidadOfensiva][t.usuario.mentalidadDefensiva];

    return `
        <div class="resultado-tactica">
            <h3>ANÁLISIS TÁCTICO</h3>
            <p class="tact-revelacion">
                El rival jugó <strong>${t.rival.formacion}</strong> con
                <strong>${rOf}</strong> / <strong>${rDef}</strong>.
                <br>Vos jugaste <strong>${t.usuario.formacion}</strong> con
                <strong>${uOf}</strong> / <strong>${uDef}</strong>.
            </p>
            <ul class="tact-lineas">
                <li>${fraseAtaque(uOf, rDef, multAtk)}</li>
                <li>${fraseDefensa(rOf, uDef, multDef)}</li>
            </ul>
        </div>
    `;
}


export function renderResultado(reg) {
    const cont = document.getElementById("resultadoContenido");
    const r = ETIQUETA_RESULTADO[reg.resultado];
    const est = reg.estadisticas;

    cont.innerHTML = `
        <div class="resultado-marcador ${r.clase}">
            <div class="marcador-linea">
                <span class="marcador-equipo">Tu equipo</span>
                <span class="marcador-goles">${reg.golesUsuario} - ${reg.golesRival}</span>
                <span class="marcador-equipo">${reg.rivalNombre}</span>
            </div>
            <div class="marcador-resultado">${r.texto}</div>
        </div>

        <div class="resultado-mvp">
            🏅 <strong>MVP:</strong> ${reg.mvp.nombre}
            <span class="mvp-equipo">(${reg.mvp.equipoId === "USUARIO" ? "tu equipo" : reg.rivalNombre})</span>
            <span class="mvp-detalle">${reg.mvp.goles} gol(es) · ${reg.mvp.atajadas} atajada(s)</span>
        </div>

        <div class="resultado-stats">
            <div class="stat-fila stat-cabecera"><span>Tu equipo</span><span>Estadística</span><span>${reg.rivalNombre}</span></div>
            <div class="stat-fila"><span>${est.posesionUsuario}%</span><span>Posesión</span><span>${est.posesionRival}%</span></div>
            <div class="stat-fila"><span>${est.llegadasUsuario}</span><span>Llegadas al arco</span><span>${est.llegadasRival}</span></div>
            <div class="stat-fila"><span>${reg.golesUsuario}</span><span>Goles</span><span>${reg.golesRival}</span></div>
        </div>

        ${bloqueTactico(reg)}

        <p class="resultado-nota">
            Dificultad ${DIF_INFO[reg.dificultad].etiqueta} · offset real ${signo(reg.offsetReal)}${reg.offsetReal}
            ${reg.capado ? " (capado por el plantel)" : ""} · semilla ${reg.semilla}
        </p>
    `;
}


// ==========================================
// PANTALLA: HISTORIAL
// ==========================================

export function renderHistorial() {
    const cont = document.getElementById("historialContenido");
    const historial = cargarHistorial();

    if (historial.length === 0) {
        cont.innerHTML = `<p class="historial-vacio">Todavía no jugaste ningún partido.</p>`;
        return;
    }

    cont.innerHTML = historial.map(reg => {
        const r = ETIQUETA_RESULTADO[reg.resultado];
        const fecha = new Date(reg.fecha).toLocaleString("es-AR", {
            day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit"
        });
        return `
            <div class="historial-item">
                <span class="historial-chip ${r.clase}">${reg.resultado}</span>
                <div class="historial-datos">
                    <div class="historial-marcador">
                        Tu equipo <strong>${reg.golesUsuario} - ${reg.golesRival}</strong> ${reg.rivalNombre}
                    </div>
                    <div class="historial-meta">
                        ${DIF_INFO[reg.dificultad].etiqueta} · ${fecha}${reg.capado ? " · capado" : ""}
                    </div>
                </div>
            </div>
        `;
    }).join("");
}


// ==========================================
// ENGANCHE DE EVENTOS
// ==========================================

export function initPartido() {
    document.getElementById("competeButton")
        .addEventListener("click", () => showScreen("competirScreen"));

    document.getElementById("startMatchButton")
        .addEventListener("click", comenzarPartido);

    document.getElementById("relatoAvanzar")
        .addEventListener("click", terminarRelato);

    document.getElementById("revanchaButton")
        .addEventListener("click", () => {
            if (ultimaDificultad) elegirDificultad(ultimaDificultad);
        });

    document.getElementById("verHistorialButton")
        .addEventListener("click", () => showScreen("historialScreen"));

    document.getElementById("resultadoHistorialButton")
        .addEventListener("click", () => showScreen("historialScreen"));

    // Botones "volver".
    document.getElementById("backFromCompetir")
        .addEventListener("click", () => showScreen("homeScreen"));
    document.getElementById("backFromComparacion")
        .addEventListener("click", () => showScreen("competirScreen"));
    document.getElementById("backFromRelato")
        .addEventListener("click", () => { detenerRelato(); showScreen("competirScreen"); });
    document.getElementById("backFromResultado")
        .addEventListener("click", () => showScreen("competirScreen"));
    document.getElementById("backFromHistorial")
        .addEventListener("click", () => showScreen("competirScreen"));
}
