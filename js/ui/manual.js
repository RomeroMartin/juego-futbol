// ==========================================
// MANUAL DE MENTALIDADES (D2, post-Etapa 10)
// ==========================================
//
// Pantalla propia, sin números: qué mejora y qué empeora cada mentalidad, en
// criollo. El detalle numérico real vive en config/mentalidades.js — acá solo
// la explicación para el jugador. Recuerda desde qué pantalla se abrió
// (equipo propio o torneo) para volver ahí, no siempre a la misma.

import { showScreen } from "./navegacion.js";
import { MENTALIDADES_OF, MENTALIDADES_DEF } from "../config/mentalidades.js";

let origenManual = "teamScreen";

export function abrirManual(origen) {
    origenManual = origen || "teamScreen";
    showScreen("manualScreen");
}

const MANUAL_OFENSIVAS = {
    EQUIPO_RAPIDO: {
        resumen: "Juego vertical y rápido, al primer toque.",
        mejora: "Genera muchas más ocasiones de gol seguidas.",
        empeora: "Cada ocasión es de menor calidad (fallás más seguido) y se resiente el control del mediocampo.",
        tip: "Ideal contra rivales que se tiran encima (Presión Alta, Línea Adelantada): les explotás el espacio que dejan atrás."
    },
    JUEGO_ABIERTO: {
        resumen: "Juego por las bandas, centros al área.",
        mejora: "Aprovecha muy bien el ancho de la cancha en formaciones abiertas (3-4-3, 4-3-3).",
        empeora: "Depende mucho de la formación: en una formación angosta (4-2-3-1) rinde poco.",
        tip: "Ideal contra bloques compactos por el medio: los desbordás por afuera."
    },
    POSESION: {
        resumen: "Toque, paciencia, jugadas elaboradas.",
        mejora: "Las ocasiones que genera son de mucha calidad.",
        empeora: "Genera bastantes menos ocasiones en total; sufre contra la presión alta.",
        tip: "Ideal contra rivales pasivos que te dejan tener la pelota (Línea Media)."
    },
    EQUILIBRADO: {
        resumen: "Sin apuesta táctica.",
        mejora: "Nada — no suma bonos.",
        empeora: "Nada — tampoco resta.",
        tip: "La opción segura para cuando no querés arriesgar nada."
    },
    CONTRAGOLPE: {
        resumen: "Espera agazapado y golpea rápido apenas recupera la pelota.",
        mejora: "Cuando ataca, la ocasión que genera suele ser clarísima.",
        empeora: "Ataca bastante menos seguido: cede la iniciativa y el mediocampo.",
        tip: "Devastador contra rivales que se adelantan mucho (Línea Adelantada, Presión Alta). Muy flojo contra un rival que nunca se anima a subir (Cerrojo) o que está armado justo para cortar la salida rápida (Repliegue tras Pérdida)."
    },
    JUEGO_DIRECTO: {
        resumen: "Pelotazos largos que se saltan el mediocampo.",
        mejora: "Llega rápido y seguido al área rival.",
        empeora: "Pierde el control del medio y cada intento es menos preciso que uno jugado.",
        tip: "Ideal contra presiones altas: jugás por arriba de ellas. Flojo contra defensas ordenadas y compactas (Cerrojo, Bloque Compacto)."
    },
    ATAQUE_TOTAL: {
        resumen: "Todo el equipo vuelca al ataque.",
        mejora: "Mete mucha gente arriba: más volumen ofensivo que cualquier otra mentalidad.",
        empeora: "Queda muy expuesto atrás — un rival ordenado te castiga caro.",
        tip: "Solo rinde de verdad contra un rival igual de arriesgado (Presión Alta, Línea Adelantada). Muy flojo contra bloques bajos y contra el Repliegue tras Pérdida, que vive de castigar justo este desborde de gente hacia arriba."
    },
    DESBORDE_INDIVIDUAL: {
        resumen: "Juego 1 contra 1 por los costados.",
        mejora: "Gana la mayoría de los duelos individuales con ocasiones claras — funciona incluso contra defensas cerradas, porque crea su propia ocasión.",
        empeora: "Depende de la amplitud de la formación; sufre contra presiones rápidas que no dejan encarar con espacio.",
        tip: "Ideal contra líneas altas (la velocidad en el 1v1 las castiga) y contra bloques compactos."
    }
};

