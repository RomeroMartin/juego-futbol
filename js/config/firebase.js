// ==========================================
// CONFIGURACIÓN E INICIALIZACIÓN DE FIREBASE (Etapa 7)
// ==========================================
//
// Única dependencia externa del proyecto (permitida a partir de la Etapa 7,
// ver CLAUDE.md). Se carga el SDK modular de Firebase como MÓDULOS ES NATIVOS
// desde el CDN de gstatic: sin npm, sin bundler, sin build. Igual que el resto
// del juego, corre con Live Server / cualquier servidor estático.
//
// 🔑 `firebaseConfig` NO es secreto: la apiKey web de Firebase es pública y va
// en el frontend. Lo que protege los datos son las REGLAS de Firestore
// (ver firestore.rules) y el login, no ocultar estas claves.
//
// Versión del SDK fijada a propósito (§ regla técnica: pinear versiones).

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { initializeFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getFunctions } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js";


// Configuración del proyecto (consola de Firebase → Configuración del proyecto).
const firebaseConfig = {
    apiKey: "AIzaSyCn3L_6xW_59gBkfEfWuv5Ow6vWt8NV1Ow",
    authDomain: "futbol-figuritas.firebaseapp.com",
    projectId: "futbol-figuritas",
    storageBucket: "futbol-figuritas.firebasestorage.app",
    messagingSenderId: "921410985531",
    appId: "1:921410985531:web:df3eb7ee754edbcaec461e"
};


// Instancias compartidas por toda la app.
export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// `ignoreUndefinedProperties`: Firestore rechaza campos `undefined`. Los
// registros de partido son objetos anidados donde algún campo opcional puede
// venir sin valor; con esto se ignoran en vez de romper la escritura.
//
// `experimentalForceLongPolling`: por defecto Firestore usa una conexión por
// streaming (WebChannel) que ALGUNAS redes (proxies corporativos, la red de un
// negocio) o extensiones del navegador bloquean, dejando las operaciones
// colgadas para siempre. Acá se FUERZA "long polling" (peticiones HTTP normales)
// en vez de autodetectar: es lo más robusto detrás de esas redes. Cuesta un
// poquito más de latencia, imperceptible para este juego.
export const db = initializeFirestore(app, {
    ignoreUndefinedProperties: true,
    experimentalForceLongPolling: true
});

// Cloud Functions (Etapa 8): toda la entrega de valor se pide acá. La región es
// la de por defecto (us-central1), que es donde se despliegan las funciones.
export const functions = getFunctions(app);
