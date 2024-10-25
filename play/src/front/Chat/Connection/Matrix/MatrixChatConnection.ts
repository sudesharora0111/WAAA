import { derived, get, Readable, Unsubscriber, writable, Writable } from "svelte/store";
import * as Sentry from "@sentry/svelte";
import { MapStore } from "@workadventure/store-utils";
import { KnownMembership } from "matrix-js-sdk/lib/@types/membership";
import { slugify } from "@workadventure/shared-utils/src/Jitsi/slugify";
import { AvailabilityStatus } from "@workadventure/messages";
import { ClientEvent, EmittedEvents, MatrixClient, PendingEventOrdering } from "matrix-js-sdk/src/client";
import { Room, RoomEvent } from "matrix-js-sdk/src/models/room";
import { MatrixEvent } from "matrix-js-sdk/src/models/event";
import { User, UserEvent } from "matrix-js-sdk/src/models/user";
import { SetPresence, SyncState } from "matrix-js-sdk/src/sync";
import { IPushRule, PushRuleActionName } from "matrix-js-sdk/src/@types/PushRules";
import { Direction } from "matrix-js-sdk/src/models/event-timeline";
import { MatrixError } from "matrix-js-sdk/src/http-api";
import { ICreateRoomOpts, ICreateRoomStateEvent, IRoomDirectoryOptions } from "matrix-js-sdk/src/@types/requests";
import { Visibility } from "matrix-js-sdk/src/@types/partials";
import { EventType } from "matrix-js-sdk/src/@types/event";
import { ChatConnectionInterface, ChatRoom, ChatUser, ConnectionStatus, CreateRoomOptions } from "../ChatConnection";
import { selectedRoom } from "../../Stores/ChatStore";
import LL from "../../../../i18n/i18n-svelte";
import { RequestedStatus } from "../../../Rules/StatusRules/statusRules";
import { MatrixChatRoom } from "./MatrixChatRoom";
import { MatrixSecurity, matrixSecurity as defaultMatrixSecurity } from "./MatrixSecurity";
import { MatrixRoomFolder } from "./MatrixRoomFolder";
import { chatUserFactory, mapMatrixPresenceToAvailabilityStatus } from "./MatrixChatUser";

const CLIENT_NOT_INITIALIZED_ERROR_MSG = "MatrixClient not yet initialized";
export const defaultWoka =
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABcAAAAdCAYAAABBsffGAAAB/ElEQVRIia1WMW7CQBC8EAoqFy74AD1FqNzkAUi09DROwwN4Ag+gMQ09dcQXXNHQIucBPAJFc2Iue+dd40QZycLc7c7N7d7u+cU9wXw+ryyL0+n00eU9tCZIOp1O/f/ZbBbmzuczX6uuRVTlIAYpCSeTScumaZqw0OVyURd47SIGaZ7n6s4wjmc0Grn7/e6yLFtcr9dPaaOGhcTEeDxu2dxut2hXUJ9ioKmW0IidMg6/NPmD1EmqtojTBWAvE26SW8r+YhfIu87zbyB5BiRerVYtikXxXuLRuK058HABMyz/AX8UHwXgV0NRaEXzDKzaw+EQCioo1yrsLfvyjwZrTvK0yp/xh/o+JwbFhFYgFRNqzGEIB1ZhH2INkXJZoShn2WNSgJRNS/qoYSHxer1+qkhChnC320ULRI1LEsNhv99HISBkLmhP/7L8OfqhiKC6SzEJtSTLHMkGFhK6XC79L89rmtC6rv0YfjXV9COPDwtVQxEc2ZflIu7R+WADQrkA7eCH5BdFwQRXQ8bKxXejeWFoYZGCQM7Yh7BAkcw0DEnEEPHhbjBPQfCDvwzlEINlWZq3OAiOx2O0KwAKU8gehXfzu2Wz2VQMTXqCeLZZSNvtVv20MFsu48gQpDvjuHYxE+ZHESBPSJ/x3sqBvhe0hc5vRXkfypBY4xGcc9+lcFxartG6LgAAAABJRU5ErkJggg==";
export const defaultColor = "#626262";

