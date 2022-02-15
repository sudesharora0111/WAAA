import { requestVisitCardsStore } from "../../Stores/GameStore";
import { ActionsMenuData, actionsMenuStore } from "../../Stores/ActionsMenuStore";
import { Character } from "../Entity/Character";
import type { GameScene } from "../Game/GameScene";
import type { PointInterface } from "../../Connexion/ConnexionModels";
import type { PlayerAnimationDirections } from "../Player/Animation";
import type { Unsubscriber } from "svelte/store";
import type { ActivatableInterface } from "../Game/ActivatableInterface";
import type CancelablePromise from "cancelable-promise";

export enum RemotePlayerEvent {
    Clicked = "Clicked",
}

type ActionsMenuAction = { actionName: string; callback: Function; protected?: boolean };

/**
 * Class representing the sprite of a remote player (a player that plays on another computer)
 */
export class RemotePlayer extends Character implements ActivatableInterface {
    public userId: number;
    public readonly activationRadius: number;

    private registeredActions: Map<string, ActionsMenuAction> = new Map<string, ActionsMenuAction>();
    private visitCardUrl: string | null;
    private isActionsMenuInitialized: boolean = false;
    private actionsMenuStoreUnsubscriber: Unsubscriber;

    constructor(
        userId: number,
        Scene: GameScene,
        x: number,
        y: number,
        name: string,
        texturesPromise: CancelablePromise<string[]>,
        direction: PlayerAnimationDirections,
        moving: boolean,
        visitCardUrl: string | null,
        companion: string | null,
        companionTexturePromise?: CancelablePromise<string>,
        activationRadius?: number
    ) {
        super(Scene, x, y, texturesPromise, name, direction, moving, 1, true, companion, companionTexturePromise);

        //set data
        this.userId = userId;
        this.visitCardUrl = visitCardUrl;
        this.registerDefaultActionsMenuActions();
        // this.setClickable(this.registeredActions.length > 0);
        this.activationRadius = activationRadius ?? 96;
        this.actionsMenuStoreUnsubscriber = actionsMenuStore.subscribe((value: ActionsMenuData | undefined) => {
            this.isActionsMenuInitialized = value ? true : false;
        });

        this.bindEventHandlers();
    }

    public updatePosition(position: PointInterface): void {
        this.playAnimation(position.direction as PlayerAnimationDirections, position.moving);
        this.setX(position.x);
        this.setY(position.y);

        this.setDepth(position.y); //this is to make sure the perspective (player models closer the bottom of the screen will appear in front of models nearer the top of the screen).

        if (this.companion) {
            this.companion.setTarget(position.x, position.y, position.direction as PlayerAnimationDirections);
        }
    }

    public registerActionsMenuAction(action: { actionName: string; callback: Function }): void {
        const prevAction = this.registeredActions.get(action.actionName);
        if (prevAction && prevAction.protected) {
            return;
        }
        this.registeredActions.set(action.actionName, action);
        actionsMenuStore.addAction(action.actionName, action.callback);
        this.updateIsClickable();
    }

    public unregisterActionsMenuAction(actionName: string) {
        this.registeredActions.delete(actionName);
        actionsMenuStore.removeAction(actionName);
        this.updateIsClickable();
    }

    public activate(): void {
        this.toggleActionsMenu();
    }

    public destroy(): void {
        this.actionsMenuStoreUnsubscriber();
        actionsMenuStore.clear();
        super.destroy();
    }

    public isActivatable(): boolean {
        return this.isClickable();
    }

    private updateIsClickable(): void {
        // this.setClickable(this.registeredActions.length > 0);
        this.setClickable(true);
    }

    private toggleActionsMenu(): void {
        if (this.isActionsMenuInitialized) {
            actionsMenuStore.clear();
            return;
        }
        actionsMenuStore.initialize(this.playerName);
        for (const action of this.registeredActions.values()) {
            actionsMenuStore.addAction(action.actionName, action.callback);
        }
    }

    private registerDefaultActionsMenuActions(): void {
        if (this.visitCardUrl) {
            this.registeredActions.set("Business Card", {
                actionName: "Business Card",
                protected: true,
                callback: () => {
                    requestVisitCardsStore.set(this.visitCardUrl);
                    actionsMenuStore.clear();
                },
            });
        }
    }

    private bindEventHandlers(): void {
        this.on(Phaser.Input.Events.POINTER_DOWN, (event: Phaser.Input.Pointer) => {
            if (event.downElement.nodeName === "CANVAS" && event.leftButtonDown()) {
                this.toggleActionsMenu();
                this.emit(RemotePlayerEvent.Clicked);
            }
        });
    }
}
