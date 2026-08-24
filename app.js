// ==========================================
// ESTADO
// ==========================================

let packs =
    Number(
        localStorage.getItem(
            "futbolFiguritasPacks"
        )
    ) || 5;


let collection =
    JSON.parse(
        localStorage.getItem(
            "futbolFiguritasCollection"
        )
    ) || [];


let currentPack = [];

let currentFilter = "all";

let teamPlayerFilter = "all";


// ==========================================
// EQUIPO
// ==========================================

let team =
    JSON.parse(
        localStorage.getItem(
            "futbolFiguritasTeam"
        )
    ) || {

        por1: null,

        def1: null,
        def2: null,
        def3: null,
        def4: null,

        med1: null,
        med2: null,
        med3: null,

        del1: null,
        del2: null,
        del3: null

    };


// ==========================================
// ELEMENTOS
// ==========================================

const packCountElement =
    document.getElementById(
        "packCount"
    );


const collectionCountElement =
    document.getElementById(
        "collectionCount"
    );


const openPackButton =
    document.getElementById(
        "openPackButton"
    );


const packCardsElement =
    document.getElementById(
        "packCards"
    );


const collectionCardsElement =
    document.getElementById(
        "collectionCards"
    );


const closePackButton =
    document.getElementById(
        "closePackButton"
    );


const uniquePlayersElement =
    document.getElementById(
        "uniquePlayers"
    );


const totalFiguritasElement =
    document.getElementById(
        "totalFiguritas"
    );


const availablePlayersElement =
    document.getElementById(
        "availablePlayers"
    );


const teamPlayerCountElement =
    document.getElementById(
        "teamPlayerCount"
    );


const teamRatingElement =
    document.getElementById(
        "teamRating"
    );


const teamAttackElement =
    document.getElementById(
        "teamAttack"
    );


const teamMidfieldElement =
    document.getElementById(
        "teamMidfield"
    );


const teamDefenseElement =
    document.getElementById(
        "teamDefense"
    );


const teamStatusElement =
    document.getElementById(
        "teamStatus"
    );


// ==========================================
// NAVEGACIÓN
// ==========================================

function showScreen(
    screenId
) {

    document
        .querySelectorAll(
            ".screen"
        )
        .forEach(
            screen => {

                screen.classList.remove(
                    "active"
                );

            }
        );


    const screen =
        document.getElementById(
            screenId
        );


    if (screen) {

        screen.classList.add(
            "active"
        );

    }


    document
        .querySelectorAll(
            ".nav-button"
        )
        .forEach(
            button => {

                button.classList.remove(
                    "active"
                );


                if (
                    button.dataset.screen ===
                    screenId
                ) {

                    button.classList.add(
                        "active"
                    );

                }

            }
        );


    if (
        screenId ===
        "collectionScreen"
    ) {

        renderCollection();

    }


    if (
        screenId ===
        "teamScreen"
    ) {

        renderTeam();

    }

}


// ==========================================
// PERSISTENCIA
// ==========================================

function saveGame() {

    localStorage.setItem(

        "futbolFiguritasCollection",

        JSON.stringify(
            collection
        )

    );


    localStorage.setItem(

        "futbolFiguritasPacks",

        packs.toString()

    );


    localStorage.setItem(

        "futbolFiguritasTeam",

        JSON.stringify(
            team
        )

    );

}


// ==========================================
// TOTAL FIGURITAS
// ==========================================

function getTotalCards() {

    return collection.reduce(

        (total, item) =>
            total + item.quantity,

        0

    );

}


// ==========================================
// JUGADORES DEL EQUIPO
// ==========================================

function getPlayersInTeam() {

    return Object.values(team)
        .filter(
            playerId =>
                playerId !== null
        );

}


// ==========================================
// CANTIDAD DE JUGADORES
// ==========================================

function getTeamPlayerCount() {

    return getPlayersInTeam()
        .length;

}


// ==========================================
// ACTUALIZAR HEADER
// ==========================================

function updateHeader() {

    const totalCards =
        getTotalCards();


    collectionCountElement.textContent =
        `${collection.length} jugadores · ${totalCards} figuritas`;


    packCountElement.textContent =
        `${packs} paquetes`;


    uniquePlayersElement.textContent =
        collection.length;


    totalFiguritasElement.textContent =
        totalCards;


    teamPlayerCountElement.textContent =
        getTeamPlayerCount();

}


