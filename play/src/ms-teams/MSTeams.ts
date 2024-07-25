import axios, { AxiosError, AxiosInstance } from "axios";
import { z } from "zod";
import { AvailabilityStatus, ExternalModuleMessage, OauthRefreshToken } from "@workadventure/messages";
import { subscribe } from "svelte/internal";
import { Unsubscriber, Updater } from "svelte/store";
import { CalendarEventInterface } from "@workadventure/shared-utils";
import { ExtensionModule, ExtensionModuleOptions } from "../extension-module/extension-module";
import { TeamsActivity, TeamsAvailability } from "./MSTeamsInterface";

const MS_GRAPH_ENDPOINT_V1 = "https://graph.microsoft.com/v1.0";
const MS_GRAPH_ENDPOINT_BETA = "https://graph.microsoft.com/beta";
const MS_ME_ENDPOINT = "/me";
const MS_ME_PRESENCE_ENDPOINT = "/me/presence";

interface MSTeamsOnlineMeeting {
    audioConferencing: {
        conferenceId: string;
        tollNumber: string;
        tollFreeNumber: string;
        dialinUrl: string;
    };
    chatInfo: {
        threadId: string;
        messageId: string;
        replyChainMessageId: string;
    };
    creationDateTime: string;
    startDateTime: string;
    endDateTime: string;
    id: string;
    joinWebUrl: string;
    subject: string;
    joinMeetingIdSettings: {
        isPasscodeRequired: boolean;
        joinMeetingId: string;
        passcode: string;
    };
    externalId: string;
    videoTeleconferenceId: string;
    allowedPresenters: string;
}

interface MSTeamsCalendarEvent {
    id: string;
    organizer: {
        emailAddress: {
            name: string;
            address: string;
        };
    };
    locations: {
        displayName: string;
    };
    start: {
        dateTime: string;
        timeZone: string;
    };
    end: {
        dateTime: string;
        timeZone: string;
    };
    body: {
        contentType: string;
        content: string;
    };
    webLink: string;
    onlineMeeting: {
        joinUrl: string;
    };
    subject: string;
    bodyPreview: string;
}

interface MSGraphSubscription {
    id: string;
    changeType: string;
    clientState: string;
    expirationDateTime: string;
    resource: string;
    applicationId: string;
    notificationUrl: string;
    lifecycleNotificationUrl: string;
    creatorId: string;
}

class MSTeams implements ExtensionModule {
    private msAxiosClientV1!: AxiosInstance;
    private msAxiosClientBeta!: AxiosInstance;
    private teamsAvailability!: TeamsAvailability;
    private clientId!: string;
    private listenToWorkadventureStatus: Unsubscriber | undefined = undefined;
    private calendarEventsStoreUpdate?: (
        this: void,
        updater: Updater<Map<string, CalendarEventInterface>>
    ) => void | undefined = undefined;
    private userAccessToken!: string;
    private adminUrl!: string;
    private roomId!: string;

    private unsubscribePresenceSubscription: ((subscriptionId: string) => Promise<void>) | undefined = undefined;
    private unsubscribeCalendarSubscription: ((subscriptionId: string) => Promise<void>) | undefined = undefined;