export enum INTERACTIVE_AUTH_PHASE {
    PRE_AUTH = 1,
    POST_AUTH,
}
export class MatrixChatConnection implements ChatConnectionInterface {
    private readonly roomList: MapStore<string, MatrixChatRoom>;
    private client: MatrixClient | undefined;
    private handleRoom: (room: Room) => void;
    private handleDeleteRoom: (roomId: string) => void;
    private handleMyMembership: (room: Room, membership: string, prevMembership: string | undefined) => void;
    private handleRoomStateEvent: (event: MatrixEvent) => void;
    private handleName: (room: Room) => void;
    private handleAccountDataEvent: (event: MatrixEvent) => void;
    private handleUserPresence: (event: MatrixEvent | undefined, user: User) => void;
    private statusUnsubscriber: Unsubscriber | undefined;
    private isClientReady = false;
    private usersStatus: MapStore<string, AvailabilityStatus>;
    private userIdsNeedingPresenceUpdate = new Set();
    connectionStatus: Writable<ConnectionStatus>;
    directRooms: Readable<MatrixChatRoom[]>;
    invitations: Readable<MatrixChatRoom[]>;
    rooms: Readable<MatrixChatRoom[]>;
    isEncryptionRequiredAndNotSet: Writable<boolean>;
    isGuest: Writable<boolean> = writable(false);
    hasUnreadMessages: Readable<boolean>;
    roomCreationInProgress: Writable<boolean> = writable(false);
    roomFolders: MapStore<MatrixRoomFolder["id"], MatrixRoomFolder> = new MapStore<
        MatrixRoomFolder["id"],
        MatrixRoomFolder
    >();
    directRoomsUsers: Readable<ChatUser[]>;
    clientPromise: Promise<MatrixClient>;
    constructor(
        clientPromise: Promise<MatrixClient>,
        private statusStore: Readable<
            | AvailabilityStatus.ONLINE
            | AvailabilityStatus.SILENT
            | AvailabilityStatus.AWAY
            | AvailabilityStatus.JITSI
            | AvailabilityStatus.BBB
            | AvailabilityStatus.DENY_PROXIMITY_MEETING
            | AvailabilityStatus.SPEAKER
            | RequestedStatus
        >,
        private matrixSecurity: MatrixSecurity = defaultMatrixSecurity
    ) {
        this.connectionStatus = writable("CONNECTING");
        this.roomList = new AutoDestroyingMapStore<string, MatrixChatRoom>();

        this.clientPromise = clientPromise;
        this.directRooms = derived(this.roomList, (roomList) => {
            return Array.from(roomList.values()).filter(
                (room) => room.myMembership === KnownMembership.Join && room.type === "direct"
            );
        });

        this.directRoomsUsers = derived(
            [this.directRooms, this.statusStore],
            ([directRooms, statusStore]) => {
                const myUserID = this.client?.getSafeUserId();
                const client = this.client;

                if (!client) {
                    return [];
                }

                return directRooms.reduce((acc, currentRoom) => {
                    currentRoom.members.forEach((member) => {
                        if (member.id !== myUserID) {
                            const user = this.client?.getUser(member.id);
                            if (user) {
                                acc.push(chatUserFactory(user, client));
                                this.userIdsNeedingPresenceUpdate.add(user.userId);
                            }
                        }
                    });
                    return acc;
                }, [] as ChatUser[]);
            },
            []
        );

        this.invitations = derived(this.roomList, (roomList) => {
            return Array.from(roomList.values()).filter((room) => room.myMembership === KnownMembership.Invite);
        });

        this.rooms = derived(this.roomList, (roomList) => {
            return Array.from(roomList.values()).filter(
                (room) => room.myMembership === KnownMembership.Join && room.type === "multiple"
            );
        });

        this.hasUnreadMessages = derived(
            this.roomList,
            ($roomList, set) => {
                // Create a listener for each `hasUnreadMessages` store
                const unsubscribes = Array.from($roomList.values()).map((room) =>
                    room.hasUnreadMessages.subscribe(() => {
                        set(Array.from($roomList.values()).some((someRoom) => get(someRoom.hasUnreadMessages)));
                    })
                );

                // Cleanup function
                return () => unsubscribes.forEach((unsub) => unsub());
            },
            false
        );

        this.usersStatus = new MapStore<string, AvailabilityStatus>();
        this.isEncryptionRequiredAndNotSet = this.matrixSecurity.isEncryptionRequiredAndNotSet;

        this.handleRoom = this.onClientEventRoom.bind(this);
        this.handleDeleteRoom = this.onClientEventDeleteRoom.bind(this);
        this.handleMyMembership = this.onRoomEventMembership.bind(this);
        this.handleRoomStateEvent = this.onRoomStateEvent.bind(this);
        this.handleName = this.onRoomNameEvent.bind(this);
        this.handleAccountDataEvent = this.onAccountDataEvent.bind(this);
        this.handleUserPresence = this.onUserPresenceEvent.bind(this);

        this.statusUnsubscriber = this.statusStore.subscribe((status: AvailabilityStatus) => {
            this.setPresence(status);
        });
    }

