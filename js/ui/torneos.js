// ==========================================
// TORNEOS — sala (Etapa 9A) + armado del equipo (Etapa 9B, §36.1, §37.1, §38)
// ==========================================
//
// Toda la escritura pasa por Cloud Functions; acá solo se pide y se muestra el
// torneo EN VIVO (Firestore en tiempo real). Etapa 9A: crear, unirse, abrir el
// armado. Etapa 9B: durante la ventana de 24hs cada uno arma SU equipo del
// torneo reclamando jugadores con exclusividad. Jugar las fechas es la Etapa 10.

import { usuarioActual } from "../core/auth.js";
import { estado } from "../core/estado.js";
import { JUGADORES } from "../data/jugadores.js";
import {
    CLAVES_FORMACION,
    slotsDeFormacion
} from "../config/formaciones.js";
import {
    MENTALIDADES_OF,
    MENTALIDADES_DEF,
    CLAVES_OFENSIVA,
    CLAVES_DEFENSIVA,
    MENTALIDAD_OF_DEFAULT,
    MENTALIDAD_DEF_DEFAULT
} from "../config/mentalidades.js";
import { ECONOMIA } from "../config/economia.js";
import { simularPartido } from "../core/motor.js";
import { reproducirRelatoExterno } from "./partido.js";
import { showScreen } from "./navegacion.js";
import {
    escucharMisTorneos,
    escucharEquipoTorneo,
    obtenerEquipoTorneo,
    crearTorneoNube,
    unirseTorneoNube,
    abrirArmadoNube,
    elegirFormacionTorneoNube,
    reclamarJugadorNube,
    liberarJugadorNube,
    listarPoolReservaNube,
    iniciarTorneoNube,
    avanzarFechaNube,
    guardarMentalidadTorneoNube,
    reiniciarTorneoNube,
    borrarTorneoNube
} from "../core/nube.js";


const cont = () => document.getElementById("torneosContenido");

// Catálogo por id: para mostrar el nombre de un jugador de reserva, que no está
// en la colección propia.
const CATALOGO = new Map(JUGADORES.map(j => [j.id, j]));

let unsubLista = null;      // suscripción en vivo a "mis torneos"
let torneos = [];           // último estado recibido
let detalleId = null;       // torneo abierto en la vista de detalle (o null = lista)
let ocupado = false;        // evita doble submit mientras responde el servidor
let avisoValidacion = "";   // mensaje de pool insuficiente (§37), si lo hubo

// Armado (9B): suscripción a MI equipo del torneo + estado del selector de jugador.
let unsubEquipo = null;
let equipoSubId = null;      // torneoId al que está suscripto el listener del equipo
let equipoTorneo = null;     // mi equipo del torneo en vivo (o null)
let slotAbierto = null;      // slot cuyo selector de jugador está abierto (o null)
let reservaCandidatos = null; // candidatos del Pool de Reserva ya pedidos (o null)
let cargandoReserva = false;
let mensajeArmado = null;    // aviso visible en pantalla { tipo:'ok'|'error'|'info', texto } (mejor que alert en mobile)

// Pantalla "fecha jugada" (post-Etapa 10): tras JUGAR FECHA se muestra la
// lista de partidos de esa fecha para ver el relato de a uno, antes de pasar
// a la tabla. { torneoId, fecha, vistos: Set<partidoId> } o null.
let fechaRecienJugada = null;

const POS_NOMBRE = { POR: "arqueros", DEF: "defensores", MED: "mediocampistas", DEL: "delanteros" };
const POS_SINGULAR = { POR: "arquero", DEF: "defensor", MED: "mediocampista", DEL: "delantero" };
const ORDEN_LINEAS = ["DEL", "MED", "DEF", "POR"];
const ESTADO_ETIQUETA = {
    BORRADOR: "Inscripción abierta",
    ARMADO: "Armando equipos",
    EN_CURSO: "En curso",
    FINALIZADO: "Finalizado"
};


// ==========================================
// SUSCRIPCIÓN EN VIVO
// ==========================================

export function renderTorneos() {
    const uid = usuarioActual()?.uid;
    if (!uid) return;

    if (!unsubLista) {
        unsubLista = escucharMisTorneos(uid, (lista) => {
            torneos = lista;
            pintar();
        });
    }
    pintar();
}

// Corta las suscripciones (al cerrar sesión).
export function detenerTorneos() {
    if (unsubLista) { unsubLista(); unsubLista = null; }
    detenerSubEquipo();
    torneos = [];
    detalleId = null;
    fechaRecienJugada = null;
    resetPicker();
}

// Asegura que el listener del equipo del torneo esté enganchado al torneo actual.
function asegurarSubEquipo(torneoId, uid) {
    if (equipoSubId === torneoId) return;
    detenerSubEquipo();
    equipoSubId = torneoId;
    unsubEquipo = escucharEquipoTorneo(torneoId, uid, (eq) => { equipoTorneo = eq; pintar(); });
}

function detenerSubEquipo() {
    if (unsubEquipo) { unsubEquipo(); unsubEquipo = null; }
    equipoSubId = null;
    equipoTorneo = null;
}

function resetPicker() {
    slotAbierto = null;
    reservaCandidatos = null;
    cargandoReserva = false;
}


// ==========================================
// PINTAR
// ==========================================

function pintar() {
    const c = cont();
    if (!c) return;
    if (detalleId) pintarDetalle(c);
    else { detenerSubEquipo(); pintarLista(c); }
}


function pintarLista(c) {
    const mios = [...torneos].sort((a, b) => (a.creadoEn < b.creadoEn ? 1 : -1));

    const listaHtml = mios.length === 0
        ? `<p class="torneo-vacio">Todavía no estás en ningún torneo. Creá uno e invitá a tus amigas, o unite con un código.</p>`
        : mios.map(t => `
            <button class="torneo-item" data-abrir-torneo="${t.id}">
                <div class="torneo-item-datos">
                    <strong>${escapar(t.nombre)}</strong>
                    <small>${t.participantes.length} participante(s) · ${ESTADO_ETIQUETA[t.estado] || t.estado}</small>
                </div>
                <span class="torneo-item-codigo">${t.codigoInvitacion}</span>
            </button>
        `).join("");

    c.innerHTML = `
        <div class="torneo-lista">${listaHtml}</div>

        <div class="torneo-acciones">
            <div class="torneo-card">
                <h3>Crear un torneo</h3>
                <input id="torneoNombre" type="text" maxlength="40" placeholder="Nombre del torneo">
                <button id="torneoCrear" class="main-button">CREAR</button>
            </div>

            <div class="torneo-card">
                <h3>Unirme con un código</h3>
                <input id="torneoCodigo" type="text" maxlength="6" placeholder="Ej. PIBES2" style="text-transform:uppercase">
                <button id="torneoUnirse" class="secondary-button">UNIRME</button>
            </div>
        </div>
    `;

    document.getElementById("torneoCrear").addEventListener("click", onCrear);
    document.getElementById("torneoUnirse").addEventListener("click", onUnirse);
    c.querySelectorAll("[data-abrir-torneo]").forEach(b =>
        b.addEventListener("click", () => {
            detalleId = b.dataset.abrirTorneo;
            avisoValidacion = "";
            resetPicker();
            pintar();
        })
    );
}