// ==========================================
// PAQUETES
// ==========================================

function generatePack() {

    if (packs <= 0) {

        alert(
            "No te quedan paquetes."
        );

        return;

    }


    packs--;

    currentPack = [];


    const availablePlayers =
        [...players];


    for (
        let i = 0;
        i < 6;
        i++
    ) {

        const randomIndex =
            Math.floor(
                Math.random() *
                availablePlayers.length
            );


        const selectedPlayer =
            availablePlayers.splice(
                randomIndex,
                1
            )[0];


        currentPack.push(
            selectedPlayer
        );

    }


    addPackToCollection(
        currentPack
    );


    saveGame();

    renderPack();

    updateHeader();

    showScreen(
        "packScreen"
    );

}


// ==========================================
// AGREGAR PAQUETE
// ==========================================

function addPackToCollection(
    pack
) {

    pack.forEach(
        player => {

            const existing =
                collection.find(
                    item =>
                        item.player.id ===
                        player.id
                );


            if (existing) {

                existing.quantity++;

            } else {

                collection.push({

                    player: player,

                    quantity: 1

                });

            }

        }
    );

}


// ==========================================
// RENDER PAQUETE
// ==========================================

function renderPack() {

    packCardsElement.innerHTML =
        "";


    currentPack.forEach(
        player => {

            const card =
                createPlayerCard(
                    player,
                    false
                );


            packCardsElement
                .appendChild(
                    card
                );

        }
    );

}


// ==========================================
// CREAR CARTA
// ==========================================

function createPlayerCard(

    player,

    showQuantity = true,

    quantity = 1

) {

    const card =
        document.createElement(
            "article"
        );


    card.className =
        "player-card";


    const rarity =
        getRarity(
            player.overall
        );


    card.innerHTML = `

        <span class="card-rarity">
            ${rarity}
        </span>


        ${
            showQuantity
                ? `
                    <span class="card-quantity">
                        x${quantity}
                    </span>
                  `
                : ""
        }


        <div class="player-rating">
            ${player.overall}
        </div>


        <div class="player-position">
            ${getPositionName(
                player.position
            )}
        </div>


        <div class="player-avatar">
            ${getPositionIcon(
                player.position
            )}
        </div>


        <div class="player-name">
            ${player.name}
        </div>


        <div class="player-club">
            ${player.club}
        </div>


        <div class="card-stats">

            <div class="stat">
                <strong>${player.pace}</strong>
                <span>RIT</span>
            </div>

            <div class="stat">
                <strong>${player.shooting}</strong>
                <span>TIR</span>
            </div>

            <div class="stat">
                <strong>${player.passing}</strong>
                <span>PAS</span>
            </div>

            <div class="stat">
                <strong>${player.dribbling}</strong>
                <span>REG</span>
            </div>

            <div class="stat">
                <strong>${player.defending}</strong>
                <span>DEF</span>
            </div>

            <div class="stat">
                <strong>${player.physical}</strong>
                <span>FIS</span>
            </div>

        </div>

    `;


    return card;

}


// ==========================================
// RAREZA
// ==========================================

function getRarity(
    overall
) {

    if (overall >= 85) {

        return "ESTRELLA";

    }


    if (overall >= 80) {

        return "DESTACADO";

    }


    if (overall >= 75) {

        return "ORO";

    }


    return "COMÚN";

}


// ==========================================
// POSICIONES
// ==========================================

function getPositionName(
    position
) {

    const positions = {

        POR: "ARQUERO",

        DEF: "DEFENSOR",

        MED: "MEDIOCAMPISTA",

        DEL: "DELANTERO"

    };


    return (
        positions[position] ||
        position
    );

}


function getPositionIcon(
    position
) {

    const icons = {

        POR: "🧤",

        DEF: "🛡️",

        MED: "🧠",

        DEL: "⚽"

    };


    return (
        icons[position] ||
        "🃏"
    );

}


// ==========================================
// COLECCIÓN
// ==========================================