    async init(): Promise<void> {
        try {
            this.client = await this.clientPromise;
            this.matrixSecurity.updateMatrixClientStore(this.client);
            await this.startMatrixClient();
            this.isGuest.set(this.client.isGuest());
        } catch (error) {
            this.connectionStatus.set("OFFLINE");
            console.error(error);
            Sentry.captureMessage("Failed to init Matrix client");
        }
    }

    private setPresence(status: AvailabilityStatus): void {
        let matrixStatus: SetPresence;
        if (status === AvailabilityStatus.ONLINE) {
            matrixStatus = SetPresence.Online;
        } else {
            matrixStatus = SetPresence.Unavailable;
        }
        this.client?.setSyncPresence(matrixStatus).catch((error) => {
            console.error("Failed to send presence", error);
            Sentry.captureMessage(`Failed to send presence to synapse server : ${error}`);
        });
    }

    private onUserPresenceEvent(event: MatrixEvent | undefined, user: User): void {
        const userStatus = get(this.usersStatus).get(user.userId);
        const newStatus = mapMatrixPresenceToAvailabilityStatus(user.presence);
        if (userStatus && newStatus !== userStatus && this.userIdsNeedingPresenceUpdate.has(user.userId)) {
            get(this.usersStatus).set(user.userId, newStatus);
        }
    }

    async startMatrixClient() {
        if (!this.client) return;
        this.client.on(ClientEvent.Sync, (state) => {
            if (!this.client) return;
            switch (state) {
                case SyncState.Prepared:
                    this.connectionStatus.set("ONLINE");
                    this.isClientReady = true;
                    break;
                case SyncState.Error:
                    this.connectionStatus.set("ON_ERROR");
                    break;
                case SyncState.Reconnecting:
                    this.connectionStatus.set("CONNECTING");
                    break;
                case SyncState.Stopped:
                    this.connectionStatus.set("OFFLINE");
                    break;
                case SyncState.Syncing:
                    if (get(this.connectionStatus) !== "ONLINE" && this.isClientReady) {
                        this.connectionStatus.set("ONLINE");
                    }
                    break;
            }
        });

        this.client.on(ClientEvent.Room, this.handleRoom);
        this.client.on(ClientEvent.DeleteRoom, this.handleDeleteRoom);
        this.client.on(RoomEvent.MyMembership, this.handleMyMembership);
        this.client.on("RoomState.events" as EmittedEvents, this.handleRoomStateEvent);
        this.client.on(RoomEvent.Name, this.handleName);
        this.client.on(ClientEvent.AccountData, this.handleAccountDataEvent);
        this.client.on(UserEvent.Presence, this.handleUserPresence);

        await this.client.store.startup();

        try {
            await this.client.initRustCrypto();
        } catch {
            await this.client.clearStores();
            await this.client.initRustCrypto();
        }

        await this.client.startClient({
            threadSupport: false,
            //Detached to prevent using listener on localIdReplaced for each event
            pendingEventOrdering: PendingEventOrdering.Detached,
        });

        await this.waitInitialSync();
    }