function pintarDetalle(c) {
    const t = torneos.find(x => x.id === detalleId);
    if (!t) { detalleId = null; detenerSubEquipo(); pintarLista(c); return; }

    const uid = usuarioActual()?.uid;

    // Etapa 9B: en estado ARMADO se arma el equipo del torneo.
    if (t.estado === "ARMADO") {
        asegurarSubEquipo(t.id, uid);
        pintarArmado(c, t, uid);
        return;
    }

    // Etapa 10A: en curso / finalizado se juega y se ve la liga.
    if (t.estado === "EN_CURSO" || t.estado === "FINALIZADO") {
        asegurarSubEquipo(t.id, uid);
        if (fechaRecienJugada && fechaRecienJugada.torneoId === t.id) {
            pintarFechaJugada(c, t, fechaRecienJugada);
        } else {
            pintarCompeticion(c, t, uid);
        }
        return;
    }

    detenerSubEquipo();
    pintarSala(c, t, uid);
}


// Vista de sala (BORRADOR y estados sin armado): código, participantes y, para el
// creador, el botón de abrir el armado (Etapa 9A).
function pintarSala(c, t, uid) {
    const esCreador = t.creadorId === uid;

    const participantes = t.participantes
        .map(u => `<li>${escapar(t.nombres?.[u] || "Jugador")}${u === t.creadorId ? " 👑" : ""}</li>`)
        .join("");

    let accionCreador = "";
    if (esCreador && t.estado === "BORRADOR") {
        const faltan = t.minParticipantes - t.participantes.length;
        accionCreador = faltan > 0
            ? `<p class="torneo-nota">Faltan ${faltan} participante(s) para poder empezar (mínimo ${t.minParticipantes}).</p>`
            : `<button id="torneoAbrir" class="main-button">ABRIR ARMADO (ventana de 24 hs)</button>`;
    }

    const aviso = avisoValidacion ? `<div class="torneo-aviso">${avisoValidacion}</div>` : "";

    c.innerHTML = `
        <button class="back-button" id="torneoVolverLista">← Mis torneos</button>

        <div class="torneo-detalle">
            <span class="eyebrow">${ESTADO_ETIQUETA[t.estado] || t.estado}</span>
            <h2>${escapar(t.nombre)}</h2>

            <div class="torneo-codigo-box">
                <span>Código para invitar</span>
                <strong>${t.codigoInvitacion}</strong>
            </div>

            <h3>Participantes (${t.participantes.length}/${t.maxParticipantes})</h3>
            <ul class="torneo-participantes">${participantes}</ul>

            ${aviso}
            ${accionCreador}
        </div>
    `;

    document.getElementById("torneoVolverLista")
        .addEventListener("click", volverALista);

    const btnAbrir = document.getElementById("torneoAbrir");
    if (btnAbrir) btnAbrir.addEventListener("click", () => onAbrirArmado(t.id));
}


// ==========================================
// ARMADO DEL EQUIPO (Etapa 9B)
// ==========================================

function pintarArmado(c, t, uid) {
    const abierta = edicionAbiertaCliente(t);

    // Todavía no eligió formación: pedirla primero (crea el equipo del torneo).
    if (!equipoTorneo) {
        pintarElegirFormacion(c, t, abierta);
        return;
    }

    // Barra de estado de la ventana.
    const barra = abierta
        ? `<div class="torneo-aviso torneo-aviso-ok">
               🟢 <strong>Ventana de armado abierta.</strong> Cierra en ${textoTiempoRestante(t.ventanaArmadoCierra)}.
               Cambiar de formación o sacar un jugador lo libera para el resto.
           </div>`
        : `<div class="torneo-aviso">
               🔒 <strong>Equipo congelado.</strong> La ventana de armado cerró: ya no se puede
               modificar el equipo. Esperá a que el creador inicie el torneo.
           </div>`;

    // Botón de iniciar el torneo (solo el creador). Al iniciar se cierra el
    // armado, se genera el fixture y se juega la primera fecha (§40, §41).
    const esCreador = t.creadorId === uid;
    const iniciar = esCreador
        ? `<button id="torneoIniciar" class="main-button">INICIAR TORNEO (jugar la liga)</button>
           <p class="torneo-nota">Al iniciar se cierra el armado y se genera el fixture. Todos los
           participantes tienen que tener su equipo completo.</p>`
        : "";

    c.innerHTML = `
        <button class="back-button" id="torneoVolverLista">← Mis torneos</button>

        <div class="torneo-detalle torneo-armado">
            <span class="eyebrow">${ESTADO_ETIQUETA[t.estado]}</span>
            <h2>${escapar(t.nombre)}</h2>

            ${barra}
            ${bannerMensaje()}
            ${pintarEdicionEquipo(t, uid, abierta)}
            ${iniciar}
        </div>
    `;

    document.getElementById("torneoVolverLista").addEventListener("click", volverALista);
    enganchesArmado(t, uid, abierta);

    const btnIniciar = document.getElementById("torneoIniciar");
    if (btnIniciar) btnIniciar.addEventListener("click", () => onIniciarTorneo(t, abierta));

    const btnCopiar = document.getElementById("torneoCopiarIA");
    if (btnCopiar) btnCopiar.addEventListener("click", () => onCopiarEquipoIA(t));

    const btnMent = document.getElementById("torneoGuardarMent");
    if (btnMent) btnMent.addEventListener("click", () => onGuardarMentalidad(t.id));
}


