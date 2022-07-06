import { writable } from "svelte/store";
import type { PlayerInterface } from "../Type/PlayerInterface";
import { Subject } from "rxjs";

export const chatInputFocusStore = writable(false);

const _newChatMessageSubject = new Subject<string>();
export const newChatMessageSubject = _newChatMessageSubject.asObservable();

export enum ChatMessageTypes {
    text = 1,
    me,
    userIncoming,
    userOutcoming,
}

export interface ChatMessage {
    type: ChatMessageTypes;
    date: Date;
    author?: PlayerInterface;
    targets?: PlayerInterface[];
    text?: string[];
}

const players = new Map<number, PlayerInterface>();

function getAuthor(authorId: number): PlayerInterface {
    const author = players.get(authorId);
    if (!author) {
        throw new Error("Could not find data for author " + authorId);
    }
    return author;
}

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
            //TODO use message API to send message in iframe
            //iframeListener.sendUserInputChat(text);

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

                //TODO use message API to send user input chat message
                //iframeListener.sendUserInputChat(text, origin);
                return list;
            });
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