    private waitInitialSync(timeout = 10_000, interval = 3500): Promise<void> {
        return new Promise((resolve, reject) => {
            const startTime = Date.now();
            const checkSync = () => {
                if (this.client?.isInitialSyncComplete()) {
                    resolve();
                } else {
                    if (Date.now() - startTime >= timeout) {
                        reject(new Error("Failed to wait initial sync"));
                    } else {
                        setTimeout(checkSync, interval);
                    }
                }
            };
            checkSync();
        });
    }

    private getParentRoomID(room: Room): string[] {
        return (room.getLiveTimeline().getState(Direction.Forward)?.getStateEvents("m.space.parent") || []).reduce(
            (acc, currentMatrixEvent) => {
                const parentID = currentMatrixEvent.getStateKey();
                if (parentID) acc.push(parentID);
                return acc;
            },
            [] as string[]
        );
    }

    private onAccountDataEvent(event: MatrixEvent) {
        if (event.getType() === "m.push_rules") {
            const content = event.getContent();

            content.global.override.forEach((rule: IPushRule) => {
                const room = this.roomList.get(rule.rule_id);
                if (!room) return;
                if (rule.actions.includes(PushRuleActionName.DontNotify)) {
                    room.setNotificationSilent(true);
                }
            });

            Array.from(this.roomList.values())
                .filter((room) => {
                    return !content.global.override.some(
                        (rule: IPushRule) =>
                            rule.rule_id === room.id && rule.actions.includes(PushRuleActionName.DontNotify)
                    );
                })
                .forEach((room) => {
                    room.setNotificationSilent(false);
                });
        }
    }

    private onRoomNameEvent(room: Room): void {
        const { roomId, name } = room;
        const roomInConnection = this.findRoomOrFolder(roomId);

        if (roomInConnection) {
            roomInConnection.name.set(name);
            return;
        }

        this.manageRoomOrFolder(room);
    }
    private onRoomStateEvent(event: MatrixEvent): void {
        if (!this.client) return;
        const eventType = event.getType();

        if (eventType !== "m.space.child") return;

        const roomID = event.getStateKey();
        if (!roomID) return;

        const room = this.client?.getRoom(roomID);
        if (!room) return;

        this.roomList.delete(roomID);
        this.roomFolders.delete(roomID);

        const parentID = event.getRoomId();
        if (!parentID) return;

        const parentRoom = this.client.getRoom(parentID);
        if (!parentRoom) return;

        this.moveRoomToParentFolder(room, parentID);
    }

    private onClientEventRoom(room: Room) {
        this.manageRoomOrFolder(room);
    }
    private moveRoomToParentFolder(room: Room, parentID: string): void {
        const isSpaceRoom = room.isSpaceRoom();
        for (const [, folder] of this.roomFolders) {
            if (folder.id === parentID) {
                if (isSpaceRoom) {
                    folder.folders.set(room.roomId, new MatrixRoomFolder(room));
                } else {
                    folder.rooms.set(room.roomId, new MatrixChatRoom(room));
                }
                break;
            }

            const node = folder.getNode(parentID);
            if (node && node instanceof MatrixRoomFolder) {
                if (isSpaceRoom) {
                    node.folders.set(room.roomId, new MatrixRoomFolder(room));
                } else {
                    node.rooms.set(room.roomId, new MatrixChatRoom(room));
                }
                break;
            }
        }
    }
    private manageRoomOrFolder(room: Room): void {
        const { roomId } = room;

        if (this.findRoomOrFolder(roomId)) return;

        if (!this.isUserMemberOrInvited(room)) return;

        const parentRoomID = this.getFirstParentRoomID(room);

        if (parentRoomID) {
            const isAdded = this.tryAddRoomToParentFolder(room, parentRoomID);

            if (!isAdded && !room.isSpaceRoom()) {
                this.createAndAddNewRootRoom(room);
            }
        } else {
            this.handleOrphanRoom(room);
        }
    }
    private isUserMemberOrInvited(room: Room): boolean {
        const membershipStatus = room.getMyMembership();

        if (membershipStatus === KnownMembership.Invite || membershipStatus === KnownMembership.Join) {
            return true;
        }

        return false;
    }
    private getFirstParentRoomID(room: Room): string | undefined {
        const parentRoomsIDs = this.getParentRoomID(room);
        return parentRoomsIDs.length > 0 ? parentRoomsIDs[0] : undefined;
    }

