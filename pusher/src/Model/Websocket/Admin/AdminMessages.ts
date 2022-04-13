import { z } from "zod";

export const isBanBannedAdminMessageInterface = z.object({
    type: z.enum(["ban", "banned"]),
    message: z.string(),
    userUuid: z.string(),
});

export const isUserMessageAdminMessageInterface = z.object({
    event: z.enum(["user-message"]),
    message: isBanBannedAdminMessageInterface,
    world: z.string(),
    jwt: z.string(),
});

export const isListenRoomsMessageInterface = z.object({
    event: z.enum(["listen"]),
    roomIds: z.array(z.string()),
    jwt: z.string(),
});

export const isAdminMessageInterface = z.union([isUserMessageAdminMessageInterface, isListenRoomsMessageInterface]);

export type AdminMessageInterface = z.infer<typeof isAdminMessageInterface>;