// Bloque reutilizable de edición del equipo del torneo: selector de formación,
// atajo de copiar del modo normal, cancha, picker y mentalidad. Se usa tanto en
// el armado inicial (ARMADO) como en la ventana entre fechas (EN_CURSO): en
// ambos casos requiere que ya exista `equipoTorneo` (formación elegida).
function pintarEdicionEquipo(t, uid, abierta) {
    const formacion = equipoTorneo.formacion;
    const posDeSlot = mapaSlotPosicion(formacion);
    const cancha = pintarCancha(t, uid, formacion);

    const selector = abierta ? pintarSelectorFormacion(formacion) : "";
    const copiar = abierta
        ? `<button id="torneoCopiarIA" class="secondary-button torneo-copiar">📋 Copiar mi equipo del modo normal</button>`
        : "";
    const picker = (abierta && slotAbierto) ? pintarPicker(t, uid, posDeSlot[slotAbierto]) : "";
    const mentalidad = pintarSelectorMentalidad();

    return `
        ${selector}
        ${copiar}
        <h3>Tu equipo del torneo (${formacion})</h3>
        ${cancha}
        ${picker}
        ${mentalidad}
    `;
}


// Pantalla inicial del armado: elegir formación (aún no hay equipo del torneo).
function pintarElegirFormacion(c, t, abierta) {
    if (!abierta) {
        // Ventana cerrada sin haber armado: nada que hacer.
        c.innerHTML = `
            <button class="back-button" id="torneoVolverLista">← Mis torneos</button>
            <div class="torneo-detalle">
                <span class="eyebrow">${ESTADO_ETIQUETA[t.estado]}</span>
                <h2>${escapar(t.nombre)}</h2>
                <div class="torneo-aviso">🔒 La ventana de armado cerró y no armaste tu equipo.</div>
            </div>`;
        document.getElementById("torneoVolverLista").addEventListener("click", volverALista);
        return;
    }

    c.innerHTML = `
        <button class="back-button" id="torneoVolverLista">← Mis torneos</button>
        <div class="torneo-detalle torneo-armado">
            <span class="eyebrow">${ESTADO_ETIQUETA[t.estado]}</span>
            <h2>${escapar(t.nombre)}</h2>
            <div class="torneo-aviso torneo-aviso-ok">
                🟢 <strong>Ventana de armado abierta.</strong> Cierra en ${textoTiempoRestante(t.ventanaArmadoCierra)}.
            </div>
            ${bannerMensaje()}
            <h3>Elegí tu formación para el torneo</h3>
            <p class="torneo-nota">La formación queda fija una vez que cierra la ventana (§17.3).
            O copiá directamente tu equipo del modo normal:</p>
            <button id="torneoCopiarIA" class="secondary-button torneo-copiar">📋 Copiar mi equipo del modo normal</button>
            ${pintarSelectorFormacion(null)}
        </div>`;

    document.getElementById("torneoVolverLista").addEventListener("click", volverALista);
    engancharSelectorFormacion(t);

    const btnCopiar = document.getElementById("torneoCopiarIA");
    if (btnCopiar) btnCopiar.addEventListener("click", () => onCopiarEquipoIA(t));
}


// Botonera de las 6 formaciones. `actual` = clave elegida (o null).
function pintarSelectorFormacion(actual) {
    const botones = CLAVES_FORMACION.map(clave => `
        <button class="torneo-form-btn ${clave === actual ? "activa" : ""}"
                data-formacion="${clave}">${clave}</button>
    `).join("");
    return `<div class="torneo-formaciones">${botones}</div>`;
}


// La cancha con los slots de la formación, agrupados por línea (arriba = ataque).
function pintarCancha(t, uid, formacion) {
    const slots = slotsDeFormacion(formacion);
    const xi = equipoTorneo.xi || {};

    const lineas = ORDEN_LINEAS.map(pos => {
        const deLinea = slots.filter(s => s.position === pos);
        if (deLinea.length === 0) return "";

        const celdas = deLinea.map(({ slot, position }) => {
            const pid = xi[slot];
            if (pid) {
                const jugador = CATALOGO.get(pid);
                const esReserva = (equipoTorneo.reservaUsados || []).includes(pid);
                return `
                    <div class="torneo-slot ocupado" data-slot="${slot}">
                        <strong>${escapar(jugador?.name || "Jugador")}</strong>
                        <small>${escapar(jugador?.club || "")}${esReserva ? " · préstamo" : ""}</small>
                        ${edicionAbiertaCliente(t) ? `<button class="torneo-slot-x" data-liberar="${pid}" title="Liberar">✕</button>` : ""}
                    </div>`;
            }
            return `
                <button class="torneo-slot vacio" data-abrir-slot="${slot}" ${edicionAbiertaCliente(t) ? "" : "disabled"}>
                    <span>＋ ${POS_SINGULAR[position]}</span>
                </button>`;
        }).join("");

        return `<div class="torneo-linea">${celdas}</div>`;
    }).join("");

    return `<div class="torneo-cancha">${lineas}</div>`;
}


// Selector de jugador para el slot abierto: tu colección de esa posición +
// el acceso al Pool de Reserva (§37.1).
function pintarPicker(t, uid, posicion) {
    const yaEnMiXI = new Set(Object.values(equipoTorneo.xi || {}).filter(Boolean));
    const reclamados = t.jugadoresReclamados || {};

    // Jugadores propios de esa posición que no estén ya en mi XI.
    const propios = estado.collection
        .filter(e => e.player.position === posicion)
        .map(e => e.player)
        .filter(p => !yaEnMiXI.has(p.id))
        .sort((a, b) => (b.overall || 0) - (a.overall || 0));

    const itemsPropios = propios.length === 0
        ? `<p class="torneo-nota">No tenés ${POS_NOMBRE[posicion]} libres en tu colección. Probá el pool de reserva.</p>`
        : propios.map(p => {
            const dueno = reclamados[p.id];
            const tomadoPorOtro = dueno && dueno !== uid;
            if (tomadoPorOtro) {
                return `<div class="torneo-pick-item tomado">
                            <span>${escapar(p.name)} <small>${escapar(p.club || "")}</small></span>
                            <em>reclamado por ${escapar(t.nombres?.[dueno] || "otro")}</em>
                        </div>`;
            }
            return `<button class="torneo-pick-item" data-reclamar="${p.id}">
                        <span>${escapar(p.name)} <small>${escapar(p.club || "")}</small></span>
                        <strong>${p.overall ?? ""}</strong>
                    </button>`;
        }).join("");

    // Bloque del Pool de Reserva (se pide al servidor bajo demanda).
    let reservaBloque = "";
    if (cargandoReserva) {
        reservaBloque = `<p class="torneo-nota">Buscando jugadores de reserva…</p>`;
    } else if (reservaCandidatos) {
        const usados = (equipoTorneo.reservaUsados || []).length;
        reservaBloque = reservaCandidatos.length === 0
            ? `<p class="torneo-nota">No hay ${POS_NOMBRE[posicion]} de reserva disponibles.</p>`
            : `<p class="torneo-nota">Pool de reserva (${usados}/3 usados) — préstamos, no quedan en tu colección:</p>` +
              reservaCandidatos.map(p => `
                  <button class="torneo-pick-item reserva" data-reclamar="${p.id}">
                      <span>${escapar(p.name)} <small>${escapar(p.club || "")} · préstamo</small></span>
                      <strong>${p.overall ?? ""}</strong>
                  </button>`).join("");
    } else {
        reservaBloque = `<button class="secondary-button" id="torneoVerReserva">Buscar en el pool de reserva</button>`;
    }

    return `
        <div class="torneo-picker">
            <div class="torneo-picker-head">
                <strong>Elegí un ${POS_SINGULAR[posicion]}</strong>
                <button class="torneo-pick-cerrar" id="torneoCerrarPicker">✕</button>
            </div>
            <div class="torneo-pick-lista">${itemsPropios}</div>
            <div class="torneo-pick-reserva">${reservaBloque}</div>
        </div>`;
}