function renderCollection() {

    collectionCardsElement.innerHTML =
        "";


    let filtered =
        [...collection];


    if (
        currentFilter !==
        "all"
    ) {

        filtered =
            filtered.filter(
                item =>
                    item.player.position ===
                    currentFilter
            );

    }


    if (
        filtered.length ===
        0
    ) {

        collectionCardsElement.innerHTML = `

            <div style="
                grid-column: 1 / -1;
                text-align: center;
                padding: 80px 20px;
                color: #91a49a;
            ">

                No tenés jugadores
                en esta categoría.

            </div>

        `;

        return;

    }


    filtered.forEach(
        item => {

            const card =
                createPlayerCard(

                    item.player,

                    true,

                    item.quantity

                );


            collectionCardsElement
                .appendChild(
                    card
                );

        }
    );

}


// ==========================================
// FILTROS COLECCIÓN
// ==========================================

document
    .querySelectorAll(
        ".filter-button"
    )
    .forEach(
        button => {

            button.addEventListener(
                "click",
                () => {

                    document
                        .querySelectorAll(
                            ".filter-button"
                        )
                        .forEach(
                            btn => {

                                btn.classList.remove(
                                    "active"
                                );

                            }
                        );


                    button.classList.add(
                        "active"
                    );


                    currentFilter =
                        button.dataset.filter;


                    renderCollection();

                }
            );

        }
    );


// ==========================================
// FILTROS TEAM BUILDER
// ==========================================

document
    .querySelectorAll(
        ".team-filter-button"
    )
    .forEach(
        button => {

            button.addEventListener(
                "click",
                () => {

                    document
                        .querySelectorAll(
                            ".team-filter-button"
                        )
                        .forEach(
                            btn => {

                                btn.classList.remove(
                                    "active"
                                );

                            }
                        );


                    button.classList.add(
                        "active"
                    );


                    teamPlayerFilter =
                        button.dataset.teamFilter;


                    renderAvailablePlayers();

                }
            );

        }
    );


// ==========================================
// CANTIDAD DISPONIBLE
// ==========================================

function getAvailableQuantity(
    playerId
) {

    const item =
        collection.find(
            item =>
                item.player.id ===
                playerId
        );


    if (!item) {

        return 0;

    }


    const used =
        getPlayersInTeam()
            .filter(
                id =>
                    id === playerId
            )
            .length;


    return (
        item.quantity -
        used
    );

}


// ==========================================
// JUGADOR EN EQUIPO
// ==========================================

function isPlayerInTeam(
    playerId
) {

    return getPlayersInTeam()
        .includes(
            playerId
        );

}


// ==========================================
// AGREGAR JUGADOR
// ==========================================

function addPlayerToTeam(

    playerId,

    position

) {

    const playerItem =
        collection.find(
            item =>
                item.player.id ===
                playerId
        );


    if (!playerItem) {

        return;

    }


    // REGLA:
    // un mismo jugador no puede
    // ocupar dos lugares del XI.

    if (
        isPlayerInTeam(
            playerId
        )
    ) {

        alert(
            "Ese jugador ya está en tu XI."
        );

        return;

    }


    if (
        getAvailableQuantity(
            playerId
        ) <= 0
    ) {

        alert(
            "No tenés una copia disponible."
        );

        return;

    }


    // REGLA:
    // el jugador solamente puede
    // ocupar su posición natural.

    const slot =
        Object.keys(team)
            .find(
                slotName => {

                    const element =
                        document.querySelector(
                            `[data-slot="${slotName}"]`
                        );


                    return (

                        team[slotName] === null &&

                        element.dataset.position ===
                        position

                    );

                }
            );


    if (!slot) {

        alert(
            `No hay posiciones disponibles de ${getPositionName(position)}.`
        );

        return;

    }


    team[slot] =
        playerId;


    saveGame();

    renderTeam();

}


// ==========================================
// QUITAR JUGADOR
// ==========================================

function removePlayerFromTeam(
    slot
) {

    team[slot] =
        null;


    saveGame();

    renderTeam();

}


// ==========================================
// OBTENER JUGADORES POR POSICIÓN
// ==========================================