    init(roomMetadata: unknown, options?: ExtensionModuleOptions) {
        const microsoftTeamsMetadata = this.getMicrosoftTeamsMetadata(roomMetadata);
        if (microsoftTeamsMetadata === undefined) {
            console.error("Microsoft teams metadata is undefined. Cancelling the initialization");
            return;
        }

        this.msAxiosClientV1 = axios.create({
            baseURL: MS_GRAPH_ENDPOINT_V1,
            headers: {
                Authorization: `Bearer ${microsoftTeamsMetadata.accessToken}`,
                "Content-Type": "application/json",
            },
        });
        this.msAxiosClientV1.interceptors.response.use(null, (error) =>
            this.refreshTokenInterceptor(error, options?.getOauthRefreshToken)
        );

        this.msAxiosClientBeta = axios.create({
            baseURL: MS_GRAPH_ENDPOINT_BETA,
            headers: {
                Authorization: `Bearer ${microsoftTeamsMetadata.accessToken}`,
                "Content-Type": "application/json",
            },
        });
        this.msAxiosClientBeta.interceptors.response.use(null, (error) =>
            this.refreshTokenInterceptor(error, options?.getOauthRefreshToken)
        );

        this.setMSTeamsClientId();

        if (microsoftTeamsMetadata.synchronizeStatus) {
            this.listenToTeamsStatusUpdate(options?.onExtensionModuleStatusChange);
            this.userAccessToken = options!.userAccessToken;
            this.roomId = options!.roomId;
            this.initSubscription().catch((e) => console.error("Error while initializing subscription", e));
        }

        if (options?.workadventureStatusStore) {
            this.listenToWorkadventureStatus = subscribe(
                options?.workadventureStatusStore,
                (workadventureStatus: AvailabilityStatus) => {
                    this.setStatus(workadventureStatus);
                }
            );
        }
        if (options?.calendarEventsStoreUpdate) {
            this.calendarEventsStoreUpdate = options?.calendarEventsStoreUpdate;
            this.updateCalendarEvents().catch((e) => console.error("Error while updating calendar events", e));
        }

        if (options?.externalModuleMessage) {
            // The externalModuleMessage is completed in the RoomConnection. No need to unsubscribe.
            //eslint-disable-next-line rxjs/no-ignored-subscription, svelte/no-ignored-unsubscribe
            options.externalModuleMessage.subscribe((externalModuleMessage: ExternalModuleMessage) => {
                console.info("Message received from external module", externalModuleMessage);
                const type = externalModuleMessage.message["@odata.type"];
                switch (type) {
                    case "#Microsoft.Graph.presence":
                        // get the presence status
                        if (options?.onExtensionModuleStatusChange)
                            options?.onExtensionModuleStatusChange(
                                this.mapTeamsStatusToWorkAdventureStatus(externalModuleMessage.message.availability)
                            );
                        break;
                    case "#Microsoft.Graph.onlineMeetings":
                        this.updateCalendarEvents().catch((e) =>
                            console.error("Error while updating calendar events", e)
                        );
                        break;
                    default:
                        console.error("Unknown message type", type);
                        break;
                }
                return externalModuleMessage;
            });
        }
        console.info("Microsoft teams module for WorkAdventure initialized");
    }

    private refreshTokenInterceptor(
        error: unknown,
        getOauthRefreshToken?: (tokenToRefresh: string) => Promise<OauthRefreshToken>
    ) {
        const parsedError = z
            .object({
                response: z.object({ status: z.number() }),
                config: z.object({ headers: z.object({ Authorization: z.string() }) }),
            })
            .safeParse(error);
        if (parsedError.error) {
            return Promise.reject(error);
        }
        if (parsedError.data.response.status === 401 && getOauthRefreshToken !== undefined) {
            const existingToken = parsedError.data.config.headers.Authorization.replace("Bearer ", "");
            getOauthRefreshToken(existingToken)
                .then(({ token }) => {
                    this.msAxiosClientV1.defaults.headers.common.Authorization = `Bearer ${token}`;
                    console.info("Microsoft teams token has been refreshed");
                })
                .catch((error) => {
                    throw error;
                });
        }
        return error;
    }

    private getMicrosoftTeamsMetadata(
        roomMetadata: unknown
    ): { accessToken: string; synchronizeStatus: boolean } | undefined {
        const parsedRoomMetadata = z
            .object({
                player: z.object({
                    accessTokens: z.array(
                        z.object({
                            token: z.string(),
                            provider: z.string(),
                        })
                    ),
                }),
                msteams: z.boolean(),
            })
            .safeParse(roomMetadata);

        if (!parsedRoomMetadata.success) {
            console.error(
                "Unable to initialize Microsoft teams module due to room metadata parsing error : ",
                parsedRoomMetadata.error
            );
            return;
        }

        //TODO access token verification
        const msTeamsAccessToken = parsedRoomMetadata.data.player.accessTokens[0]?.token;
        const synchronizeStatus = parsedRoomMetadata.data.msteams;
        if (msTeamsAccessToken === undefined) {
            console.warn("No Microsoft access token found for MSTeamsModule initialization");
            return;
        }

        return { accessToken: msTeamsAccessToken, synchronizeStatus };
    }

