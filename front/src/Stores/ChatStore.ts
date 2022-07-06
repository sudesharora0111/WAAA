import { writable } from "svelte/store";
import { playersStore } from "./PlayersStore";
import type { PlayerInterface } from "../Phaser/Game/PlayerInterface";
import { iframeListener } from "../Api/IframeListener";
import { Subject } from "rxjs";

export const chatVisibilityStore = writable(false);
export const chatInputFocusStore = writable(false);

const _newChatMessageSubject = new Subject<string>();
export const newChatMessageSubject = _newChatMessageSubject.asObservable();

const _newChatMessageWritingStatusSubject = new Subject<number>();
export const newChatMessageWritingStatusSubject = _newChatMessageWritingStatusSubject.asObservable();

export enum ChatMessageTypes {
    text = 1,
    me,
    userIncoming,
    userOutcoming,
    userWriting,
    userStopWriting,
}

export interface ChatMessage {
    type: ChatMessageTypes;
    date: Date;
    author?: PlayerInterface;
    targets?: PlayerInterface[];
    text?: string[];
}

export interface WritingMessage {
    type: ChatMessageTypes;
    author: PlayerInterface;
}

function getAuthor(authorId: number): PlayerInterface {
    const author = playersStore.getPlayerById(authorId);
    if (!author) {
        throw new Error("Could not find data for author " + authorId);
    }
    return author;
}

function createWritingStatusMessageStore() {
    const { subscribe, update } = writable<WritingMessage[]>([]);
    return {
        subscribe,
        addWritingStatus(authorId: number, status: number) {
            update((list) => {
                if (status === ChatMessageTypes.userWriting) {
                    const index = list.findIndex((message) => message.author.userId === authorId);
                    if (index !== -1) {
                        return list;
                    }
                    list.push({
                        type: ChatMessageTypes.text,
                        author: getAuthor(authorId),
                    });
                } else if (status === ChatMessageTypes.userStopWriting) {
                    const index = list.findIndex((message) => message.author.userId === authorId);
                    if (index === -1) {
                        return list;
                    }
                    list.splice(index, 1);
                }
                return list;
            });
        },
        sendWritingStatus(text: string | undefined | null) {
            if (text != undefined && text !== "") {
                _newChatMessageWritingStatusSubject.next(ChatMessageTypes.userWriting);
            } else {
                _newChatMessageWritingStatusSubject.next(ChatMessageTypes.userStopWriting);
            }
        },
    };
}
export const writingStatusMessageStore = createWritingStatusMessageStore();

function createChatMessagesStore() {
    const { subscribe, update } = writable<ChatMessage[]>([]);

    return {
        subscribe,
        addIncomingUser(authorId: number) {
            update((list) => {
                const lastMessage = list[list.length - 1];
                if (lastMessage && lastMessage.type === ChatMessageTypes.userIncoming && lastMessage.targets) {
                    lastMessage.targets.push(getAuthor(authorId));
                } else {
                    list.push({
                        type: ChatMessageTypes.userIncoming,
                        targets: [getAuthor(authorId)],
                        date: new Date(),
                    });
                }
                return list;
            });
        },
        addOutcomingUser(authorId: number) {
            update((list) => {
                const lastMessage = list[list.length - 1];
                if (lastMessage && lastMessage.type === ChatMessageTypes.userOutcoming && lastMessage.targets) {
                    lastMessage.targets.push(getAuthor(authorId));
                } else {
                    list.push({
                        type: ChatMessageTypes.userOutcoming,
                        targets: [getAuthor(authorId)],
                        date: new Date(),
                    });
                }
                return list;
            });
        },
        addPersonnalMessage(text: string) {
            iframeListener.sendUserInputChat(text);

            _newChatMessageSubject.next(text);
            update((list) => {
                const lastMessage = list[list.length - 1];
                if (lastMessage && lastMessage.type === ChatMessageTypes.me && lastMessage.text) {
                    lastMessage.text.push(text);
                } else {
                    list.push({
                        type: ChatMessageTypes.me,
                        text: [text],
                        date: new Date(),
                    });
                }

                return list;
            });
        },
        /**
         * @param origin The iframe that originated this message (if triggered from the Scripting API), or undefined otherwise.
         */
        addExternalMessage(authorId: number, text: string, origin?: Window) {
            update((list) => {
                const lastMessage = list[list.length - 1];
                if (
                    lastMessage &&
                    lastMessage.type === ChatMessageTypes.text &&
                    lastMessage.text &&
                    lastMessage?.author?.userId === authorId
                ) {
                    lastMessage.text.push(text);
                } else {
                    list.push({
                        type: ChatMessageTypes.text,
                        text: [text],
                        author: getAuthor(authorId),
                        date: new Date(),
                    });
                }

                iframeListener.sendUserInputChat(text, origin);
                return list;
            });
            chatVisibilityStore.set(true);
        },
    };
}
export const chatMessagesStore = createChatMessagesStore();

function createChatSubMenuVisibilityStore() {
    const { subscribe, update } = writable<string>("");

    return {
        subscribe,
        openSubMenu(playerName: string, index: number) {
            const id = playerName + index;
            update((oldValue) => {
                return oldValue === id ? "" : id;
            });
        },
    };
}

export const chatSubMenuVisibilityStore = createChatSubMenuVisibilityStore();
