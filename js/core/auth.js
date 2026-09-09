// ==========================================
// AUTENTICACIÓN (§44, Etapa 7)
// ==========================================
//
// Envuelve Firebase Authentication (email/password + Google). No toca datos de
// juego: solo abre/cierra sesión y avisa quién está logueado. La carga de la
// partida la dispara main.js al recibir el usuario desde observarSesion().

import { auth } from "../config/firebase.js";
import {
    onAuthStateChanged,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signInWithPopup,
    GoogleAuthProvider,
    updateProfile,
    signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";


const proveedorGoogle = new GoogleAuthProvider();


// Observa el estado de sesión. `callback(user)` se llama con el usuario cuando
// hay sesión (al entrar, o al recargar si Firebase recuerda la sesión) y con
// `null` cuando no la hay (al salir). Es la fuente de verdad de "hay sesión".
export function observarSesion(callback) {
    return onAuthStateChanged(auth, callback);
}


// Usuario actualmente logueado (o null). Lo usa la capa de datos para saber a
// qué documento de Firestore escribir.
export function usuarioActual() {
    return auth.currentUser;
}


// ==========================================
// ACCIONES DE SESIÓN
// ==========================================

// Registro con email + contraseña. Guarda el nombre visible (displayName) para
// usarlo como perfil (§44). Devuelve el UserCredential de Firebase.
export async function registrarConEmail(email, password, nombre) {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    if (nombre) {
        await updateProfile(cred.user, { displayName: nombre });
    }
    return cred;
}

// Ingreso con email + contraseña.
export async function entrarConEmail(email, password) {
    return signInWithEmailAndPassword(auth, email, password);
}

// Ingreso con Google (popup).
export async function entrarConGoogle() {
    return signInWithPopup(auth, proveedorGoogle);
}

// Cierra la sesión. observarSesion() recibirá null.
export async function salir() {
    return signOut(auth);
}


// ==========================================
// MENSAJES DE ERROR EN ESPAÑOL
// ==========================================
//
// Firebase devuelve códigos como "auth/email-already-in-use". Los traducimos a
// algo que un jugador entienda. Cualquier código no listado cae al genérico.

const MENSAJES_ERROR = {
    "auth/invalid-email":            "El email no tiene un formato válido.",
    "auth/email-already-in-use":     "Ya existe una cuenta con ese email. Probá ingresando.",
    "auth/weak-password":            "La contraseña es muy corta (mínimo 6 caracteres).",
    "auth/missing-password":         "Escribí una contraseña.",
    "auth/invalid-credential":       "Email o contraseña incorrectos.",
    "auth/user-not-found":           "No hay ninguna cuenta con ese email.",
    "auth/wrong-password":           "Email o contraseña incorrectos.",
    "auth/too-many-requests":        "Demasiados intentos. Esperá un momento y probá de nuevo.",
    "auth/popup-closed-by-user":     "Cerraste la ventana de Google antes de terminar.",
    "auth/cancelled-popup-request":  "Se canceló el ingreso con Google.",
    "auth/network-request-failed":   "Sin conexión. Revisá tu internet y reintentá.",
    "auth/unauthorized-domain":      "Este dominio no está autorizado en Firebase (Authentication → Settings → Authorized domains)."
};

export function mensajeDeError(error) {
    return MENSAJES_ERROR[error?.code] || "Ocurrió un error. Probá de nuevo.";
}