    listenToTeamsStatusUpdate(onTeamsStatusChange?: (workAdventureNewStatus: AvailabilityStatus) => void) {
        this.msAxiosClientV1
            .get<unknown>(MS_ME_PRESENCE_ENDPOINT)
            .then((response) => {
                const userPresence = response.data;
                const userPresenceResponse = z
                    .object({
                        availability: TeamsAvailability,
                        activity: TeamsActivity,
                    })
                    .safeParse(userPresence);

                if (!userPresenceResponse.success) {
                    throw new Error("Your presence status cannot be handled by this script");
                }

                if (onTeamsStatusChange === undefined) {
                    console.warn(
                        "You are listening to Microsoft status changed but the onTeamsStatusChange option is not set"
                    );
                    return;
                }

                onTeamsStatusChange(this.mapTeamsStatusToWorkAdventureStatus(userPresenceResponse.data.availability));
                this.teamsAvailability = userPresenceResponse.data.availability;
            })
            .catch((e) => console.error("Error while getting MSTeams status", e));
    }

    setStatus(workadventureNewStatus: AvailabilityStatus) {
        const newTeamsAvailability = this.mapWorkAdventureStatusToTeamsStatus(workadventureNewStatus);
        if (newTeamsAvailability === this.teamsAvailability) {
            return;
        }

        if (this.clientId === undefined) {
            console.error("Unable to set teams status because client ID is undefined");
            return;
        }

        this.msAxiosClientV1
            .post(this.getUrlForSettingUserPresence(), {
                availability: newTeamsAvailability,
                activity: newTeamsAvailability,
            })
            .then(() => {
                console.info(`Your presence status has been set to ${newTeamsAvailability}`);
            })
            .catch((e) => console.error(e));
    }

    private getUrlForSettingUserPresence() {
        return `/users/${this.clientId}/presence/setUserPreferredPresence`;
    }

    joinMeeting() {
        console.log("joinTeamsMeeting : Not Implemented");
    }

    destroy() {
        if (this.listenToWorkadventureStatus !== undefined) {
            this.listenToWorkadventureStatus();
        }
        this.destroySubscription().catch((e) => console.error("Error while destroying subscription", e));
    }

    private setMSTeamsClientId() {
        const meResponseObject = z.object({
            id: z.string(),
        });

        this.msAxiosClientV1
            .get(MS_ME_ENDPOINT)
            .then((response) => {
                const meResponse = meResponseObject.safeParse(response.data);
                if (!meResponse.success) {
                    console.error("Unable to retrieve Microsoft client id", meResponse.error);
                    return;
                }
                this.clientId = meResponse.data.id;
            })
            .catch((error) => console.error("Unable to retrieve Microsoft client Id : ", error));
    }

    private mapTeamsStatusToWorkAdventureStatus(teamsStatus: TeamsAvailability): AvailabilityStatus {
        switch (teamsStatus) {
            case "Available":
                return AvailabilityStatus.ONLINE;
            case "Away":
                return AvailabilityStatus.AWAY;
            case "AvailableIdle":
                return AvailabilityStatus.ONLINE;
            case "BeRightBack":
                return AvailabilityStatus.BACK_IN_A_MOMENT;
            case "Busy":
                return AvailabilityStatus.BUSY;
            case "BusyIdle":
                return AvailabilityStatus.BUSY;
            case "DoNotDisturb":
                return AvailabilityStatus.DO_NOT_DISTURB;
            default:
                return AvailabilityStatus.DO_NOT_DISTURB;
        }
    }

    private mapWorkAdventureStatusToTeamsStatus(workAdventureStatus: AvailabilityStatus): TeamsAvailability {
        switch (workAdventureStatus) {
            case AvailabilityStatus.AWAY:
                return "Away";
            case AvailabilityStatus.BACK_IN_A_MOMENT:
                return "BeRightBack";
            case AvailabilityStatus.ONLINE:
                return "Available";
            case AvailabilityStatus.BUSY:
                return "Busy";
            case AvailabilityStatus.JITSI:
                return "Busy";
            case AvailabilityStatus.DENY_PROXIMITY_MEETING:
                return "Busy";
            case AvailabilityStatus.DO_NOT_DISTURB:
                return "DoNotDisturb";
            case AvailabilityStatus.SILENT:
                return "DoNotDisturb";
            case AvailabilityStatus.BBB:
                return "Busy";
            case AvailabilityStatus.SPEAKER:
                return "Busy";
            default:
                return "Available";
        }
    }

