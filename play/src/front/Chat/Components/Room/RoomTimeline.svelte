<script lang="ts">
    import { afterUpdate, beforeUpdate, onMount } from "svelte";
    import { get } from "svelte/store";
    import { ChatRoom } from "../../Connection/ChatConnection";
    import { selectedChatMessageToReply, selectedRoom } from "../../Stores/ChatStore";
    import Avatar from "../Avatar.svelte";
    import LL from "../../../../i18n/i18n-svelte";
    import { matrixSecurity } from "../../Connection/Matrix/MatrixSecurity";
    import { localUserStore } from "../../../Connection/LocalUserStore";
    import Message from "./Message.svelte";
    import MessageInputBar from "./MessageInputBar.svelte";
    import MessageSystem from "./MessageSystem.svelte";
    import { IconArrowLeft, IconLoader } from "@wa-icons";

    export let room: ChatRoom;

    let myChatID = localUserStore.getChatId();

    const NUMBER_OF_TYPING_MEMBER_TO_DISPLAY = 3;
    let typingMembers = room.typingMembers;
    let messageListRef: HTMLDivElement;
    let autoScroll = true;
    let onScrollTop = false;

    let oldScrollHeight = 0;

    let loadingMessagePromise: Promise<void> | undefined = undefined;

    let scrollTimer: ReturnType<typeof setTimeout>;
    let shouldDisplayLoader = false;

    $: messages = room?.messages;
    $: messageReaction = room?.messageReactions;
    $: roomName = room?.name;

    onMount(() => {
        scrollToMessageListBottom();
        initMessages().catch((error) => console.error(error));
    });

    async function initMessages() {
        if (!messageListRef) return;

        const loadMessages = async () => {
            try {
                if (get(room.isEncrypted) && get(matrixSecurity.isEncryptionRequiredAndNotSet)) {
                    return;
                }

                await room.loadMorePreviousMessages();

                if (get(room.hasPreviousMessage) && isViewportNotFilled()) {
                    await loadMessages();
                }
            } catch (error) {
                console.error(`Failed to load messages: ${error}`);
            }
        };

        await loadMessages();
        scrollToMessageListBottom();
        setFirstListItem();
    }

    beforeUpdate(() => {
        if (messageListRef) {
            oldScrollHeight = messageListRef.scrollHeight;
            const scrollableDistance = messageListRef.scrollHeight - messageListRef.offsetHeight;
            autoScroll = messageListRef.scrollTop > scrollableDistance - 20;
            onScrollTop = messageListRef.scrollTop === 0;
        }
    });

    afterUpdate(() => {
        room.setTimelineAsRead();
        if (autoScroll) {
            scrollToMessageListBottom();
        } else if (onScrollTop) {
            const oldFirstListItem = messageListRef.querySelector<HTMLLIElement>('li[data-first-li="true"]');

            if (oldFirstListItem !== null) {
                const newScrollHeight = messageListRef.scrollHeight;
                messageListRef.scrollTop = newScrollHeight - oldScrollHeight;
            }
            setFirstListItem();
        }
    });

    function scrollToMessageListBottom() {
        messageListRef.scroll({ top: messageListRef.scrollHeight, behavior: "smooth" });
    }

    function goBackAndClearSelectedChatMessage() {
        selectedChatMessageToReply.set(null);
        selectedRoom.set(undefined);
    }

    function handleScroll() {
        clearTimeout(scrollTimer);
        scrollTimer = setTimeout(() => {
            loadMorePreviousMessages();
        }, 100);
    }

    function loadMorePreviousMessages() {
        if (loadingMessagePromise || !shouldLoadMoreMessages()) return;

        loadingMessagePromise = new Promise<void>((resolve) => {
            (async () => {
                const loadMessages = async () => {
                    try {
                        if (messageListRef.scrollTop === 0) {
                            shouldDisplayLoader = true;
                        }
                        await room.loadMorePreviousMessages();

                        if (shouldLoadMoreMessages()) {
                            loadMorePreviousMessages();
                        }
                    } catch {
                        throw new Error("Failed to load messages");
                    } finally {
                        if (shouldDisplayLoader) {
                            shouldDisplayLoader = false;
                        }
                    }
                };

                await loadMessages();
            })().finally(() => {
                resolve();
            });
        }).finally(() => {
            loadingMessagePromise = undefined;
        });
    }

    function shouldLoadMoreMessages() {
        const messages = Array.from(messageListRef?.querySelectorAll("li") || []);
        const messagesBeforeViewportTop = messages.find((msg) => msg.getBoundingClientRect().top >= 0);

        return (
            messagesBeforeViewportTop &&
            messages.indexOf(messagesBeforeViewportTop) < 10 &&
            messages.indexOf(messagesBeforeViewportTop) !== -1 &&
            get(room.hasPreviousMessage)
        );
    }

    function setFirstListItem() {
        const oldFirstListItem = messageListRef.querySelector<HTMLLIElement>('li[data-first-li="true"]');
        oldFirstListItem?.removeAttribute("data-first-li");

        const firstListItem = messageListRef.getElementsByTagName("li").item(0);
        firstListItem?.setAttribute("data-first-li", "true");
    }

    function isViewportNotFilled() {
        return messageListRef.scrollHeight <= messageListRef.clientHeight;
    }

    function onUpdateMessageBody(event: CustomEvent) {
        if (
            autoScroll ||
            (event.detail.id === $messages[$messages.length - 1].id &&
                $messages[$messages.length - 1].sender?.chatId === myChatID)
        ) {
            scrollToMessageListBottom();
        }
    }