// ==========================================
// COMPETENCIA: jugar la liga (Etapa 10A)
// ==========================================

function pintarCompeticion(c, t, uid) {
    const esCreador = t.creadorId === uid;
    const finalizado = t.estado === "FINALIZADO";
    const soyParticipante = t.participantes.includes(uid);
    const totalFechas = t.totalFechas || (t.fixture?.length || "");
    const abierta = !finalizado && edicionAbiertaCliente(t);

    // Campeón + premio propio, si el torneo terminó (§43).
    let cabecera = "";
    if (finalizado && t.tabla?.length) {
        const miPuesto = t.tabla.findIndex(r => r.uid === uid) + 1;   // 0 si no estoy
        const miPremio = miPuesto ? premioDePuesto(miPuesto, t.participantes.length) : 0;
        const linePremio = miPuesto
            ? `<br>Saliste <strong>${miPuesto}º</strong> y ganaste <strong>${miPremio} 🪙 Fichas</strong>. <em>(recargá para ver tu saldo actualizado)</em>`
            : "";
        cabecera = `<div class="torneo-aviso torneo-aviso-ok">
               🏆 <strong>Campeón: ${escapar(t.tabla[0].nombre)}.</strong> Torneo finalizado.${linePremio}
           </div>`;
    }

    // Editar el equipo (formación/jugadores/mentalidad) para la próxima fecha.
    let bloqueEdicion = "";
    if (!finalizado && soyParticipante && equipoTorneo) {
        const avisoVentana = abierta
            ? `<div class="torneo-aviso torneo-aviso-ok">
                   🟢 <strong>Podés editar tu equipo.</strong> Cierra en ${textoTiempoRestante(t.ventanaEntreFechasCierra)},
                   o antes si el organizador juega la fecha. Cambiar de formación o sacar un jugador lo libera para el resto.
               </div>`
            : `<div class="torneo-aviso">
                   🔒 <strong>Equipo congelado hasta la próxima fecha.</strong> La mentalidad se puede cambiar igual.
               </div>`;
        bloqueEdicion = `
            <h3>Tu equipo para la próxima fecha</h3>
            ${avisoVentana}
            ${pintarEdicionEquipo(t, uid, abierta)}
        `;
    }

    // Botón de jugar la fecha.
    let bloqueAvance = "";
    if (!finalizado) {
        if (esCreador || puedeForzar(t)) {
            bloqueAvance = `<button id="torneoAvanzar" class="main-button">JUGAR FECHA ${t.fechaActual}</button>`;
        } else {
            bloqueAvance = `<p class="torneo-nota">Esperando a que el creador juegue la fecha
                ${t.fechaActual}. Tras 5 días sin avanzar, cualquiera puede forzarla.</p>`;
        }
    }

    // Reiniciar / borrar el torneo (solo el creador, solo terminado).
    const accionesFin = (finalizado && esCreador) ? pintarAccionesCreadorFinalizado() : "";

    c.innerHTML = `
        <button class="back-button" id="torneoVolverLista">← Mis torneos</button>
        <div class="torneo-detalle">
            <span class="eyebrow">${ESTADO_ETIQUETA[t.estado]}${finalizado ? "" : ` · Fecha ${t.fechaActual}/${totalFechas}`}</span>
            <h2>${escapar(t.nombre)}</h2>
            ${cabecera}
            ${bannerMensaje()}

            <h3>Tabla de posiciones</h3>
            ${pintarTabla(t, uid)}

            ${bloqueAvance}
            ${!finalizado ? `<p class="torneo-nota">🎁 Cada fecha que jugás te da 1 sobre gratis (aparece en tus paquetes; recargá para verlo).</p>` : ""}

            ${bloqueEdicion}
            ${accionesFin}

            <h3>Fixture</h3>
            ${pintarFixture(t, uid)}
        </div>`;

    document.getElementById("torneoVolverLista").addEventListener("click", volverALista);
    const btnAv = document.getElementById("torneoAvanzar");
    if (btnAv) btnAv.addEventListener("click", () => onAvanzarFecha(t.id));
    const btnMent = document.getElementById("torneoGuardarMent");
    if (btnMent) btnMent.addEventListener("click", () => onGuardarMentalidad(t.id));
    if (!finalizado) {
        enganchesArmado(t, uid, abierta);
        const btnCopiar = document.getElementById("torneoCopiarIA");
        if (btnCopiar) btnCopiar.addEventListener("click", () => onCopiarEquipoIA(t));
    }
    cont().querySelectorAll("[data-relato]").forEach(b =>
        b.addEventListener("click", () => onVerRelato(t, b.dataset.relato))
    );
    if (finalizado && esCreador) {
        const btnReiniciar = document.getElementById("torneoReiniciar");
        if (btnReiniciar) btnReiniciar.addEventListener("click", () => onReiniciarTorneo(t));
        const btnBorrar = document.getElementById("torneoBorrar");
        if (btnBorrar) btnBorrar.addEventListener("click", () => onBorrarTorneo(t));
    }
}


// Botones del creador sobre un torneo ya FINALIZADO: reiniciarlo para jugar
// otra temporada con el mismo grupo, o borrarlo definitivamente.
function pintarAccionesCreadorFinalizado() {
    return `
        <div class="torneo-acciones-fin">
            <button id="torneoReiniciar" class="secondary-button">🔄 Reiniciar torneo</button>
            <button id="torneoBorrar" class="secondary-button torneo-borrar">🗑 Borrar torneo</button>
        </div>`;
}