    private tryAddRoomToParentFolder(room: Room, parentRoomID: string): boolean {
        const isSpaceRoom = room.isSpaceRoom();
        for (const [, folder] of this.roomFolders) {
            const parentFolder = folder.id === parentRoomID ? folder : folder.getNode(parentRoomID);
            if (parentFolder && parentFolder instanceof MatrixRoomFolder) {
                if (isSpaceRoom) {
                    this.roomFolders.delete(room.roomId);
                } else {
                    parentFolder.rooms.set(room.roomId, new MatrixChatRoom(room));
                }
                return true;
            }
        }

        return false;
    }
    private handleOrphanRoom(room: Room): void {
        if (room.isSpaceRoom()) {
            this.createAndAddNewRootFolder(room);
        } else {
            this.createAndAddNewRootRoom(room);
        }
    }
    private findRoomOrFolder(roomId: string): MatrixRoomFolder | MatrixChatRoom | undefined {
        const roomInRoomList = this.roomList.get(roomId);
        if (roomInRoomList) {
            return roomInRoomList;
        }

        for (const [, folder] of this.roomFolders) {
            const roomOrFolder = folder.id === roomId ? folder : folder.getNode(roomId);
            if (roomOrFolder) {
                return roomOrFolder;
            }
        }
        return undefined;
    }
    private createAndAddNewRootFolder(room: Room): void {
        const newFolder = new MatrixRoomFolder(room);
        this.roomFolders.set(room.roomId, newFolder);

        newFolder
            .getRoomsIdInNode()
            .then((roomIDs) => {
                roomIDs.forEach((roomID) => {
                    this.roomList.delete(roomID);
                });
            })
            .catch(() => {
                console.error("Failed to get child room IDs");
                Sentry.captureMessage("Failed to get child room IDs");
            });
    }
    private createAndAddNewRootRoom(room: Room): MatrixChatRoom {
        const newRoom = new MatrixChatRoom(room);
        this.roomList.set(newRoom.id, newRoom);
        if (get(selectedRoom)?.id === newRoom.id) {
            selectedRoom.set(newRoom);
        }
        return newRoom;
    }
    private onClientEventDeleteRoom(roomId: string) {
        this.deleteRoom(roomId);
    }
    private deleteRoom(roomId: string) {
        const isRootRoom = this.roomList.delete(roomId);
        if (isRootRoom) {
            return;
        }
        const isRootFolder = this.roomFolders.has(roomId);

        if (isRootFolder) {
            return;
        }

        this.roomFolders.forEach((folder) => {
            folder.deleteNode(roomId);
        });

        const currentRoom = get(selectedRoom)?.id;
        if (currentRoom && currentRoom === roomId) selectedRoom.set(undefined);
    }
    private onRoomEventMembership(room: Room, membership: string, prevMembership: string | undefined) {
        const { roomId } = room;
        const existingMatrixChatRoom = this.roomList.has(roomId) || this.roomFolders.has(roomId);

        if (membership !== prevMembership && existingMatrixChatRoom) {
            if (membership === KnownMembership.Join) {
                this.roomList.delete(roomId);
                this.manageRoomOrFolder(room);
                return;
            }

            if (membership === KnownMembership.Invite) {
                this.createAndAddNewRootRoom(room);
                return;
            }
        }

        if (membership === KnownMembership.Leave || membership === KnownMembership.Ban) {
            this.deleteRoom(roomId);
            return;
        }
    }
    //TODO createOptions only on matrix size
    async createRoom(roomOptions?: CreateRoomOptions): Promise<{
        room_id: string;
    }> {
        if (roomOptions === undefined) {
            return Promise.reject(new Error("CreateRoomOptions is empty"));
        }

        if (!this.client) {
            return Promise.reject(new Error(CLIENT_NOT_INITIALIZED_ERROR_MSG));
        }

        try {
            this.roomCreationInProgress.set(true);
            return await this.client.createRoom(this.mapCreateRoomOptionsToMatrixCreateRoomOptions(roomOptions));
        } catch (error) {
            throw this.handleMatrixError(error);
        } finally {
            this.roomCreationInProgress.set(false);
        }
    }

