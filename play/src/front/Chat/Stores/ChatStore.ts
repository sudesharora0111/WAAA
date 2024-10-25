import { get, writable } from "svelte/store";
import { ChatMessage as NewChatMessage, ChatRoom } from "../Connection/ChatConnection";
import { chatVisibilityStore } from "../../Stores/ChatStore";
import { matrixSecurity } from "../Connection/Matrix/MatrixSecurity";
import { ENABLE_CHAT, ENABLE_CHAT_DISCONNECTED_LIST, ENABLE_CHAT_ONLINE_LIST } from "../../Enum/EnvironmentVariable";

function createNavChatStore() {
    const defaultValue = ENABLE_CHAT ? "chat" : "users";
    const { subscribe, set } = writable<"chat" | "users">(defaultValue);

    return {
        subscribe,
        switchToChat() {
            if (ENABLE_CHAT) {
                set("chat");
            }
        },
        switchToUserList() {
            if (ENABLE_CHAT_ONLINE_LIST || ENABLE_CHAT_DISCONNECTED_LIST) {
                set("users");
            }
        },
    };
}

export const navChat = createNavChatStore();
//export const navChat = writable<"chat" | "users">("chat");

export const shownRoomListStore = writable<string>("");
export const chatSearchBarValue = writable<string>("");

const createSelectedRoomStore = () => {
    const { subscribe, set } = writable<ChatRoom | undefined>(undefined);

    const customSet = (value: ChatRoom | undefined) => {
        set(value);
        if (value && get(value.isEncrypted) && !get(alreadyAskForInitCryptoConfiguration)) {
            matrixSecurity.openChooseDeviceVerificationMethodModal().catch((error) => {
                console.error(error);
            });
        }
    };

    return {
        subscribe,
        set: customSet,
    };
};

export const selectedRoomStore = createSelectedRoomStore();

export const selectedChatMessageToReply = writable<NewChatMessage | null>(null);

export const selectedChatMessageToEdit = writable<NewChatMessage | null>(null);

export const joignableRoom = writable<{ id: string; name: string | undefined }[]>([]);

export const isAChatRoomIsVisible = () => {
    return get(selectedRoomStore) && get(navChat) === "chat" && get(chatVisibilityStore);
};

export const alreadyAskForInitCryptoConfiguration = writable(false);

export const isChatIdSentToPusher = writable(false);
