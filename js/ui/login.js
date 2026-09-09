// ==========================================
// UI DE LOGIN / REGISTRO (Etapa 7)
// ==========================================
//
// Pantalla de entrada (overlay a pantalla completa). Dispara las acciones de
// auth.js; NO carga datos de juego: de eso se encarga main.js cuando la sesión
// cambia (observarSesion). Cubre toda la app hasta que hay sesión.

import {
    registrarConEmail,
    entrarConEmail,
    entrarConGoogle,
    mensajeDeError
} from "../core/auth.js";


// Elementos del overlay.
let overlay, card, cargando, form;
let tabLogin, tabRegister, nombreCampo, nombreInput, emailInput, passwordInput;
let submitBtn, googleBtn, errorBox;

// Modo actual: "login" | "register".
let modo = "login";
let procesando = false;


// ==========================================
// ENGANCHE INICIAL
// ==========================================

export function initLogin() {
    overlay      = document.getElementById("authOverlay");
    card         = document.getElementById("authCard");
    cargando     = document.getElementById("authCargando");
    form         = document.getElementById("authForm");
    tabLogin     = document.getElementById("authTabLogin");
    tabRegister  = document.getElementById("authTabRegister");
    nombreCampo  = document.getElementById("authNombreCampo");
    nombreInput  = document.getElementById("authNombre");
    emailInput   = document.getElementById("authEmail");
    passwordInput = document.getElementById("authPassword");
    submitBtn    = document.getElementById("authSubmit");
    googleBtn    = document.getElementById("authGoogle");
    errorBox     = document.getElementById("authError");

    tabLogin.addEventListener("click", () => cambiarModo("login"));
    tabRegister.addEventListener("click", () => cambiarModo("register"));

    form.addEventListener("submit", onSubmit);
    googleBtn.addEventListener("click", onGoogle);

    cambiarModo("login");
}


// ==========================================
// CAMBIO DE PESTAÑA (ingresar / crear cuenta)
// ==========================================

function cambiarModo(nuevo) {
    modo = nuevo;
    limpiarError();

    const esRegistro = modo === "register";
    tabRegister.classList.toggle("active", esRegistro);
    tabLogin.classList.toggle("active", !esRegistro);

    nombreCampo.hidden = !esRegistro;
    nombreInput.required = esRegistro;

    submitBtn.textContent = esRegistro ? "CREAR CUENTA" : "INGRESAR";
    passwordInput.autocomplete = esRegistro ? "new-password" : "current-password";
}


// ==========================================
// ACCIONES
// ==========================================

async function onSubmit(evento) {
    evento.preventDefault();
    if (procesando) return;

    const email = emailInput.value.trim();
    const password = passwordInput.value;
    const nombre = nombreInput.value.trim();

    setProcesando(true);
    limpiarError();

    try {
        if (modo === "register") {
            await registrarConEmail(email, password, nombre);
        } else {
            await entrarConEmail(email, password);
        }
        // El éxito lo maneja main.js (observarSesion): mostrará el juego.
    } catch (error) {
        mostrarErrorAuth(mensajeDeError(error));
        setProcesando(false);
    }
}

async function onGoogle() {
    if (procesando) return;
    setProcesando(true);
    limpiarError();

    try {
        await entrarConGoogle();
    } catch (error) {
        mostrarErrorAuth(mensajeDeError(error));
        setProcesando(false);
    }
}


// ==========================================
// ESTADOS DEL OVERLAY (los usa main.js)
// ==========================================

// Muestra el formulario de login (no hay sesión).
export function mostrarLogin() {
    overlay.hidden = false;
    cargando.hidden = true;
    card.hidden = false;
    setProcesando(false);
}

// "Ocupado": tapa el formulario con un spinner mientras se carga la partida.
export function authOcupado(activo) {
    overlay.hidden = false;
    cargando.hidden = !activo;
    card.hidden = !!activo;
}

// Oculta el overlay entero (hay sesión y la partida ya está cargada).
export function ocultarAuth() {
    overlay.hidden = true;
    setProcesando(false);
}

export function mostrarErrorAuth(mensaje) {
    // Si estábamos en el spinner de carga, volvemos a mostrar el formulario.
    cargando.hidden = true;
    card.hidden = false;
    errorBox.textContent = mensaje;
    errorBox.hidden = false;
}


// ==========================================
// HELPERS INTERNOS
// ==========================================

function setProcesando(activo) {
    procesando = activo;
    submitBtn.disabled = activo;
    googleBtn.disabled = activo;
    emailInput.disabled = activo;
    passwordInput.disabled = activo;
    nombreInput.disabled = activo;
    submitBtn.classList.toggle("procesando", activo);
}

function limpiarError() {
    errorBox.hidden = true;
    errorBox.textContent = "";
}