function pintarTabla(t, uid) {
    const filas = (t.tabla || []).map((r, i) => `
        <tr class="${r.uid === uid ? "yo" : ""}">
            <td>${i + 1}</td>
            <td class="nom">${escapar(r.nombre)}</td>
            <td>${r.pj}</td><td>${r.g}</td><td>${r.e}</td><td>${r.p}</td>
            <td>${r.gf}</td><td>${r.gc}</td><td>${r.dg > 0 ? "+" : ""}${r.dg}</td>
            <td class="pts">${r.pts}</td>
        </tr>`).join("");
    return `
        <div class="torneo-tabla-wrap">
            <table class="torneo-tabla">
                <thead><tr>
                    <th>#</th><th>Equipo</th><th>PJ</th><th>G</th><th>E</th><th>P</th>
                    <th>GF</th><th>GC</th><th>DG</th><th>Pts</th>
                </tr></thead>
                <tbody>${filas}</tbody>
            </table>
        </div>`;
}


function pintarFixture(t, uid) {
    const nombres = t.nombres || {};
    return (t.fixture || []).map(f => {
        const actual = f.fecha === (t.fechaActual || 1) && t.estado !== "FINALIZADO";
        const partidos = f.partidos.map(pt => {
            const jugado = pt.golesLocal != null;
            const marcador = jugado ? `${pt.golesLocal} - ${pt.golesVisitante}` : "vs";
            const mio = (pt.local === uid || pt.visitante === uid) ? " mio" : "";
            return `
                <div class="torneo-partido-wrap">
                    <div class="torneo-partido${mio}">
                        <span class="pl">${escapar(nombres[pt.local] || "Jugador")}</span>
                        <span class="mk ${jugado ? "jug" : ""}">${marcador}</span>
                        <span class="pv">${escapar(nombres[pt.visitante] || "Jugador")}</span>
                    </div>
                    ${jugado ? `<button class="torneo-relato-btn" data-relato="${pt.id}">📖 Ver relato</button>` : ""}
                </div>`;
        }).join("");
        return `
            <div class="torneo-fecha ${actual ? "actual" : ""}">
                <h4>Fecha ${f.fecha}${actual ? " · próxima" : ""}</h4>
                ${partidos}
            </div>`;
    }).join("");
}


function pintarSelectorMentalidad() {
    const of = equipoTorneo.mentalidadOfensiva || MENTALIDAD_OF_DEFAULT;
    const def = equipoTorneo.mentalidadDefensiva || MENTALIDAD_DEF_DEFAULT;
    const opsOf = CLAVES_OFENSIVA
        .map(k => `<option value="${k}" ${k === of ? "selected" : ""}>${MENTALIDADES_OF[k].etiqueta}</option>`).join("");
    const opsDef = CLAVES_DEFENSIVA
        .map(k => `<option value="${k}" ${k === def ? "selected" : ""}>${MENTALIDADES_DEF[k].etiqueta}</option>`).join("");
    return `
        <div class="torneo-ment">
            <h3>Mentalidad</h3>
            <p class="torneo-nota">La mentalidad se puede cambiar siempre, aunque el resto del equipo esté congelado.</p>
            <div class="torneo-ment-selects">
                <label>Ofensiva<select id="mentOf">${opsOf}</select></label>
                <label>Defensiva<select id="mentDef">${opsDef}</select></label>
            </div>
            <button id="torneoGuardarMent" class="secondary-button">Guardar mentalidad</button>
        </div>`;
}


// Busca un partido del fixture por su id.
function partidoPorId(t, id) {
    for (const f of (t.fixture || [])) {
        for (const pt of f.partidos) if (pt.id === id) return pt;
    }
    return null;
}

// Arma, desde el doc del equipo del torneo, el equipo que consume el motor
// (objetos completos, con `id` para etiquetar los eventos) y los ids para el
// relato. Mismo criterio que el servidor (equipoMotorDesdeDoc).
function equipoTorneoAMotor(equipoDoc, id) {
    const posDeSlot = mapaSlotPosicion(equipoDoc.formacion);
    const g = { POR: [], DEF: [], MED: [], DEL: [] };
    for (const [slot, pid] of Object.entries(equipoDoc.xi || {})) {
        if (pid == null) continue;
        const pl = CATALOGO.get(pid);
        if (pl && g[posDeSlot[slot]]) g[posDeSlot[slot]].push(pl);
    }
    const of = equipoDoc.mentalidadOfensiva || MENTALIDAD_OF_DEFAULT;
    const def = equipoDoc.mentalidadDefensiva || MENTALIDAD_DEF_DEFAULT;
    return {
        motor: {
            id,
            arquero: g.POR[0], defensores: g.DEF, medios: g.MED, delanteros: g.DEL,
            formacion: equipoDoc.formacion, mentalidadOfensiva: of, mentalidadDefensiva: def
        },
        ids: {
            arquero: g.POR[0]?.id,
            defensores: g.DEF.map(p => p.id),
            medios: g.MED.map(p => p.id),
            delanteros: g.DEL.map(p => p.id),
            formacion: equipoDoc.formacion, mentalidadOfensiva: of, mentalidadDefensiva: def
        }
    };
}

// Arma el registro de relato de un partido de torneo ya jugado (A3): re-simula
// con la semilla guardada (mismo resultado, el motor no es simétrico así que
// corre siempre local→visitante como el servidor). Si el que mira jugó ese
// partido, se lo pone como "usuario" para el color de goles a favor/contra; si
// es un partido ajeno (espectador), queda "usuario" el local, sin efecto en el
// marcador, solo en el color.
async function construirRegistroRelato(t, pt) {
    const uid = usuarioActual()?.uid;
    const [eqL, eqV] = await Promise.all([
        obtenerEquipoTorneo(t.id, pt.local),
        obtenerEquipoTorneo(t.id, pt.visitante)
    ]);
    if (!eqL || !eqV) throw new Error("No se encontraron los equipos del partido.");

    const viewerVis = pt.visitante === uid;   // ¿el que mira jugó de visitante?

    const localM = equipoTorneoAMotor(eqL, viewerVis ? "RIVAL" : "USUARIO");
    const visM   = equipoTorneoAMotor(eqV, viewerVis ? "USUARIO" : "RIVAL");
    const r = simularPartido(localM.motor, visM.motor, pt.semilla);

    return {
        equipoUsuarioIds: viewerVis ? visM.ids : localM.ids,
        equipoRivalIds:   viewerVis ? localM.ids : visM.ids,
        nombreUsuario: t.nombres?.[viewerVis ? pt.visitante : pt.local] || "Local",
        rivalNombre:   t.nombres?.[viewerVis ? pt.local : pt.visitante] || "Visitante",
        semilla: pt.semilla,
        golesUsuario: viewerVis ? pt.golesVisitante : pt.golesLocal,
        golesRival:   viewerVis ? pt.golesLocal : pt.golesVisitante,
        eventos: r.eventos
    };
}

