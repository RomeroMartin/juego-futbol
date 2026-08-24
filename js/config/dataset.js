// ==========================================
// VERSIÓN DEL DATASET
// ==========================================
//
// Identifica el plantel activo. Cuando cambia (porque se regeneró
// js/data/jugadores.js con otro dataset), las colecciones guardadas que
// referencian jugadores viejos dejan de ser válidas y hay que resetearlas
// (ver sincronizarDataset() en core/storage.js).
//
// Subir este valor a mano cada vez que se reemplaza el plantel por uno con
// ids distintos.

export const DATASET_VERSION = "lpf-eafc26-2026";

export const DATASET_LABEL = "Liga Profesional Argentina";
