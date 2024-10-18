import type { Translation } from "../i18n-types";
import type { DeepPartial } from "../DeepPartial";

const actionbar: DeepPartial<Translation["actionbar"]> = {
    chat: "Ouvrir / Fermer le chat",
    follow: "Suivre",
    unfollow: "Ne plus suivre",
    lock: "Verrouiller / Déverrouiller la discussion",
    screensharing: "Démarrer / Arrêter le partage d'écran",
    layout: "Changer l'affichage",
    disableLayout: "Non disponible si une seul personne dans le meeting",
    camera: "Activer / Couper la caméra",
    microphone: "Activer / Couper le microphone",
    emoji: "Ouvrir / Fermer les émoticônes",
    disableMegaphone: "Couper le mégaphone",
    menu: "Ouvrir / Fermer le menu",
    calendar: "Ouvrir / Fermer le calendrier",
    todoList: "Ouvrir / Fermer la liste de tâches",
    mapEditor: "Ouvrir / Fermer l'éditeur de carte",
    mapEditorMobileLocked: "L'éditeur de carte est verrouillé en mode mobile",
    mapEditorLocked: "L'éditeur de carte est verrouillé 🔐",
    bo: "Ouvrir le back office",
    subtitle: {
        microphone: "Microphone",
        speaker: "Speaker",
    },
    app: "Ouvrir / Fermer les applications",
    listStatusTitle: {
        enable: "Changer de statut",
        inMeeting: "Bonne réunion 🤓",
        inSilentZone: "Profitez de la zone silencieuse 😁",
    },
    status: {
        ONLINE: "En Ligne",
        BACK_IN_A_MOMENT: "Revient dans un moment",
        DO_NOT_DISTURB: "Ne pas déranger",
        BUSY: "Occupé",
    },
    globalMessage: "Envoyer un message global",
    roomList: "Ouvrir / Fermer la liste des salons",
    appList: "Ouvrir / Fermer la liste des apps",
};

export default actionbar;