// Ver el relato de un partido de torneo ya jugado, desde el fixture histórico.
async function onVerRelato(t, partidoId) {
    if (ocupado) return;
    const pt = partidoPorId(t, partidoId);
    if (!pt || pt.golesLocal == null) return;

    ocupado = true;
    mensajeArmado = { tipo: "info", texto: "Cargando el relato…" };
    pintar();
    try {
        const registro = await construirRegistroRelato(t, pt);
        mensajeArmado = null;
        reproducirRelatoExterno(registro, () => { showScreen("torneosScreen"); pintar(); });
    } catch (e) {
        mensajeArmado = { tipo: "error", texto: e?.message || "No se pudo abrir el relato." };
        pintar();
    } finally {
        ocupado = false;
    }
}

// Ver el relato de un partido desde la pantalla "fecha jugada" (post-Etapa 10):
// además marca el partido como visto, para que la lista se actualice.
async function onVerRelatoFecha(t, partidoId) {
    if (ocupado) return;
    const pt = partidoPorId(t, partidoId);
    if (!pt || pt.golesLocal == null) return;

    ocupado = true;
    mensajeArmado = { tipo: "info", texto: "Cargando el relato…" };
    pintar();
    try {
        const registro = await construirRegistroRelato(t, pt);
        mensajeArmado = null;
        if (fechaRecienJugada) fechaRecienJugada.vistos.add(partidoId);
        reproducirRelatoExterno(registro, () => { showScreen("torneosScreen"); pintar(); });
    } catch (e) {
        mensajeArmado = { tipo: "error", texto: e?.message || "No se pudo abrir el relato." };
        pintar();
    } finally {
        ocupado = false;
    }
}


// Pantalla que se abre justo después de JUGAR FECHA: lista los partidos de esa
// fecha (ya simulados por el servidor) para verlos de a uno con relato, antes
// de pasar a la tabla actualizada.
function pintarFechaJugada(c, t, info) {
    const f = (t.fixture || []).find(x => x.fecha === info.fecha);
    if (!f) { fechaRecienJugada = null; pintar(); return; }
    const nombres = t.nombres || {};

    const partidos = f.partidos.map(pt => {
        const visto = info.vistos.has(pt.id);
        return `
            <div class="torneo-partido-wrap">
                <div class="torneo-partido">
                    <span class="pl">${escapar(nombres[pt.local] || "Jugador")}</span>
                    <span class="mk jug">${pt.golesLocal} - ${pt.golesVisitante}</span>
                    <span class="pv">${escapar(nombres[pt.visitante] || "Jugador")}</span>
                </div>
                <button class="torneo-relato-btn" data-relato-fecha="${pt.id}">
                    ${visto ? "✓ Ver de nuevo" : "▶ Ver partido"}
                </button>
            </div>`;
    }).join("");

    c.innerHTML = `
        <div class="torneo-detalle">
            <span class="eyebrow">Fecha ${info.fecha} jugada</span>
            <h2>${escapar(t.nombre)}</h2>
            ${bannerMensaje()}
            <p class="torneo-nota">Mirá el relato de los partidos de la fecha, de a uno, o pasá directo a la tabla.</p>
            <div class="torneo-fecha actual">${partidos}</div>
            <button id="torneoContinuarFecha" class="main-button">Continuar →</button>
        </div>`;

    cont().querySelectorAll("[data-relato-fecha]").forEach(b =>
        b.addEventListener("click", () => onVerRelatoFecha(t, b.dataset.relatoFecha))
    );
    document.getElementById("torneoContinuarFecha").addEventListener("click", () => {
        fechaRecienJugada = null;
        pintar();
    });
}

// Premio en Fichas según el puesto final (§43). Debe coincidir con el servidor.
function premioDePuesto(puesto, n) {
    const cfg = ECONOMIA.premiosTorneo;
    if (puesto === 1) return cfg.campeonBase + cfg.campeonPorParticipante * n;
    if (puesto === 2) return cfg.subcampeonBase + cfg.subcampeonPorParticipante * n;
    if (puesto === 3) return cfg.tercero;
    return cfg.participar;
}

// ¿Cualquiera puede forzar la fecha? (5 días sin avance, §41.2).
function puedeForzar(t) {
    if (!t.ultimoAvanceEn) return false;
    const dias = (Date.now() - new Date(t.ultimoAvanceEn).getTime()) / 86400000;
    return dias >= (t.forzadoPorInactividadDias || 5);
}


// ==========================================
// ENGANCHE DE EVENTOS DEL ARMADO
// ==========================================

function enganchesArmado(t, uid, abierta) {
    if (!abierta) return;

    engancharSelectorFormacion(t);

    // Abrir el selector para un slot vacío.
    cont().querySelectorAll("[data-abrir-slot]").forEach(b =>
        b.addEventListener("click", () => {
            slotAbierto = b.dataset.abrirSlot;
            reservaCandidatos = null;
            pintar();
        })
    );

    // Liberar un jugador del XI.
    cont().querySelectorAll("[data-liberar]").forEach(b =>
        b.addEventListener("click", () => onLiberar(t.id, Number(b.dataset.liberar)))
    );

    // Reclamar un jugador (propio o de reserva). Capturamos el slot abierto al
    // enganchar, para no depender de una variable global al momento del click.
    const slotDelPicker = slotAbierto;
    cont().querySelectorAll("[data-reclamar]").forEach(b =>
        b.addEventListener("click", () => onReclamar(t.id, Number(b.dataset.reclamar), slotDelPicker))
    );

    const cerrar = document.getElementById("torneoCerrarPicker");
    if (cerrar) cerrar.addEventListener("click", () => { slotAbierto = null; reservaCandidatos = null; pintar(); });

    const verReserva = document.getElementById("torneoVerReserva");
    if (verReserva) verReserva.addEventListener("click", () => onVerReserva(t.id));
}

function engancharSelectorFormacion(t) {
    cont().querySelectorAll("[data-formacion]").forEach(b =>
        b.addEventListener("click", () => onElegirFormacion(t.id, b.dataset.formacion))
    );
}


// ==========================================
// ACCIONES
// ==========================================

async function onCrear() {
    if (ocupado) return;
    const nombre = document.getElementById("torneoNombre").value.trim();
    if (!nombre) { alert("Ponele un nombre al torneo."); return; }
    ocupado = true;
    try {
        const r = await crearTorneoNube(nombre);
        detalleId = r.torneoId;      // abrimos su detalle; la lista llega por el listener
        avisoValidacion = "";
        pintar();
    } catch (e) {
        alert(e?.message || "No se pudo crear el torneo.");
    } finally {
        ocupado = false;
    }
}