    private async waitForNextSync() {
        await new Promise<void>((resolve, reject) => {
            const resolveIfIsASyncingEvent = (state: SyncState) => {
                if (state === SyncState.Syncing) {
                    if (timer) clearTimeout(timer);
                    if (!this.client) {
                        reject(CLIENT_NOT_INITIALIZED_ERROR_MSG);
                        return;
                    }
                    this.client.off(ClientEvent.Sync, resolveIfIsASyncingEvent);
                    resolve();
                }
            };

            const timer = setTimeout(() => {
                if (!this.client) {
                    reject(CLIENT_NOT_INITIALIZED_ERROR_MSG);
                    return;
                }
                this.client.off(ClientEvent.Sync, resolveIfIsASyncingEvent);
                reject(new Error("waitForSync event timeout"));
            }, 30000);

            this.client?.on(ClientEvent.Sync, resolveIfIsASyncingEvent);
        });
    }

    async createFolder(roomOptions?: CreateRoomOptions): Promise<{ room_id: string }> {
        if (roomOptions === undefined) {
            return Promise.reject(new Error("CreateRoomOptions is empty"));
        }

        try {
            const result = await this.client?.createRoom(
                this.mapCreateRoomOptionsToMatrixCreateFolderOptions(roomOptions)
            );

            await this.waitForNextSync();

            if (roomOptions.parentSpaceID && result) {
                try {
                    await this.addRoomToSpace(roomOptions.parentSpaceID, result.room_id);

                    await this.waitForNextSync();

                    return result;
                } catch {
                    this.roomFolders.delete(result.room_id);
                    return Promise.reject(new Error(get(LL).chat.addRoomToFolderError()));
                }
            }

            if (!result) {
                return Promise.reject(new Error(get(LL).chat.addRoomToFolderError()));
            }

            return result;
        } catch (error) {
            throw this.handleMatrixError(error);
        }
    }

    private handleMatrixError(error: unknown) {
        if (error instanceof MatrixError) {
            error.data.error;
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            //@ts-ignore
            return new Error(error.data.error, { cause: error });
        }
        return error;
    }
    private mapCreateRoomOptionsToMatrixCreateRoomOptions(roomOptions: CreateRoomOptions): ICreateRoomOpts {
        const roomName = roomOptions.name;
        if (roomName === undefined) {
            throw new Error("Room name is undefined");
        }

        return {
            name: roomName.trim(),
            visibility: roomOptions.visibility as Visibility | undefined,
            room_alias_name: slugify(roomName),
            invite: roomOptions.invite?.map((invitation) => invitation.value) ?? [],
            is_direct: roomOptions.is_direct,
            initial_state: this.computeInitialState(roomOptions),
        };
    }

    private mapCreateRoomOptionsToMatrixCreateFolderOptions(roomOptions: CreateRoomOptions): ICreateRoomOpts {
        const roomName = roomOptions.name;
        if (roomName === undefined) {
            throw new Error("Room name is undefined");
        }

        return {
            name: roomName.trim(),
            visibility: (roomOptions.visibility === "public" ? "public" : "private") as Visibility | undefined,
            room_alias_name: slugify(roomName),
            invite: roomOptions.invite?.map((invitation) => invitation.value) ?? [],
            initial_state: this.computeInitialState(roomOptions),
            topic: roomOptions.description,
            creation_content: {
                "m.federate": true, //TODO : read doc on federate space
                type: "m.space",
            },
        };
    }

