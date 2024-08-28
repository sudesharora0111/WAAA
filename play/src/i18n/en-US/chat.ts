import type { BaseTranslation } from "../i18n-types";

const chat: BaseTranslation = {
    intro: "Here is your chat history:",
    enter: "Enter your message...",
    menu: {
        visitCard: "Visit card",
        addFriend: "Add friend",
    },
    loader: "Loading...",
    typing: "is typing...",
    users: "Users",
    chat: "Chat",
    userList: {
        disconnected: "Disconnected",
        isHere: "Is on this map",
        inAnotherMap: "In another map",
        in: "In ",
        teleport: "Teleport",
        search: "Just look it up!",
        walkTo: "Walk to",
        teleporting: "Teleporting ...",
        businessCard: "Business Card",
        sendMessage: "Send Message",
    },
    accept: "Accept",
    decline: "Decline",
    connecting: "Connecting to server ...",
    waitingInit: "Waiting for server initialization ...",
    waitingData: "Waiting user data ...",
    searchUser: "Search for user, map, etc ...",
    searchChat: "Search for channel, message, etc ...",
    people: "People",
    rooms: "Rooms",
    invitations: "Invitations",
    availableRooms: "Available rooms",
    proximity: "Proximity Chat",
    role: {
        admin: "Administrator",
        member: "Member",
        visitor: "Visitor",
    },
    status: {
        online: "Online",
        away: "Away",
        unavailable: "Unavailable",
        back_in_a_moment: "Back_in_a_moment",
        do_not_disturb: "Do not disturb",
        busy: "Busy",
    },
    logIn: "Log in",
    signIn: "Register or log in to enjoy all the features of the chat !",
    invite: "Invite",
    roomEmpty: "This room is empty, invite a colleague or friend to join you!",
    userOnline: "user online",
    usersOnline: "users online",
    open: "Open",
    me: "Me",
    you: "You",
    ban: {
        title: "Ban",
        content: "Ban user {userName} from the running world. This can be cancelled from the administration.",
        ban: "Ban this user",
    },
    loading: "Loading",
    loadingUsers: "Loading the users ...",
    load: "Load",
    rankUp: "Promote",
    rankDown: "Retrograde",
    reinit: "Re initialize",
    enterText: "Enter a message ...",
    timeLine: {
        title: "Your Timeline",
        open: "Open your time line history!",
        description: "Messages and events history",
        incoming: "{userName} joined the discussion",
        outcoming: "{userName} has left the discussion",
        youLeft: "You left the discussion",
    },
    form: {
        placeholder: "Enter your message...",
        typing: " typing...",
        application: {
            klaxoon: {
                title: "Klaxoon",
                description: "Send embedded klaxoon in the chat!",
                error: "Please enter a valid Klaxoon URL",
            },
            youtube: {
                title: "Youtube",
                description: "Send embedded youtube video in the chat!",
                error: "Please enter a valid Youtube URL",
            },
            googleDocs: {
                title: "Google Docs",
                description: "Send embedded google docs in the chat!",
                error: "Please enter a valid Google Docs URL",
            },
            googleSlides: {
                title: "Google Slides",
                description: "Send embedded google slides in the chat!",
                error: "Please enter a valid Google Slides URL",
            },
            googleSheets: {
                title: "Google Sheets",
                description: "Send embedded google sheets in the chat!",
                error: "Please enter a valid Google Sheets URL",
            },
            eraser: {
                title: "Eraser",
                description: "Send embedded eraser in the chat!",
                error: "Please enter a valid Eraser URL",
            },
            weblink: {
                error: "Please enter a valid URL",
            },
        },
    },
    notification: {
        discussion: "wants to discuss with you",
        message: "sends a message",
        forum: "on the forum",
    },
    see: "See",
    show: "Show",
    less: "less",
    more: "more",
    sendBack: "Send back",
    delete: "Delete",
    messageDeleted: "Message deleted",
    emoji: {
        icon: "Icon to open or close emoji selected popup",
        search: "Search emojis...",
        categories: {
            recents: "Recent Emojis",
            smileys: "Smileys & Emotion",
            people: "People & Body",
            animals: "Animals & Nature",
            food: "Food & Drink",
            activities: "Activities",
            travel: "Travel & Places",
            objects: "Objects",
            symbols: "Symbols",
            flags: "Flags",
            custom: "Custom",
        },
        notFound: "No emojis found",
    },
    said: "said :",
    reply: "Reply",
    react: "React",
    copy: "Copy",
    copied: "Copied!",
    file: {
        fileContentNoEmbed: "Content unavailable for viewing. Please download it",
        download: "download",
        openCoWebsite: "Open in co-website",
        copy: "copy the link",
        tooBig: "{fileName} is too big {maxFileSize}.",
        notLogged: "You need to be logged in to upload a file.",
    },
    needRefresh: "Your connection has expired, you need to refresh the page to reconnect to the chat.",
    refresh: "Refresh",
    upgrade: "Upgrade",
    upgradeToSeeMore: "Upgrade to see more messages",
    disabled: "This feature is disabled.",
    disabledByAdmin: "This feature is disabled by the administrator.",
    anAdmin: "an administrator",
    messageDeletedByYou: "You deleted this message",
    messageEdited: "Modified",
    waiting: "Waiting",
    nothingToDisplay: "Nothing to display",
    createRoom: {
        title: "Create new room",
        name: "Name",
        visibility: {
            label: "Visibility",
            private: "Private",
            privateDescription: "Only invited guests will be able to find and join the room.",
            public: "Public",
            publicDescription: "Anyone can find and join the room.",
        },
        e2eEncryption: {
            label: "Activate end to end encryption",
            description: "You won't be able to deactivate it later.",
        },
        users: "Users",
        historyVisibility: {
            label: "Who can read history ?",
            world_readable: "Anyone",
            joined: "Members only (since they joined)",
            invited: "Members only (since they were invited)",
        },
        buttons: {
            create: "Create",
            cancel: "Cancel",
        },
        error: "Error on room creation",
        loadingCreation: "Room creation in progress",
        creationSuccessNotification: "Room created",
    },
    createFolder: {
        title: "Create new space",
        name: "Name",
        visibility: {
            label: "Visibility",
            private: "Private",
            privateDescription: "Only invited guests will be able to find and join the room.",
            public: "Public",
            publicDescription: "Anyone can find and join the room.",
        },
        description: {
            label: "Description",
            placeholder: "Description",
        },
        e2eEncryption: {
            label: "Activate end to end encryption",
            description: "You won't be able to deactivate it later.",
        },
        users: "Users",
        historyVisibility: {
            label: "Who can read history ?",
            world_readable: "Anyone",
            joined: "Members only (since they joined)",
            invited: "Members only (since they were invited)",
        },
        buttons: {
            create: "Create",
            cancel: "Cancel",
        },
        error: "Error on room creation",
        loadingCreation: "Room creation in progress",
        creationSuccessNotification: "Room created",
    },
    roomMenu: {
        leaveRoom: {
            label: "Leave room",
            notification: "You have left the room",
        },
    },
    e2ee: {
        encryptionNotConfigured: "Encryption not configured",
        createRecoveryKey: {
            title: "Chat recovery key creation",
            description:
                "In order use end to end encryption in the chat, you need to create a recovery key. Please enter your passphrase below, a recovery key will be created.",
            privateKeyDescription:
                "This is your private key, save it somewhere to retrieve encrypted discussions after logged out.",
            error: "Something went wrong on generateRecoveryKeyFromPassphrase",
            buttons: {
                generate: "Generate",
                continue: "Continue",
                cancel: "Cancel",
            },
        },
        interactiveAuth: {
            title: "Chat end to end encryption",
            description:
                "For security reason, a cross signing key must be uploaded to our server. By confirming your identity, you will save the cross signing key allowing you to read encrypted message from WA and other clients.",
            instruction: "Be sure to end SSO connection popup after before clicking on Finish button",
            buttons: {
                cancel: "Cancel",
                continueSSO: "Continue with SSO",
                finish: "Finish",
            },
        },
        accessSecretStorage: {
            title: "Chat session verification",
            description:
                "In order to verify your session and retrieve historical encrypted message your need to enter your recovery key or passphrase.",
            passphrase: "Passphrase",
            recoveryKey: "Recovery key",
            placeholder: "Enter your",
            buttons: {
                cancel: "Cancel",
                usePassphrase: "Use passphrase instead",
                useRecoveryKey: "Use recovery key instead",
                confirm: "Confirm",
            },
        },
    },
    connectionError: "Chat not available",
};

export default chat;