async function onUnirse() {
    if (ocupado) return;
    const codigo = document.getElementById("torneoCodigo").value.trim().toUpperCase();
    if (!codigo) { alert("Escribí el código de invitación."); return; }
    ocupado = true;
    try {
        const r = await unirseTorneoNube(codigo);
        detalleId = r.torneoId;
        avisoValidacion = "";
        pintar();
    } catch (e) {
        alert(e?.message || "No se pudo unir al torneo.");
    } finally {
        ocupado = false;
    }
}

async function onAbrirArmado(torneoId) {
    if (ocupado) return;
    ocupado = true;
    avisoValidacion = "";
    try {
        const r = await abrirArmadoNube(torneoId);
        if (!r.ok) {
            // Pool insuficiente (§37): mostrar qué falta y las 3 salidas.
            const v = r.validacion;
            avisoValidacion = `
                ⚠️ <strong>No alcanza el plantel del grupo.</strong> Faltan
                <strong>${v.faltan} ${POS_NOMBRE[v.pos] || v.pos}</strong> distintos
                entre todos (hay ${v.conteo[v.pos]}, se necesitan ${v.requerido[v.pos]}).<br>
                Opciones (§37): abrir más sobres para conseguir esos jugadores,
                jugar con menos participantes, o (más adelante) usar el modo libre / el
                pool de reserva.`;
        }
        pintar();
    } catch (e) {
        alert(e?.message || "No se pudo abrir el armado.");
    } finally {
        ocupado = false;
    }
}

async function onElegirFormacion(torneoId, formacion) {
    if (ocupado) return;
    // Cambiar de formación libera lo reclamado: confirmamos si ya había equipo con jugadores.
    const teniaJugadores = equipoTorneo && Object.values(equipoTorneo.xi || {}).some(Boolean);
    if (equipoTorneo && formacion === equipoTorneo.formacion) return;   // sin cambios
    if (teniaJugadores &&
        !confirm("Cambiar de formación va a liberar los jugadores que reclamaste. ¿Seguís?")) {
        return;
    }
    ocupado = true;
    mensajeArmado = null;
    try {
        await elegirFormacionTorneoNube(torneoId, formacion);
        resetPicker();
        // El equipo actualizado llega por el listener (escucharEquipoTorneo).
    } catch (e) {
        mensajeArmado = { tipo: "error", texto: e?.message || "No se pudo elegir la formación." };
    } finally {
        ocupado = false;
        pintar();
    }
}

async function onReclamar(torneoId, playerId, slot) {
    const puesto = slot || slotAbierto;
    if (ocupado || !puesto) return;
    ocupado = true;
    mensajeArmado = null;
    try {
        await reclamarJugadorNube(torneoId, playerId, puesto);
        // Actualización optimista: mostramos el jugador en el puesto ya mismo
        // (el listener lo confirma enseguida). Así en mobile se ve al instante.
        if (equipoTorneo) equipoTorneo.xi = { ...(equipoTorneo.xi || {}), [puesto]: playerId };
        const pl = CATALOGO.get(playerId);
        mensajeArmado = { tipo: "ok", texto: `${pl?.name || "Jugador"} agregado al puesto.` };
        slotAbierto = null;
        reservaCandidatos = null;
    } catch (e) {
        mensajeArmado = { tipo: "error", texto: e?.message || "No se pudo reclamar al jugador (probá de nuevo)." };
    } finally {
        ocupado = false;
        pintar();   // refresca SIEMPRE (éxito o error), no dependemos solo del listener
    }
}

async function onLiberar(torneoId, playerId) {
    if (ocupado) return;
    ocupado = true;
    mensajeArmado = null;
    try {
        await liberarJugadorNube(torneoId, playerId);
        // Actualización optimista: vaciamos el puesto que lo tenía.
        if (equipoTorneo?.xi) {
            const xi = { ...equipoTorneo.xi };
            for (const s of Object.keys(xi)) if (xi[s] === playerId) xi[s] = null;
            equipoTorneo.xi = xi;
        }
    } catch (e) {
        mensajeArmado = { tipo: "error", texto: e?.message || "No se pudo liberar al jugador." };
    } finally {
        ocupado = false;
        pintar();
    }
}

// Copiar el equipo del modo normal al torneo: pone la misma formación y reclama
// cada jugador que esté LIBRE (respeta la exclusividad, §36.1). Los que ya tomó
// otro se saltean y se avisan para completarlos a mano.
async function onCopiarEquipoIA(t) {
    if (ocupado) return;
    const miTeam = estado.team || {};
    const ids = Object.entries(miTeam).filter(([, pid]) => pid);
    if (ids.length === 0) {
        mensajeArmado = { tipo: "error", texto: "No tenés un equipo armado en el modo normal para copiar." };
        pintar();
        return;
    }
    if (!confirm("Voy a poner tu formación del modo normal y reclamar los jugadores que estén libres. ¿Seguís?")) return;

    ocupado = true;
    mensajeArmado = { tipo: "info", texto: "Copiando tu equipo…" };
    pintar();
    try {
        // 1) Misma formación que el modo normal (libera lo que hubiera reclamado).
        await elegirFormacionTorneoNube(t.id, estado.formacion);
        // 2) Reclamar cada jugador en su puesto; saltear los ya tomados.
        const noPudieron = [];
        for (const [slot, pid] of ids) {
            try {
                await reclamarJugadorNube(t.id, pid, slot);
            } catch (e) {
                noPudieron.push(CATALOGO.get(pid)?.name || `#${pid}`);
            }
        }
        mensajeArmado = noPudieron.length === 0
            ? { tipo: "ok", texto: "¡Listo! Copié tu equipo del modo normal." }
            : { tipo: "info", texto: `Copié tu equipo. No pude reclamar (ya los tomó otro): ${noPudieron.join(", ")}. Completá esos puestos a mano.` };
        resetPicker();
    } catch (e) {
        mensajeArmado = { tipo: "error", texto: e?.message || "No se pudo copiar el equipo." };
    } finally {
        ocupado = false;
        pintar();
    }
}

async function onVerReserva(torneoId) {
    if (cargandoReserva || !slotAbierto) return;
    const posicion = mapaSlotPosicion(equipoTorneo.formacion)[slotAbierto];
    cargandoReserva = true;
    pintar();
    try {
        const r = await listarPoolReservaNube(torneoId, posicion);
        reservaCandidatos = r.candidatos || [];
    } catch (e) {
        reservaCandidatos = [];
        alert(e?.message || "No se pudo cargar el pool de reserva.");
    } finally {
        cargandoReserva = false;
        pintar();
    }
}