function getTeamPlayersByPosition(
    position
) {

    return Object.entries(team)
        .map(
            ([slot, playerId]) => {

                if (!playerId) {

                    return null;

                }


                const item =
                    collection.find(
                        entry =>
                            entry.player.id ===
                            playerId
                    );


                if (!item) {

                    return null;

                }


                if (
                    item.player.position !==
                    position
                ) {

                    return null;

                }


                return item.player;

            }
        )
        .filter(
            player =>
                player !== null
        );

}


// ==========================================
// PROMEDIO
// ==========================================

function calculateAverage(
    playersList
) {

    if (
        playersList.length ===
        0
    ) {

        return null;

    }


    const total =
        playersList.reduce(
            (sum, player) =>
                sum + Number(player.overall),
            0
        );


    return (
        total /
        playersList.length
    );

}


// ==========================================
// ATAQUE
// ==========================================
//
// Para los delanteros usamos:
// 35% ritmo
// 35% tiro
// 20% regate
// 10% físico
//
// Esto es una primera versión.
// Después podremos balancearlo.
//

function calculateAttack() {

    const attackers =
        getTeamPlayersByPosition(
            "DEL"
        );


    if (
        attackers.length !== 3
    ) {

        return null;

    }


    const values =
        attackers.map(
            player =>

                (
                    Number(player.pace) * 0.35 +

                    Number(player.shooting) * 0.35 +

                    Number(player.dribbling) * 0.20 +

                    Number(player.physical) * 0.10

                )

        );


    return calculateAverage(
        values.map(
            value => ({
                overall: value
            })
        )
    );

}


// ==========================================
// MEDIOCAMPO
// ==========================================
//
// 40% pase
// 30% regate
// 15% ritmo
// 15% defensa
//

function calculateMidfield() {

    const midfielders =
        getTeamPlayersByPosition(
            "MED"
        );


    if (
        midfielders.length !== 3
    ) {

        return null;

    }


    const values =
        midfielders.map(
            player =>

                (
                    Number(player.passing) * 0.40 +

                    Number(player.dribbling) * 0.30 +

                    Number(player.pace) * 0.15 +

                    Number(player.defending) * 0.15

                )

        );


    return calculateAverage(
        values.map(
            value => ({
                overall: value
            })
        )
    );

}


// ==========================================
// DEFENSA
// ==========================================
//
// Defensores:
// 50% defensa
// 20% físico
// 15% ritmo
// 15% pase
//
// Arquero:
// usamos una combinación de defensa,
// físico y overall como aproximación
// hasta que tengamos stats específicos GK.
//

function calculateDefense() {

    const defenders =
        getTeamPlayersByPosition(
            "DEF"
        );


    const goalkeeper =
        getTeamPlayersByPosition(
            "POR"
        );


    if (
        defenders.length !== 4 ||
        goalkeeper.length !== 1
    ) {

        return null;

    }


    const defenderValues =
        defenders.map(
            player =>

                (
                    Number(player.defending) * 0.50 +

                    Number(player.physical) * 0.20 +

                    Number(player.pace) * 0.15 +

                    Number(player.passing) * 0.15

                )

        );


    const goalkeeperValue =

        (
            Number(goalkeeper[0].overall) * 0.50 +

            Number(goalkeeper[0].defending) * 0.30 +

            Number(goalkeeper[0].physical) * 0.20

        );


    const allValues = [

        ...defenderValues,

        goalkeeperValue

    ];


    return calculateAverage(
        allValues.map(
            value => ({
                overall: value
            })
        )
    );

}


// ==========================================
// VALORACIÓN GENERAL
// ==========================================

function calculateTeamRating() {

    const allPlayers =
        getPlayersInTeam()
            .map(
                playerId => {

                    const item =
                        collection.find(
                            entry =>
                                entry.player.id ===
                                playerId
                        );


                    return item
                        ? item.player
                        : null;

                }
            )
            .filter(
                player =>
                    player !== null
            );


    if (
        allPlayers.length !== 11
    ) {

        return null;

    }


    return calculateAverage(
        allPlayers
    );

}


// ==========================================
// VALIDAR EQUIPO
// ==========================================

