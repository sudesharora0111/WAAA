import { MonitoringInterface } from "./../../services/MonitoringInterface";
import { AuthenticatedProviderController } from "./AuthenticatedProviderController";
import { WokaList } from "@workadventure/messages";
import type { Server } from "hyper-express";
import type { JWTTokenManager } from "../services/JWTTokenManager";
import type { WokaServiceInterface } from "../services/WokaServiceInterface";

/**
 * A controller to expose the woka list
 */
export class WokaListController extends AuthenticatedProviderController<WokaList> {
    private wokaService: WokaServiceInterface | undefined;
    constructor(protected app: Server, protected jwtTokenManager: JWTTokenManager, monitoringInterface: MonitoringInterface) {
        super(app, jwtTokenManager, monitoringInterface);
    }

    public setWokaService(wokaService: WokaServiceInterface) {
        this.wokaService = wokaService;
    }

    protected getData(roomUrl: string, uuid: string): Promise<WokaList | undefined> {
        return this.wokaService?.getWokaList(roomUrl, uuid) || Promise.resolve(undefined);
    }

    routes(): void {
        super.setupRoutes("/woka/list");
    }
}
