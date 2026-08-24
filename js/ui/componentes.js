// ==========================================
// COMPONENTES DE UI COMPARTIDOS
// ==========================================

// ==========================================
// RAREZA
// ==========================================
//
// ⚠️ PROVISIONAL. Umbrales absolutos de OVR heredados de la V0.3.
// La rareza real se calcula por percentiles sobre el pool (§11) y es tarea de
// la Etapa 1, junto con el dataset real. Hasta entonces esto queda como está.

export function getRarity(overall) {
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
// NOMBRE DE POSICIÓN
// ==========================================

export function getPositionName(position) {
    const positions = {
        POR: "ARQUERO",
        DEF: "DEFENSOR",
        MED: "MEDIOCAMPISTA",
        DEL: "DELANTERO"
    };

    return positions[position] || position;
}


// ==========================================
// ÍCONO DE POSICIÓN
// ==========================================

export function getPositionIcon(position) {
    const icons = {
        POR: "🧤",
        DEF: "🛡️",
        MED: "🧠",
        DEL: "⚽"
    };

    return icons[position] || "🃏";
}


// ==========================================
// CREAR CARTA DE JUGADOR
// ==========================================

export function createPlayerCard(player, showQuantity = true, quantity = 1) {
    const card = document.createElement("article");

    card.className = "player-card";

    const rarity = getRarity(player.overall);

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
            ${getPositionName(player.position)}
        </div>


        <div class="player-avatar">
            ${getPositionIcon(player.position)}
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