function validateTeam() {

    const errors = [];


    const playerCount =
        getTeamPlayerCount();


    if (
        playerCount !== 11
    ) {

        errors.push(
            `Faltan ${11 - playerCount} jugadores.`
        );

    }


    const goalkeeperCount =
        getPlayersBySlotPrefix(
            "por"
        );


    const defenderCount =
        getPlayersBySlotPrefix(
            "def"
        );


    const midfieldCount =
        getPlayersBySlotPrefix(
            "med"
        );


    const attackerCount =
        getPlayersBySlotPrefix(
            "del"
        );


    if (
        goalkeeperCount !== 1
    ) {

        errors.push(
            "Debe haber 1 arquero."
        );

    }


    if (
        defenderCount !== 4
    ) {

        errors.push(
            "Debe haber 4 defensores."
        );

    }


    if (
        midfieldCount !== 3
    ) {

        errors.push(
            "Debe haber 3 mediocampistas."
        );

    }


    if (
        attackerCount !== 3
    ) {

        errors.push(
            "Debe haber 3 delanteros."
        );

    }


    return {

        valid:
            errors.length === 0,

        errors

    };

}


// ==========================================
// CONTAR SLOTS POR PREFIJO
// ==========================================

function getPlayersBySlotPrefix(
    prefix
) {

    return Object.entries(team)
        .filter(
            ([slot, playerId]) =>

                slot.startsWith(prefix) &&
                playerId !== null

        )
        .length;

}


// ==========================================
// RENDER EQUIPO
// ==========================================

function renderTeam() {

    document
        .querySelectorAll(
            ".position-slot"
        )
        .forEach(
            slot => {

                slot.innerHTML =
                    "";

                slot.classList.add(
                    "empty"
                );

            }
        );


    Object.entries(team)
        .forEach(
            ([slotName, playerId]) => {

                if (!playerId) {

                    return;

                }


                const slot =
                    document.querySelector(
                        `[data-slot="${slotName}"]`
                    );


                const playerItem =
                    collection.find(
                        item =>
                            item.player.id ===
                            playerId
                    );


                if (
                    !slot ||
                    !playerItem
                ) {

                    return;

                }


                const player =
                    playerItem.player;


                slot.classList.remove(
                    "empty"
                );


                slot.innerHTML = `

                    <div
                        class="slot-player"
                        title="Click para quitar"
                    >

                        <div class="slot-rating">
                            ${player.overall}
                        </div>


                        <div class="slot-position">
                            ${getPositionName(
                                player.position
                            )}
                        </div>


                        <div class="slot-name">
                            ${player.name}
                        </div>


                        <div class="slot-club">
                            ${player.club}
                        </div>


                        <div class="remove-hint">
                            QUITAR
                        </div>

                    </div>

                `;


                slot
                    .querySelector(
                        ".slot-player"
                    )
                    .addEventListener(
                        "click",
                        () => {

                            removePlayerFromTeam(
                                slotName
                            );

                        }
                    );

            }
        );


    renderAvailablePlayers();

    updateTeamStats();

    updateHeader();

}


// ==========================================
// RENDER JUGADORES DISPONIBLES
// ==========================================

function renderAvailablePlayers() {

    availablePlayersElement.innerHTML =
        "";


    let filteredCollection =
        [...collection];


    if (
        teamPlayerFilter !==
        "all"
    ) {

        filteredCollection =
            filteredCollection.filter(
                item =>
                    item.player.position ===
                    teamPlayerFilter
            );

    }


    filteredCollection.sort(
        (a, b) =>
            b.player.overall -
            a.player.overall
    );


    if (
        filteredCollection.length ===
        0
    ) {

        availablePlayersElement.innerHTML = `

            <div style="
                text-align:center;
                padding:30px 10px;
                color:#91a49a;
                font-size:12px;
            ">

                No tenés jugadores
                de esta posición.

            </div>

        `;

        return;

    }


    filteredCollection.forEach(
        item => {

            const player =
                item.player;


            const available =
                getAvailableQuantity(
                    player.id
                );


            const alreadyInTeam =
                isPlayerInTeam(
                    player.id
                );


            const element =
                document.createElement(
                    "div"
                );


            element.className =
                "available-player";


            if (
                available <= 0 ||
                alreadyInTeam
            ) {

                element.classList.add(
                    "disabled"
                );

            }


            element.innerHTML = `

                <div class="available-player-avatar">
                    ${getPositionIcon(
                        player.position
                    )}
                </div>


                <div class="available-player-info">

                    <div class="available-player-name">
                        ${player.name}
                    </div>


                    <div class="available-player-meta">

                        ${getPositionName(
                            player.position
                        )}

                        ·

                        ${player.club}

                    </div>

                </div>


                <div class="available-player-rating">
                    ${player.overall}
                </div>


                <div class="available-player-quantity">
                    x${available}
                </div>

            `;


            if (
                available > 0 &&
                !alreadyInTeam
            ) {

                element.addEventListener(
                    "click",
                    () => {

                        addPlayerToTeam(

                            player.id,

                            player.position

                        );

                    }
                );

            }


            availablePlayersElement
                .appendChild(
                    element
                );

        }
    );

}


