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
//   {GOLEADOR}  el autor del gol (o el pateador, en un penal)
//   {ARQUERO}   el arquero que ataja (equipo que defiende)
//   {ATACANTE}  un atacante del equipo que ataca
//   {DEFENSOR}  un defensor del equipo que defiende
//   {EQUIPO}    el nombre del equipo que ataca
//   {JUGADOR}   el jugador amonestado/expulsado (tarjetas, Grupo E)

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
    ],

    // Penales (Grupo E, post-Etapa 10). Reusan {GOLEADOR}/{ARQUERO}/{ATACANTE}
    // de arriba: es el mismo evento GOL/ATAJADA, marcado con `esPenal`.
    PENAL_GOL: [
        "¡Penal! Y {GOLEADOR} no perdona: la clavó en el ángulo.",
        "{GOLEADOR} se para ante la pelota... ¡y convierte el penal!",
        "¡Gol de penal de {GOLEADOR}! La mandó a un lado, imposible para el arquero.",
        "Sin nervios: {GOLEADOR} cambió el penal por gol para {EQUIPO}.",
        "¡Lo cobró {GOLEADOR} y no falló! Penal convertido.",
        "{GOLEADOR} engañó al arquero desde los doce pasos. ¡Gol de penal!"
    ],
    PENAL_ATAJADO: [
        "¡Penal atajado! {ARQUERO} le adivinó el palo a {ATACANTE}.",
        "¡{ARQUERO} se la tapó! {ATACANTE} había cobrado el penal.",
        "Increíble: {ARQUERO} contuvo el remate de penal de {ATACANTE}.",
        "{ATACANTE} pateó el penal, pero {ARQUERO} voló y la sacó.",
        "¡Qué atajada la de {ARQUERO}! Le ahogó el grito a {ATACANTE} desde los doce pasos.",
        "{ATACANTE} se la envió al medio y {ARQUERO} no se movió: penal atajado."
    ],

    // Tarjetas (Grupo E, post-Etapa 10).
    TARJETA_AMARILLA: [
        "Tarjeta amarilla para {JUGADOR}.",
        "El árbitro amonesta a {JUGADOR}.",
        "Amarilla para {JUGADOR}: una falta de más.",
        "{JUGADOR} se pierde en el reclamo y se lleva la amarilla.",
        "Le sacan tarjeta amarilla a {JUGADOR} por la dura entrada.",
        "Advertencia para {JUGADOR}: tarjeta amarilla."
    ],
    TARJETA_ROJA_DOBLE: [
        "¡Segunda amarilla para {JUGADOR}! Se va expulsado.",
        "{JUGADOR} ve la segunda amarilla y el árbitro lo manda a las duchas.",
        "¡Doble amarilla y roja para {JUGADOR}! Su equipo se queda con uno menos.",
        "No puede creerlo: {JUGADOR} se va expulsado por doble amonestación.",
        "{JUGADOR} repite la falta y el árbitro no duda: segunda amarilla, afuera.",
        "Roja por acumulación para {JUGADOR}. Quedan con uno menos."
    ],
    TARJETA_ROJA_DIRECTA: [
        "¡Roja directa para {JUGADOR}! Una entrada durísima.",
        "El árbitro no duda: tarjeta roja directa para {JUGADOR}.",
        "¡Expulsado {JUGADOR}! El árbitro le muestra la roja sin dudar.",
        "Falta violenta de {JUGADOR}: roja directa y a las duchas.",
        "{JUGADOR} se va expulsado en una acción muy dura.",
        "Roja directa para {JUGADOR}. Su equipo termina con uno menos."
    ]
};

// Líneas de marco (no cuentan para el mínimo de 6 por evento).
export const INICIO = [
    "¡Comienza el partido entre {USUARIO} y {RIVAL}!",
    "Rueda la pelota: {USUARIO} recibe a {RIVAL}.",
    "Arranca el encuentro. {USUARIO} frente a {RIVAL}."
];

// Marco del entretiempo (post-Etapa 10, mejora pedida por el grupo).
export const ENTRETIEMPO = [
    "El árbitro pita el final del primer tiempo.",
    "Se termina la primera parte. Los equipos se van al descanso.",
    "Fin de la primera etapa."
];

export const SEGUNDO_TIEMPO = [
    "¡Arranca el segundo tiempo!",
    "Vuelven los equipos a la cancha: se reanuda el partido.",
    "Comienza la segunda mitad."
];
