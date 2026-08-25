// ==========================================
// PLANTILLAS DE RELATO (§28)
// ==========================================
//
// El relato se arma a partir de los eventos del partido, rellenando estas
// plantillas con los nombres reales del XI. Cada tipo de evento tiene al menos
// 6 plantillas distintas (§28): con menos, se vuelve repetitivo al tercer
// partido.
//
// Placeholders:
//   {GOLEADOR}  el autor del gol
//   {ARQUERO}   el arquero que ataja (equipo que defiende)
//   {ATACANTE}  un atacante del equipo que ataca
//   {DEFENSOR}  un defensor del equipo que defiende
//   {EQUIPO}    el nombre del equipo que ataca

export const PLANTILLAS = {

    GOL: [
        "¡GOOOOOL de {GOLEADOR}! Lo grita {EQUIPO}.",
        "¡La clavó {GOLEADOR}! Definición perfecta y festeja {EQUIPO}.",
        "¡Apareció {GOLEADOR} dentro del área y no perdonó!",
        "¡Golazo de {GOLEADOR}, la mandó al ángulo!",
        "{GOLEADOR} empujó la pelota al fondo. ¡Gol de {EQUIPO}!",
        "¡{GOLEADOR} de cabeza! Imposible para el arquero.",
        "¡Definió cruzado {GOLEADOR} y es gol de {EQUIPO}!",
        "¡Qué frialdad la de {GOLEADOR} para poner el gol!"
    ],

    ATAJADA: [
        "¡Enorme atajada de {ARQUERO}! Le tapó el remate a {ATACANTE}.",
        "¡Voló {ARQUERO} y sacó el zurdazo de {ATACANTE}!",
        "Remató {ATACANTE}, pero {ARQUERO} respondió de manera notable.",
        "¡Qué manos las de {ARQUERO}! Le ahogó el grito a {ATACANTE}.",
        "{ATACANTE} probó de lejos y {ARQUERO} contuvo sin dar rebote.",
        "¡Mano firme de {ARQUERO} ante la llegada de {ATACANTE}!",
        "Se estiró {ARQUERO} y le negó el gol a {ATACANTE}."
    ],

    ATAQUE_CORTADO: [
        "{DEFENSOR} le robó la pelota a {ATACANTE} y cortó el ataque.",
        "Buena marca de {DEFENSOR}: {ATACANTE} no pudo avanzar.",
        "{ATACANTE} intentó filtrarse, pero apareció {DEFENSOR}.",
        "Se anticipó {DEFENSOR} y ahogó la jugada de {ATACANTE}.",
        "{DEFENSOR} rechazó firme antes de que {ATACANTE} rematara.",
        "Recuperó {DEFENSOR}: se le acabó el ataque a {ATACANTE}.",
        "Cerró bien {DEFENSOR} y le quitó el balón a {ATACANTE}."
    ]
};

// Líneas de marco (no cuentan para el mínimo de 6 por evento).
export const INICIO = [
    "¡Comienza el partido entre {USUARIO} y {RIVAL}!",
    "Rueda la pelota: {USUARIO} recibe a {RIVAL}.",
    "Arranca el encuentro. {USUARIO} frente a {RIVAL}."
];