// --- Competencia (Etapa 10A) ---

async function onIniciarTorneo(t, abierta) {
    if (ocupado) return;
    const msg = abierta
        ? "Iniciar cierra el armado ahora (aunque la ventana de 24 hs no haya vencido) y genera el fixture. ¿Seguís?"
        : "Se va a generar el fixture y arrancar la liga. ¿Seguís?";
    if (!confirm(msg)) return;
    ocupado = true;
    mensajeArmado = null;
    try {
        const r = await iniciarTorneoNube(t.id);
        if (r && r.ok === false) {
            mensajeArmado = { tipo: "error", texto: "Todavía no se puede iniciar. No completaron su equipo: "
                + (r.incompletos || []).join(", ") + "." };
        }
        // El paso a EN_CURSO llega por el listener.
    } catch (e) {
        mensajeArmado = { tipo: "error", texto: e?.message || "No se pudo iniciar el torneo." };
    } finally {
        ocupado = false;
        pintar();
    }
}

async function onAvanzarFecha(torneoId) {
    if (ocupado) return;
    ocupado = true;
    mensajeArmado = null;
    try {
        const r = await avanzarFechaNube(torneoId);
        if (r && r.ok === false) {
            mensajeArmado = { tipo: "error", texto: "Todavía no se puede jugar la fecha. No completaron su equipo: "
                + (r.incompletos || []).join(", ") + "." };
        } else if (r && r.fechaJugada) {
            // Abre la pantalla de "fecha jugada" para ver los relatos de a uno.
            fechaRecienJugada = { torneoId, fecha: r.fechaJugada, vistos: new Set() };
        }
    } catch (e) {
        mensajeArmado = { tipo: "error", texto: e?.message || "No se pudo jugar la fecha." };
    } finally {
        ocupado = false;
        pintar();
    }
}

async function onGuardarMentalidad(torneoId) {
    if (ocupado) return;
    const of = document.getElementById("mentOf")?.value;
    const def = document.getElementById("mentDef")?.value;
    if (!of || !def) return;
    ocupado = true;
    mensajeArmado = null;
    try {
        await guardarMentalidadTorneoNube(torneoId, of, def);
        mensajeArmado = { tipo: "ok", texto: "Mentalidad guardada." };
    } catch (e) {
        mensajeArmado = { tipo: "error", texto: e?.message || "No se pudo guardar la mentalidad." };
    } finally {
        ocupado = false;
        pintar();
    }
}

// Reinicia un torneo terminado: libera todos los equipos armados (cada uno
// vuelve a elegir formación y jugadores) y vuelve a ARMADO con los mismos
// participantes. Solo el creador.
async function onReiniciarTorneo(t) {
    if (ocupado) return;
    if (!confirm("Reiniciar el torneo libera todos los equipos armados: cada uno vuelve a elegir "
        + "formación y jugadores desde cero para la nueva temporada. ¿Seguís?")) return;
    ocupado = true;
    mensajeArmado = null;
    try {
        const r = await reiniciarTorneoNube(t.id);
        if (r && r.ok === false) {
            const v = r.validacion;
            mensajeArmado = { tipo: "error", texto:
                `No alcanza el plantel del grupo para reiniciar: faltan ${v.faltan} ${POS_NOMBRE[v.pos] || v.pos} `
                + `distintos entre todos (hay ${v.conteo[v.pos]}, se necesitan ${v.requerido[v.pos]}).` };
        }
        // El paso a ARMADO llega por el listener.
    } catch (e) {
        mensajeArmado = { tipo: "error", texto: e?.message || "No se pudo reiniciar el torneo." };
    } finally {
        ocupado = false;
        pintar();
    }
}

// Borra definitivamente un torneo terminado. Solo el creador.
async function onBorrarTorneo(t) {
    if (ocupado) return;
    if (!confirm(`Borrar "${t.nombre}" definitivamente. Esta acción no se puede deshacer. ¿Seguís?`)) return;
    ocupado = true;
    try {
        await borrarTorneoNube(t.id);
        volverALista();
    } catch (e) {
        mensajeArmado = { tipo: "error", texto: e?.message || "No se pudo borrar el torneo." };
        pintar();
    } finally {
        ocupado = false;
    }
}


// ==========================================
// UTILIDADES
// ==========================================

function volverALista() {
    detalleId = null;
    avisoValidacion = "";
    mensajeArmado = null;
    fechaRecienJugada = null;
    detenerSubEquipo();
    resetPicker();
    pintar();
}

// Aviso visible en pantalla (reemplaza a alert(), que en mobile a veces no se ve).
function bannerMensaje() {
    if (!mensajeArmado) return "";
    const clase = mensajeArmado.tipo === "ok" ? "torneo-aviso torneo-aviso-ok"
        : mensajeArmado.tipo === "info" ? "torneo-aviso torneo-aviso-info"
        : "torneo-aviso torneo-aviso-error";
    return `<div class="${clase}">${escapar(mensajeArmado.texto)}</div>`;
}

// ¿Se puede editar el equipo del torneo ahora mismo? Dos momentos posibles:
// el armado inicial (ARMADO, ventana de 24hs) o la ventana de 1h que se abre
// entre fechas una vez EN_CURSO (mismo criterio que el servidor).
function edicionAbiertaCliente(t) {
    if (t.estado === "ARMADO") {
        return !!t.ventanaArmadoCierra && Date.now() < new Date(t.ventanaArmadoCierra).getTime();
    }
    if (t.estado === "EN_CURSO") {
        return !!t.ventanaEntreFechasCierra && Date.now() < new Date(t.ventanaEntreFechasCierra).getTime();
    }
    return false;
}

// Texto legible del tiempo que falta para que cierre la ventana.
function textoTiempoRestante(iso) {
    const ms = new Date(iso).getTime() - Date.now();
    if (ms <= 0) return "instantes";
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    return h > 0 ? `${h} h ${m} min` : `${m} min`;
}

// Mapa slot → posición de una formación (ej. { por1:"POR", def1:"DEF", ... }).
function mapaSlotPosicion(formacion) {
    const m = {};
    for (const { slot, position } of slotsDeFormacion(formacion)) m[slot] = position;
    return m;
}

// Escapa texto para no romper el HTML (nombres los eligen los usuarios).
function escapar(s) {
    return String(s).replace(/[&<>"']/g, ch => (
        { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]
    ));
}


export function initTorneos() {
    document.getElementById("backFromTorneos")
        .addEventListener("click", () => {
            // Volver al home desde la sala.
            document.querySelector('.nav-button[data-screen="homeScreen"]')?.click();
        });
}
