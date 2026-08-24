// ==========================================
// PERSISTENCIA (localStorage)
// ==========================================
//
// Carga y guardado del estado en localStorage.
//
// NOTA: en esta primera versión (Paso 1 de la Etapa 0) la persistencia se
// comporta exactamente igual que en la V0.3. La función migrar() y el
// schemaVersion (§52) se agregan en un paso posterior de esta misma etapa.

const CLAVE_COLECCION = "futbolFiguritasCollection";
const CLAVE_PAQUETES  = "futbolFiguritasPacks";
const CLAVE_EQUIPO    = "futbolFiguritasTeam";


// Equipo vacío por defecto (4-3-3).
export function equipoVacio() {
    return {
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
}


export function cargarColeccion() {
    return JSON.parse(
        localStorage.getItem(CLAVE_COLECCION)
    ) || [];
}


export function cargarPaquetes() {
    return Number(
        localStorage.getItem(CLAVE_PAQUETES)
    ) || 5;
}


export function cargarEquipo() {
    return JSON.parse(
        localStorage.getItem(CLAVE_EQUIPO)
    ) || equipoVacio();
}


export function guardarPartida(estado) {
    localStorage.setItem(
        CLAVE_COLECCION,
        JSON.stringify(estado.collection)
    );

    localStorage.setItem(
        CLAVE_PAQUETES,
        estado.packs.toString()
    );

    localStorage.setItem(
        CLAVE_EQUIPO,
        JSON.stringify(estado.team)
    );
}