    // Update the calendar events
    private async updateCalendarEvents(): Promise<void> {
        try {
            const myCalendarEvents = await this.getMyCalendarEvent();
            const calendarEvents = [];
            for (const event of myCalendarEvents) {
                const calendarEvent: CalendarEventInterface = {
                    id: event.id,
                    title: event.subject,
                    description: event.bodyPreview,
                    start: new Date(event.start.dateTime),
                    end: new Date(event.end.dateTime),
                    allDay: false,
                    resource: {
                        body: event.body,
                        onlineMeeting: event.onlineMeeting,
                    },
                };
                calendarEvents.push(calendarEvent);
            }

            // Sort the calendar events by start date
            calendarEvents.sort((a, b) => a.start.getTime() - b.start.getTime());

            // Convert the calendar to map
            const sortedCalendarEvents = new Map<string, CalendarEventInterface>();
            for (const event of calendarEvents) {
                sortedCalendarEvents.set(event.id, event);
            }

            // Update the calendar events store
            if (this.calendarEventsStoreUpdate !== undefined) {
                this.calendarEventsStoreUpdate(() => {
                    return sortedCalendarEvents;
                });
            }
        } catch (e) {
            console.error("Error while updating calendar events", e);
            // TODO show error message
        }
    }

    private async getMyCalendarEvent(): Promise<MSTeamsCalendarEvent[]> {
        const today = new Date();
        // Create date between 00:00 and 23:59
        const startDateTime = new Date(
            today.getFullYear(),
            today.getMonth(),
            today.getDate(),
            today.getHours(),
            0,
            0,
            0
        );
        const endDateTime = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);
        // Get all events between today 00:00 and 23:59
        try {
            const calendarEventUrl = `/me/calendar/calendarView?$select=subject,body,bodyPreview,organizer,attendees,start,end,location,weblink,onlineMeeting&startDateTime=${startDateTime.toISOString()}&endDateTime=${endDateTime.toISOString()}`;
            const mSTeamsCalendarEventResponse = await this.msAxiosClientV1.get(calendarEventUrl);
            return mSTeamsCalendarEventResponse.data.value;
        } catch (e) {
            if ((e as AxiosError).response?.status === 401) {
                return await this.getMyCalendarEvent();
            }
            throw e;
        }
    }

    async createOrGetMeeting(meetingId: string): Promise<MSTeamsOnlineMeeting> {
        try {
            const dateNow = new Date();
            return await this.msAxiosClientV1.post(`/me/onlineMeetings/createOrGet`, {
                externalId: meetingId,
                // Start date time, now
                startDateTime: dateNow.toISOString(),
                subject: "Meet Now",
            });
        } catch (e) {
            if ((e as AxiosError).response?.status === 401) {
                return await this.createOrGetMeeting(meetingId);
            }
            throw e;
        }
    }

    private async initSubscription(): Promise<void> {
        const responses = await Promise.all([
            this.createOrGetPresenceSubscription(),
            this.createOrGetCalendarSubscription(),
        ]);
        if (responses[0] !== undefined) {
            this.unsubscribePresenceSubscription = this.deletePresenceSubscription.bind(responses[0].id);
        }
        if (responses[1] !== undefined) {
            this.unsubscribeCalendarSubscription = this.deleteCalendarSubscription.bind(responses[1].id);
        }
    }

    async destroySubscription(): Promise<unknown> {
        const promisesDestroySubscription = [];
        if (this.unsubscribePresenceSubscription !== undefined) {
            promisesDestroySubscription.push(this.unsubscribePresenceSubscription);
        }
        if (this.unsubscribeCalendarSubscription !== undefined) {
            promisesDestroySubscription.push(this.unsubscribeCalendarSubscription);
        }
        return Promise.all(promisesDestroySubscription);
    }

    // Create subscription to listen changes
    private async createOrGetPresenceSubscription(): Promise<MSGraphSubscription> {
        // Check if the subscription already exists
        const subscriptions = await this.msAxiosClientV1.get(`/subscriptions`);
        if (subscriptions.data.value.length > 0) {
            const presenceSubscription = subscriptions.data.value.find(
                (subscription: MSGraphSubscription) => subscription.resource === `/users/${this.clientId}/presences`
            );
            return presenceSubscription;
        }

        // Experiation date is 60 minutes, check the graph documentation for more information
        // https://docs.microsoft.com/en-us/graph/api/subscription-post-subscriptions?view=graph-rest-1.0
        const expirationDateTime = new Date();
        expirationDateTime.setMinutes(expirationDateTime.getMinutes() + 60);

        return await this.msAxiosClientV1.post(`/subscriptions`, {
            changeType: "updated",
            notificationUrl: `${this.adminUrl}/api/webhook/msgraph/notificationUrl/${this.userAccessToken}`,
            lifecycleNotificationUrl: `${this.adminUrl}/api/webhook/msgraph/notificationUrl/${this.userAccessToken}`,
            resource: `/users/${this.clientId}/presences`,
            expirationDateTime,
            clientState: `${this.roomId}`,
        });
    }

    // Create subscription to listen changes
    private async createOrGetCalendarSubscription(): Promise<MSGraphSubscription> {
        // Check if the subscription already exists
        const subscriptions = await this.msAxiosClientBeta.get(`/subscriptions`);
        if (subscriptions.data.value.length > 0) {
            const calendarSubscription = subscriptions.data.value.find(
                (subscription: MSGraphSubscription) =>
                    subscription.resource === `/users/${this.clientId}/calendar/events`
            );
            return calendarSubscription;
        }

        // Expiration date is 3 days for online meeting, check the graph documentation for more information
        // https://docs.microsoft.com/en-us/graph/api/subscription-post-subscriptions?view=graph-rest-1.0
        const expirationDateTime = new Date();
        expirationDateTime.setDate(expirationDateTime.getDate() + 3);

        return await this.msAxiosClientBeta.post(`/subscriptions`, {
            changeType: "created,updated,deleted",
            notificationUrl: `${this.adminUrl}/api/webhook/msgraph/notificationUrl/${this.userAccessToken}`,
            lifecycleNotificationUrl: `${this.adminUrl}/api/webhook/msgraph/notificationUrl/${this.userAccessToken}`,
            resource: `/users/${this.clientId}/onlineMeetings`,
            expirationDateTime,
            clientState: `${this.roomId}`,
        });
    }

    private async deletePresenceSubscription(subscriptionId: string): Promise<void> {
        await this.msAxiosClientV1.delete(`/subscriptions/${subscriptionId}`);
    }

    private async deleteCalendarSubscription(subscriptionId: string): Promise<void> {
        await this.msAxiosClientBeta.delete(`/subscriptions/${subscriptionId}`);
    }

    private async reauthorizePresenceSubscription(subscriptionId: string): Promise<void> {
        // Experiation date is 60 minutes, check the graph documentation for more information
        // https://docs.microsoft.com/en-us/graph/api/subscription-post-subscriptions?view=graph-rest-1.0
        const expirationDateTime = new Date();
        expirationDateTime.setMinutes(expirationDateTime.getMinutes() + 60);
        await this.msAxiosClientBeta.post(`/subscriptions/${subscriptionId}/reauthorize`);
        await this.msAxiosClientBeta.patch(`/subscriptions/${subscriptionId}`, {
            expirationDateTime,
        });
    }

    private async reauthorizeCalendarSubscription(subscriptionId: string): Promise<void> {
        // Expiration date is 3 days for online meeting, check the graph documentation for more information
        // https://docs.microsoft.com/en-us/graph/api/subscription-post-subscriptions?view=graph-rest-1.0
        const expirationDateTime = new Date();
        expirationDateTime.setDate(expirationDateTime.getDate() + 3);

        await this.msAxiosClientV1.post(`/subscriptions/${subscriptionId}/reauthorize`);
        await this.msAxiosClientV1.patch(`/subscriptions/${subscriptionId}`, {
            expirationDateTime,
        });
    }
}

export default new MSTeams();
