// ==========================================
// DATOS DE JUGADORES (plantel de prueba)
// ==========================================
//
// Plantel de prueba de la V0.3, con el modelo de datos completo de §8: todos
// los campos existen aunque valgan null. En la Etapa 1 este archivo se
// reemplaza por el dataset real de la Liga Profesional (§10). El script de
// conversión del CSV debe volver a generar ESTE archivo como módulo .js
// (export const JUGADORES), NO como .json: un .json obligaría a fetch()
// asíncrono y a volver async todo el arranque, sin ninguna ganancia.
// Decisión registrada en ESTADO.md.
//
// El id es numérico en esta etapa. En la Etapa 1 la colección guardada se
// resetea (referencia jugadores de prueba que dejan de existir), así que no
// hace falta migrar el formato del id acá.

export const JUGADORES = [

    // =========================
    // ARQUEROS
    // =========================

    {
        id: 1,
        schemaVersion: 3,

        // Identidad
        name: "Franco Armani",
        shortName: null,
        club: "River Plate",
        clubId: null,
        nationality: null,
        age: null,

        // Posición
        position: "POR",
        secondaryPosition: null,

        // Stats
        overall: 82,
        pace: 55,
        shooting: 20,
        passing: 65,
        dribbling: 25,
        defending: 90,
        physical: 78,

        // Stats de arquero (null para jugadores de campo)
        gkDiving: null,
        gkHandling: null,
        gkPositioning: null,
        gkReflexes: null,
        gkKicking: null,

        // Metadata de juego
        rarity: null,
        season: null,
        photo: null
    },

    {
        id: 2,
        schemaVersion: 3,

        // Identidad
        name: "Agustín Marchesín",
        shortName: null,
        club: "Boca Juniors",
        clubId: null,
        nationality: null,
        age: null,

        // Posición
        position: "POR",
        secondaryPosition: null,

        // Stats
        overall: 80,
        pace: 52,
        shooting: 18,
        passing: 62,
        dribbling: 20,
        defending: 88,
        physical: 76,

        // Stats de arquero (null para jugadores de campo)
        gkDiving: null,
        gkHandling: null,
        gkPositioning: null,
        gkReflexes: null,
        gkKicking: null,

        // Metadata de juego
        rarity: null,
        season: null,
        photo: null
    },

    {
        id: 3,
        schemaVersion: 3,

        // Identidad
        name: "Sergio Romero",
        shortName: null,
        club: "Estudiantes",
        clubId: null,
        nationality: null,
        age: null,

        // Posición
        position: "POR",
        secondaryPosition: null,

        // Stats
        overall: 76,
        pace: 50,
        shooting: 15,
        passing: 58,
        dribbling: 20,
        defending: 84,
        physical: 74,

        // Stats de arquero (null para jugadores de campo)
        gkDiving: null,
        gkHandling: null,
        gkPositioning: null,
        gkReflexes: null,
        gkKicking: null,

        // Metadata de juego
        rarity: null,
        season: null,
        photo: null
    },

    // =========================
    // DEFENSORES
    // =========================

    {
        id: 4,
        schemaVersion: 3,

        // Identidad
        name: "Germán Pezzella",
        shortName: null,
        club: "River Plate",
        clubId: null,
        nationality: null,
        age: null,

        // Posición
        position: "DEF",
        secondaryPosition: null,

        // Stats
        overall: 81,
        pace: 67,
        shooting: 35,
        passing: 69,
        dribbling: 42,
        defending: 88,
        physical: 82,

        // Stats de arquero (null para jugadores de campo)
        gkDiving: null,
        gkHandling: null,
        gkPositioning: null,
        gkReflexes: null,
        gkKicking: null,

        // Metadata de juego
        rarity: null,
        season: null,
        photo: null
    },

    {
        id: 5,
        schemaVersion: 3,

        // Identidad
        name: "Marcos Rojo",
        shortName: null,
        club: "Boca Juniors",
        clubId: null,
        nationality: null,
        age: null,

        // Posición
        position: "DEF",
        secondaryPosition: null,

        // Stats
        overall: 79,
        pace: 61,
        shooting: 32,
        passing: 66,
        dribbling: 40,
        defending: 86,
        physical: 84,

        // Stats de arquero (null para jugadores de campo)
        gkDiving: null,
        gkHandling: null,
        gkPositioning: null,
        gkReflexes: null,
        gkKicking: null,

        // Metadata de juego
        rarity: null,
        season: null,
        photo: null
    },

    {
        id: 6,
        schemaVersion: 3,

        // Identidad
        name: "Lucas Martínez Quarta",
        shortName: null,
        club: "River Plate",
        clubId: null,
        nationality: null,
        age: null,

        // Posición
        position: "DEF",
        secondaryPosition: null,

        // Stats
        overall: 82,
        pace: 72,
        shooting: 36,
        passing: 74,
        dribbling: 45,
        defending: 89,
        physical: 79,

        // Stats de arquero (null para jugadores de campo)
        gkDiving: null,
        gkHandling: null,
        gkPositioning: null,
        gkReflexes: null,
        gkKicking: null,

        // Metadata de juego
        rarity: null,
        season: null,
        photo: null
    },

    {
        id: 7,
        schemaVersion: 3,

        // Identidad
        name: "Nicolás Figal",
        shortName: null,
        club: "Boca Juniors",
        clubId: null,
        nationality: null,
        age: null,

        // Posición
        position: "DEF",
        secondaryPosition: null,

        // Stats
        overall: 78,
        pace: 70,
        shooting: 30,
        passing: 68,
        dribbling: 42,
        defending: 84,
        physical: 80,

        // Stats de arquero (null para jugadores de campo)
        gkDiving: null,
        gkHandling: null,
        gkPositioning: null,
        gkReflexes: null,
        gkKicking: null,

        // Metadata de juego
        rarity: null,
        season: null,
        photo: null
    },

    {
        id: 8,
        schemaVersion: 3,

        // Identidad
        name: "Marcos Acuña",
        shortName: null,
        club: "River Plate",
        clubId: null,
        nationality: null,
        age: null,

        // Posición
        position: "DEF",
        secondaryPosition: null,

        // Stats
        overall: 80,
        pace: 82,
        shooting: 45,
        passing: 78,
        dribbling: 75,
        defending: 76,
        physical: 72,

        // Stats de arquero (null para jugadores de campo)
        gkDiving: null,
        gkHandling: null,
        gkPositioning: null,
        gkReflexes: null,
        gkKicking: null,

        // Metadata de juego
        rarity: null,
        season: null,
        photo: null
    },

    // =========================
    // MEDIOCAMPISTAS
    // =========================

    {
        id: 9,
        schemaVersion: 3,

        // Identidad
        name: "Leandro Paredes",
        shortName: null,
        club: "Boca Juniors",
        clubId: null,
        nationality: null,
        age: null,

        // Posición
        position: "MED",
        secondaryPosition: null,

        // Stats
        overall: 86,
        pace: 58,
        shooting: 72,
        passing: 94,
        dribbling: 82,
        defending: 65,
        physical: 70,

        // Stats de arquero (null para jugadores de campo)
        gkDiving: null,
        gkHandling: null,
        gkPositioning: null,
        gkReflexes: null,
        gkKicking: null,

        // Metadata de juego
        rarity: null,
        season: null,
        photo: null
    },

    {
        id: 10,
        schemaVersion: 3,

        // Identidad
        name: "Exequiel Palacios",
        shortName: null,
        club: "River Plate",
        clubId: null,
        nationality: null,
        age: null,

        // Posición
        position: "MED",
        secondaryPosition: null,

        // Stats
        overall: 84,
        pace: 75,
        shooting: 63,
        passing: 88,
        dribbling: 84,
        defending: 71,
        physical: 75,

        // Stats de arquero (null para jugadores de campo)
        gkDiving: null,
        gkHandling: null,
        gkPositioning: null,
        gkReflexes: null,
        gkKicking: null,

        // Metadata de juego
        rarity: null,
        season: null,
        photo: null
    },

    {
        id: 11,
        schemaVersion: 3,

        // Identidad
        name: "Rodrigo Aliendro",
        shortName: null,
        club: "River Plate",
        clubId: null,
        nationality: null,
        age: null,

        // Posición
        position: "MED",
        secondaryPosition: null,

        // Stats
        overall: 77,
        pace: 63,
        shooting: 48,
        passing: 75,
        dribbling: 68,
        defending: 79,
        physical: 83,

        // Stats de arquero (null para jugadores de campo)
        gkDiving: null,
        gkHandling: null,
        gkPositioning: null,
        gkReflexes: null,
        gkKicking: null,

        // Metadata de juego
        rarity: null,
        season: null,
        photo: null
    },

    {
        id: 12,
        schemaVersion: 3,

        // Identidad
        name: "Kevin Zenón",
        shortName: null,
        club: "Boca Juniors",
        clubId: null,
        nationality: null,
        age: null,

        // Posición
        position: "MED",
        secondaryPosition: null,

        // Stats
        overall: 79,
        pace: 84,
        shooting: 61,
        passing: 79,
        dribbling: 86,
        defending: 46,
        physical: 68,

        // Stats de arquero (null para jugadores de campo)
        gkDiving: null,
        gkHandling: null,
        gkPositioning: null,
        gkReflexes: null,
        gkKicking: null,

        // Metadata de juego
        rarity: null,
        season: null,
        photo: null
    },

    {
        id: 13,
        schemaVersion: 3,

        // Identidad
        name: "Giuliano Galoppo",
        shortName: null,
        club: "River Plate",
        clubId: null,
        nationality: null,
        age: null,

        // Posición
        position: "MED",
        secondaryPosition: null,

        // Stats
        overall: 76,
        pace: 64,
        shooting: 58,
        passing: 70,
        dribbling: 65,
        defending: 74,
        physical: 77,

        // Stats de arquero (null para jugadores de campo)
        gkDiving: null,
        gkHandling: null,
        gkPositioning: null,
        gkReflexes: null,
        gkKicking: null,

        // Metadata de juego
        rarity: null,
        season: null,
        photo: null
    },

    // =========================
    // DELANTEROS
    // =========================

    {
        id: 14,
        schemaVersion: 3,

        // Identidad
        name: "Miguel Borja",
        shortName: null,
        club: "River Plate",
        clubId: null,
        nationality: null,
        age: null,

        // Posición
        position: "DEL",
        secondaryPosition: null,

        // Stats
        overall: 83,
        pace: 72,
        shooting: 91,
        passing: 60,
        dribbling: 70,
        defending: 25,
        physical: 88,

        // Stats de arquero (null para jugadores de campo)
        gkDiving: null,
        gkHandling: null,
        gkPositioning: null,
        gkReflexes: null,
        gkKicking: null,

        // Metadata de juego
        rarity: null,
        season: null,
        photo: null
    },

    {
        id: 15,
        schemaVersion: 3,

        // Identidad
        name: "Edinson Cavani",
        shortName: null,
        club: "Boca Juniors",
        clubId: null,
        nationality: null,
        age: null,

        // Posición
        position: "DEL",
        secondaryPosition: null,

        // Stats
        overall: 81,
        pace: 64,
        shooting: 90,
        passing: 64,
        dribbling: 67,
        defending: 35,
        physical: 82,

        // Stats de arquero (null para jugadores de campo)
        gkDiving: null,
        gkHandling: null,
        gkPositioning: null,
        gkReflexes: null,
        gkKicking: null,

        // Metadata de juego
        rarity: null,
        season: null,
        photo: null
    },

    {
        id: 16,
        schemaVersion: 3,

        // Identidad
        name: "Facundo Colidio",
        shortName: null,
        club: "River Plate",
        clubId: null,
        nationality: null,
        age: null,

        // Posición
        position: "DEL",
        secondaryPosition: null,

        // Stats
        overall: 80,
        pace: 86,
        shooting: 77,
        passing: 68,
        dribbling: 83,
        defending: 28,
        physical: 70,

        // Stats de arquero (null para jugadores de campo)
        gkDiving: null,
        gkHandling: null,
        gkPositioning: null,
        gkReflexes: null,
        gkKicking: null,

        // Metadata de juego
        rarity: null,
        season: null,
        photo: null
    },

    {
        id: 17,
        schemaVersion: 3,

        // Identidad
        name: "Exequiel Zeballos",
        shortName: null,
        club: "Boca Juniors",
        clubId: null,
        nationality: null,
        age: null,

        // Posición
        position: "DEL",
        secondaryPosition: null,

        // Stats
        overall: 77,
        pace: 91,
        shooting: 64,
        passing: 69,
        dribbling: 90,
        defending: 20,
        physical: 61,

        // Stats de arquero (null para jugadores de campo)
        gkDiving: null,
        gkHandling: null,
        gkPositioning: null,
        gkReflexes: null,
        gkKicking: null,

        // Metadata de juego
        rarity: null,
        season: null,
        photo: null
    },

    {
        id: 18,
        schemaVersion: 3,

        // Identidad
        name: "Pablo Vegetti",
        shortName: null,
        club: "Platense",
        clubId: null,
        nationality: null,
        age: null,

        // Posición
        position: "DEL",
        secondaryPosition: null,

        // Stats
        overall: 78,
        pace: 55,
        shooting: 88,
        passing: 58,
        dribbling: 59,
        defending: 22,
        physical: 91,

        // Stats de arquero (null para jugadores de campo)
        gkDiving: null,
        gkHandling: null,
        gkPositioning: null,
        gkReflexes: null,
        gkKicking: null,

        // Metadata de juego
        rarity: null,
        season: null,
        photo: null
    }

];