    private computeInitialState(roomOptions: CreateRoomOptions) {
        const { encrypt, historyVisibility } = roomOptions;
        const initial_state: ICreateRoomStateEvent[] = [];
        if (encrypt) {
            initial_state.push({ type: EventType.RoomEncryption, content: { algorithm: "m.megolm.v1.aes-sha2" } });
        }
        if (historyVisibility !== undefined) {
            initial_state.push({
                type: EventType.RoomHistoryVisibility,
                content: { history_visibility: roomOptions?.historyVisibility },
            });
        }

        if (roomOptions.parentSpaceID) {
            initial_state.push({
                type: EventType.SpaceParent,
                state_key: roomOptions.parentSpaceID,
                content: {
                    via: [this.client?.getDomain()],
                },
            });
            if (roomOptions.visibility === "restricted") {
                initial_state.push({
                    type: "m.room.join_rules",
                    state_key: "",
                    content: {
                        join_rule: "restricted",
                        allow: [
                            {
                                type: "m.room_membership",
                                room_id: roomOptions.parentSpaceID, // Replace with your space room ID
                            },
                        ],
                    },
                });
            }
        }

        initial_state.push({ type: EventType.RoomGuestAccess, content: { guest_access: "can_join" } });

        return initial_state;
    }

    async createDirectRoom(userToInvite: string): Promise<ChatRoom | undefined> {
        if (!this.client) {
            return Promise.reject(CLIENT_NOT_INITIALIZED_ERROR_MSG);
        }

        const existingDirectRoom = this.getDirectRoomFor(userToInvite);

        if (existingDirectRoom) return existingDirectRoom;

        this.roomCreationInProgress.set(true);

        const createRoomOptions = {
            //TODO not clean code
            invite: [{ value: userToInvite, label: userToInvite }],
            is_direct: true,
            preset: "trusted_private_chat",
            visibility: "private",
        } as CreateRoomOptions;

        try {
            const { room_id } = await this.client.createRoom({
                visibility: "private" as Visibility | undefined,
                invite: createRoomOptions.invite?.map((invitation) => invitation.value) ?? [],
                is_direct: true,
                initial_state: this.computeInitialState(createRoomOptions),
            });

            await this.addDMRoomInAccountData(userToInvite, room_id);

            //Wait Sync Event before use/update roomList otherwise room not exist in the client
            await this.waitForNextSync();

            const room = this.client.getRoom(room_id);
            if (!room) return;
            return this.createAndAddNewRootRoom(room);
        } catch (error) {
            throw this.handleMatrixError(error);
        } finally {
            this.roomCreationInProgress.set(false);
        }
    }

    getDirectRoomFor(userID: string): ChatRoom | undefined {
        const directRooms = Array.from(this.roomList.values())
            .filter((room) => {
                return (
                    room.type === "direct" &&
                    room.membersId.some((memberId) => memberId === userID && room.membersId.length === 2)
                );
            })
            .map((room) => room);

        if (directRooms.length > 0) return directRooms[0];

        return undefined;
    }

    async searchChatUsers(searchText: string) {
        try {
            if (!this.client) {
                throw new Error(CLIENT_NOT_INITIALIZED_ERROR_MSG);
            }
            const searchUserResponse = await this.client.searchUserDirectory({ term: searchText, limit: 20 });
            return searchUserResponse.results.map((user) => ({ id: user.user_id, name: user.display_name }));
        } catch (error) {
            console.error("Unable to search matrix chat user with searchText: ", searchText, error);
            Sentry.captureMessage(`Unable to search matrix chat user with searchText: ${error} `);
        }
        return;
    }

    async searchAccessibleRooms(searchText = ""): Promise<
        {
            id: string;
            name: string | undefined;
        }[]
    > {
        const isGuestUser = get(this.isGuest);
        return new Promise((res, rej) => {
            if (!this.client) {
                rej(new Error(CLIENT_NOT_INITIALIZED_ERROR_MSG));
                return;
            }

            const searchOption: IRoomDirectoryOptions = {
                include_all_networks: true,
                filter: {
                    generic_search_term: searchText,
                },
            };
            this.client
                .publicRooms(searchOption)
                .then(({ chunk }) => {
                    const publicRoomsChunkRoom = chunk
                        .filter(({ room_id, guest_can_join }) => {
                            if (this.roomList.has(room_id)) {
                                return false;
                            }
                            if (!isGuestUser) {
                                return true;
                            } else {
                                return guest_can_join;
                            }
                        })
                        .map((chunkRoom) => {
                            console.debug(chunkRoom);
                            return {
                                id: chunkRoom.room_id,
                                name: chunkRoom.name,
                            };
                        });
                    res(publicRoomsChunkRoom);
                })
                .catch((error) => {
                    rej(error);
                });
        });
    }