const MANUAL_DEFENSIVAS = {
    BLOQUE_COMPACTO: {
        resumen: "Todos juntos, cerca del arco propio.",
        mejora: "Concede muchas menos ocasiones de gol.",
        empeora: "Cede el mediocampo — no le importa no tener la pelota.",
        tip: "Funciona mejor en formaciones con mucha densidad central."
    },
    PRESION_ALTA: {
        resumen: "Recupera arriba, incomoda al rival desde su propia salida.",
        mejora: "Gana mucho mediocampo.",
        empeora: "Queda muy expuesta a los contraataques: si te saltan la presión, quedás solo atrás.",
        tip: "Funciona mejor en formaciones con mucha densidad central. Alto riesgo, alta recompensa."
    },
    LINEA_MEDIA: {
        resumen: "Sin apuesta táctica.",
        mejora: "Nada — no suma bonos.",
        empeora: "Nada — tampoco resta.",
        tip: "La opción segura para cuando no querés arriesgar nada."
    },
    CERROJO: {
        resumen: "El bloque bajo de toda la vida: nadie pasa por el área.",
        mejora: "La defensa más sólida que hay — concede muy pocas ocasiones limpias.",
        empeora: "Regala el mediocampo por completo, no le importa no tener la pelota.",
        tip: "Funciona mejor en formaciones con mucha densidad central (necesita gente atrás). Sólida contra casi cualquier ataque, salvo el Desborde Individual, que a veces la sortea igual."
    },
    LINEA_ADELANTADA: {
        resumen: "Línea de fondo muy subida, juega en offside.",
        mejora: "Aprieta la cancha y gana mediocampo.",
        empeora: "Deja un espacio enorme a la espalda de los defensores.",
        tip: "Muy vulnerable contra el Contragolpe y el Juego Directo (te castigan el espacio libre). Aguanta mejor contra estilos lentos, sin velocidad en profundidad (Posesión, Juego Abierto)."
    },
    REPLIEGUE_TRAS_PERDIDA: {
        resumen: "Apenas se pierde la pelota, todo el equipo retrocede rápido a su posición.",
        mejora: "Corta las salidas rápidas del rival — es la mejor respuesta al Contragolpe y al Ataque Total.",
        empeora: "No presiona arriba: deja construir tranquilo a un rival paciente.",
        tip: "La mejor opción contra estilos rápidos y directos. Floja si el rival juega con calma (Posesión)."
    }
};

function tarjeta(clave, etiqueta, datos) {
    return `
        <div class="manual-card">
            <h4>${etiqueta}</h4>
            <p class="manual-resumen">${datos.resumen}</p>
            <p class="manual-linea manual-mejora"><strong>Mejora:</strong> ${datos.mejora}</p>
            <p class="manual-linea manual-empeora"><strong>Empeora:</strong> ${datos.empeora}</p>
            <p class="manual-linea manual-tip">💡 ${datos.tip}</p>
        </div>`;
}

export function renderManual() {
    const c = document.getElementById("manualContenido");
    if (!c) return;

    const ofensivas = Object.entries(MANUAL_OFENSIVAS)
        .map(([clave, datos]) => tarjeta(clave, etiquetaOfensiva(clave), datos)).join("");
    const defensivas = Object.entries(MANUAL_DEFENSIVAS)
        .map(([clave, datos]) => tarjeta(clave, etiquetaDefensiva(clave), datos)).join("");

    c.innerHTML = `
        <h3 class="manual-seccion">Mentalidades ofensivas</h3>
        <div class="manual-grid">${ofensivas}</div>

        <h3 class="manual-seccion">Mentalidades defensivas</h3>
        <div class="manual-grid">${defensivas}</div>
    `;
}

// Las etiquetas (nombre en pantalla) viven en config/mentalidades.js.
function etiquetaOfensiva(clave) {
    return MENTALIDADES_OF[clave]?.etiqueta || clave;
}

function etiquetaDefensiva(clave) {
    return MENTALIDADES_DEF[clave]?.etiqueta || clave;
}


// ==========================================
// INIT
// ==========================================

export function initManual() {
    document.getElementById("backFromManual")
        ?.addEventListener("click", () => showScreen(origenManual));
}