</script>

<div class="tw-flex tw-flex-col tw-flex-auto tw-h-full tw-w-full tw-max-w-full tw-pl-2">
    {#if room !== undefined}
        <div class="tw-flex tw-flex-col tw-gap-2">
            <div class="tw-flex tw-flex-row tw-items-center">
                <button class="back-roomlist tw-p-0 tw-m-0" on:click={goBackAndClearSelectedChatMessage}>
                    <IconArrowLeft />
                </button>
                <span class="tw-flex-1" />
                <p class="tw-m-0 tw-p-0 tw-text-gray-400" data-testid="roomName">{$roomName}</p>
                <span class="tw-flex-1" />
            </div>
            {#if shouldDisplayLoader}
                <div class="tw-flex tw-justify-center tw-items-center tw-w-full tw-pb-1 tw-bg-transparent">
                    <IconLoader class="tw-animate-[spin_2s_linear_infinite]" font-size={25} />
                </div>
            {/if}
        </div>
        <div
            bind:this={messageListRef}
            class="tw-flex tw-overflow-auto tw-h-full {$messages.length && 'tw-items-end'} "
            on:scroll={handleScroll}
        >
            <ul class="tw-list-none tw-p-0 tw-flex-1 tw-flex tw-flex-col tw-max-h-full">
                <!--{#if room.id === "proximity" && $connectedUsers !== undefined}-->
                <!--    <div class="tw-flex tw-flex-row tw-items-center tw-gap-2">-->
                <!--        {#each [...$connectedUsers] as [userId, user] (userId)}-->
                <!--            <div class="avatar">-->
                <!--                <Avatar avatarUrl={user.avatarUrl} fallbackName={user?.username} color={user?.color} />-->
                <!--            </div>-->
                <!--        {/each}-->
                <!--    </div>-->
                <!--{/if}-->
                {#if $messages.length === 0}
                    <p class="tw-self-center tw-text-md tw-text-gray-500">{$LL.chat.nothingToDisplay()}</p>
                {/if}
                {#each $messages as message (message.id)}
                    <li data-event-id={message.id}>
                        {#if message.type === "outcoming" || message.type === "incoming"}
                            <MessageSystem {message} />
                        {:else}
                            <Message
                                on:updateMessageBody={onUpdateMessageBody}
                                {message}
                                reactions={$messageReaction.get(message.id)}
                            />
                        {/if}
                    </li>
                {/each}
            </ul>
        </div>

        {#if $typingMembers.length > 0}
            <div class="tw-flex tw-row tw-w-full tw-text-gray-300 tw-text-sm  tw-m-0 tw-px-2 tw-mb-2">
                <!-- {$typingMembers.map(typingMember => typingMember.name).slice(0, NUMBER_OF_TYPING_MEMBER_TO_DISPLAY)} -->
                {#each $typingMembers
                    .map((typingMember, index) => ({ ...typingMember, index }))
                    .slice(0, NUMBER_OF_TYPING_MEMBER_TO_DISPLAY) as typingMember (typingMember.id)}
                    {#if typingMember.avatarUrl || typingMember.name}
                        <div id={`typing-user-${typingMember.id}`} class="-tw-ml-2é">
                            <Avatar
                                isChatAvatar={true}
                                avatarUrl={typingMember.avatarUrl}
                                fallbackName={typingMember.name ? typingMember.name : "Unknown"}
                            />
                        </div>
                    {/if}
                {/each}

                {#if $typingMembers.length > NUMBER_OF_TYPING_MEMBER_TO_DISPLAY}
                    <div
                        class={`tw-rounded-full tw-h-6 tw-w-6 tw-text-center tw-uppercase tw-text-white tw-bg-gray-400 -tw-ml-1 chatAvatar`}
                    >
                        +{$typingMembers.length - NUMBER_OF_TYPING_MEMBER_TO_DISPLAY}
                    </div>
                {/if}
                <div class="message tw-rounded-2xl tw-px-3 tw-rounded-bl-none tw-bg-primary tw-flex tw-text-lg tw-ml-1">
                    <div class="animate-bounce-1">.</div>
                    <div class="animate-bounce-2">.</div>
                    <div class="animate-bounce-3">.</div>
                </div>
            </div>
        {/if}
        <MessageInputBar {room} />
    {/if}
</div>

<style>
    @keyframes bounce {
        0%,
        100% {
            transform: translateY(0);
        }
        50% {
            transform: translateY(-25%);
        }
    }

    .animate-bounce-1 {
        animation: bounce 1s infinite;
    }

    .animate-bounce-2 {
        animation: bounce 1s infinite 0.1s;
    }

    .animate-bounce-3 {
        animation: bounce 1s infinite 0.2s;
    }

    .message {
        min-width: 0;
        overflow-wrap: anywhere;
        position: relative;
    }

    .chatAvatar {
        border-style: solid;
        border-color: rgb(27 42 65 / 0.95);
        border-width: 1px;
    }
</style>