    async joinRoom(roomId: string): Promise<ChatRoom> {
        return new Promise((res, rej) => {
            if (!this.client) {
                rej(new Error(CLIENT_NOT_INITIALIZED_ERROR_MSG));
                return;
            }

            this.client
                .joinRoom(roomId)
                .then(async (_) => {
                    //Wait Sync Event before use/update roomList otherwise room not exist in the client
                    await this.waitForNextSync();

                    if (!this.client) {
                        rej(new Error(CLIENT_NOT_INITIALIZED_ERROR_MSG));
                        return;
                    }
                    const roomAfterSync = this.client.getRoom(roomId);
                    if (!roomAfterSync) {
                        return Promise.reject(new Error("Room not present after synchronization"));
                    }
                    const dmInviterId = roomAfterSync.getDMInviter();
                    if (dmInviterId) {
                        await this.addDMRoomInAccountData(dmInviterId, roomId);
                    }
                    const room = this.findRoomOrFolder(roomAfterSync.roomId);
                    if (room instanceof MatrixChatRoom) {
                        res(room);
                        return;
                    }

                    const roomFromRoomList = this.createAndAddNewRootRoom(roomAfterSync);
                    res(roomFromRoomList);
                    return;
                })
                .catch((error) => {
                    console.error("Unable to join", error);
                    Sentry.captureMessage(`Unable to join room : ${error}`);
                    rej(this.handleMatrixError(error));
                });
        });
    }

    initEndToEndEncryption(): Promise<void> {
        return this.matrixSecurity.initClientCryptoConfiguration();
    }

    private async addRoomToSpace(spaceRoomId: string, childRoomId: string): Promise<void> {
        if (!this.client) {
            return Promise.reject(new Error(CLIENT_NOT_INITIALIZED_ERROR_MSG));
        }

        const domain = this.client.getDomain();

        if (!domain) {
            return Promise.reject(new Error("Domain is not available"));
        }

        try {
            // @ts-ignore
            await this.client.sendStateEvent(spaceRoomId, EventType.SpaceChild, { via: [domain] }, childRoomId);
            return;
        } catch (error) {
            console.error("Error adding room to space: ", error);
            Sentry.captureMessage(`Error adding room to space:${error}`);
            throw new Error(get(LL).chat.addRoomToFolderError());
        }
    }

    private async addDMRoomInAccountData(userId: string, roomId: string) {
        if (!this.client) {
            throw new Error(CLIENT_NOT_INITIALIZED_ERROR_MSG);
        }
        const directMap: Record<string, string[]> = this.client.getAccountData("m.direct")?.getContent() || {};
        directMap[userId] = [...(directMap[userId] || []), roomId];
        await this.client.setAccountData("m.direct", directMap);
    }

    clearListener() {
        this.roomList.forEach((room) => {
            this.roomList.delete(room.id);
        });
        this.client?.off(ClientEvent.Room, this.handleRoom);
        this.client?.off(ClientEvent.DeleteRoom, this.handleDeleteRoom);
        this.client?.off(RoomEvent.MyMembership, this.handleMyMembership);
        this.client?.off("RoomState.events" as EmittedEvents, this.handleRoomStateEvent);
        this.client?.off(RoomEvent.Name, this.handleName);
        this.client?.off(UserEvent.Presence, this.handleUserPresence);

        if (this.statusUnsubscriber) this.statusUnsubscriber();
    }
    async destroy(): Promise<void> {
        await this.client?.logout(true);
    }
}

class AutoDestroyingMapStore<K, V extends Required<{ destroy: () => void }>> extends MapStore<K, V> {
    override delete(key: K): boolean {
        this.get(key)?.destroy();
        return super.delete(key);
    }
}