// ==========================================
// ACTUALIZAR ESTADÍSTICAS
// ==========================================

function updateTeamStats() {

    const attack =
        calculateAttack();


    const midfield =
        calculateMidfield();


    const defense =
        calculateDefense();


    const rating =
        calculateTeamRating();


    teamAttackElement.textContent =
        attack === null
            ? "—"
            : attack.toFixed(1);


    teamMidfieldElement.textContent =
        midfield === null
            ? "—"
            : midfield.toFixed(1);


    teamDefenseElement.textContent =
        defense === null
            ? "—"
            : defense.toFixed(1);


    teamRatingElement.textContent =
        rating === null
            ? "—"
            : rating.toFixed(1);


    updateTeamStatus();

}


// ==========================================
// ESTADO DEL EQUIPO
// ==========================================

function updateTeamStatus() {

    const validation =
        validateTeam();


    if (
        validation.valid
    ) {

        teamStatusElement.classList.add(
            "complete"
        );


        teamStatusElement.innerHTML = `

            <span class="status-icon">
                ✓
            </span>

            <div>

                <strong>
                    EQUIPO COMPLETO
                </strong>

                <span>
                    Tu XI cumple todas las reglas
                    y está listo para competir.
                </span>

            </div>

        `;

        return;

    }


    teamStatusElement.classList.remove(
        "complete"
    );


    const missing =
        validation.errors.join(
            " "
        );


    teamStatusElement.innerHTML = `

        <span class="status-icon">
            ⚠
        </span>

        <div>

            <strong>
                EQUIPO INCOMPLETO
            </strong>

            <span>
                ${missing}
            </span>

        </div>

    `;

}


// ==========================================
// ARMAR EQUIPO
// ==========================================

function openTeamBuilder() {

    showScreen(
        "teamScreen"
    );

}


document
    .getElementById(
        "buildTeamButton"
    )
    .addEventListener(
        "click",
        openTeamBuilder
    );


document
    .getElementById(
        "collectionBuildTeamButton"
    )
    .addEventListener(
        "click",
        openTeamBuilder
    );


// ==========================================
// NAVEGACIÓN
// ==========================================

document
    .querySelectorAll(
        ".nav-button"
    )
    .forEach(
        button => {

            button.addEventListener(
                "click",
                () => {

                    showScreen(
                        button.dataset.screen
                    );

                }
            );

        }
    );


// ==========================================
// PAQUETES
// ==========================================

openPackButton
    .addEventListener(
        "click",
        generatePack
    );


closePackButton
    .addEventListener(
        "click",
        () => {

            currentPack = [];

            showScreen(
                "homeScreen"
            );

        }
    );


// ==========================================
// VOLVER
// ==========================================

document
    .getElementById(
        "backFromPack"
    )
    .addEventListener(
        "click",
        () => {

            showScreen(
                "homeScreen"
            );

        }
    );


document
    .getElementById(
        "backFromCollection"
    )
    .addEventListener(
        "click",
        () => {

            showScreen(
                "homeScreen"
            );

        }
    );


document
    .getElementById(
        "backFromTeam"
    )
    .addEventListener(
        "click",
        () => {

            showScreen(
                "homeScreen"
            );

        }
    );


// ==========================================
// INICIO
// ==========================================

updateHeader();

renderTeam();