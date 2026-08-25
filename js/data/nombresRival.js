// ==========================================
// NOMBRES DE EQUIPO FICTICIOS PARA LA IA (§31.3)
// ==========================================
//
// La IA NUNCA usa nombres de clubes reales (ni modificados de forma
// reconocible), para evitar el problema de derechos de §46. Estos tokens son
// inventados a propósito (mitología, naturaleza, palabras "épicas") y no
// corresponden a ningún club de la Liga Profesional ni a sus apodos.
//
// scripts/test-rival-ia.mjs cruza TODO el espacio de nombres generables contra
// los 30 clubes reales del dataset y falla si hay una sola colisión.

// Prefijos institucionales genéricos (no identifican a ningún club por sí solos).
export const PREFIJOS = [
    "Deportivo",
    "Atlético",
    "Sportivo",
    "Club",
    "Asociación",
    "Social",
    "Fundación"
];

// Núcleos inventados. Nada de ciudades, provincias ni apodos de clubes reales.
export const NUCLEOS = [
    "Cóndor",
    "Fénix",
    "Vendaval",
    "Titán",
    "Meteoro",
    "Cometa",
    "Halcón",
    "Jaguar",
    "Trueno",
    "Volcán",
    "Centauro",
    "Dragón",
    "Espartano",
    "Legión",
    "Boreal",
    "Austral",
    "Orión",
    "Cosmos",
    "Relámpago",
    "Coloso",
    "Tromba",
    "Nómade",
    "Imperio",
    "Quásar",
    "Basilisco",
    "Grifo",
    "Tornado",
    "Coraje"
];

// Formas plurales para el patrón "Los ...".
export const NUCLEOS_PLURALES = [
    "Cóndores",
    "Titanes",
    "Halcones",
    "Jaguares",
    "Dragones",
    "Espartanos",
    "Colosos",
    "Grifos",
    "Centauros",
    "Bravos"
];


// Genera un nombre de equipo ficticio. `rand` opcional (0..1); por defecto
// Math.random — NO es el motor de partido, así que Math.random está permitido.
export function generarNombreRival(rand = Math.random) {
    const pick = (arr) => arr[Math.floor(rand() * arr.length)];

    // Dos patrones para dar variedad: "Prefijo Núcleo" o "Los NúcleosPlural".
    if (rand() < 0.75) {
        return `${pick(PREFIJOS)} ${pick(NUCLEOS)}`;
    }
    return `Los ${pick(NUCLEOS_PLURALES)}`;
}
