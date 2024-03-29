import { get, writable } from "svelte/store";
import type { CoWebsite } from "../WebRtc/CoWebsite/CoWebsite";
import { Subject } from "rxjs";


export function createCoWebsiteStore() {
    const { subscribe, set, update } = writable<Array<CoWebsite>>([]);

    const add = (coWebsite: CoWebsite, position?: number) => {
        if (position || position === 0) {
            update((currentArray) => {
                const newArray = [...currentArray];
                if (position === 0) {
                    newArray.unshift(coWebsite);
                } else if (currentArray.length > position) {
                    newArray.splice(position, 0, coWebsite);
                } else {
                    newArray.push(coWebsite);
                }
                return newArray;
            });
        } else {
            update((currentArray) => [...currentArray, coWebsite]);
        }
    };

    const remove = (coWebsite: CoWebsite) => {
        update((currentArray) => currentArray.filter((currentCoWebsite) => currentCoWebsite.getId() !== coWebsite.getId()));
    };

    const empty = () => set([]);

    return {
        subscribe,
        add,
        remove,
        empty,
    };
}



export const coWebsites = createCoWebsiteStore();

export class CoWebsiteManager {

//Fichier App.svelte dans component
    private _onResize: Subject<void> = new Subject();
    public onResize = this._onResize.asObservable();


//Méthode pour ajout load et retrait au store
    public addCoWebsiteToStore(coWebsite: CoWebsite) {
        coWebsites.add(coWebsite);
    }


    public loadCoWebsite(coWebsite: CoWebsite) {
        coWebsite.load().catch(() => {"error loading coWebsite"});
    }


    public removeCoWebsiteToStore(coWebsite: CoWebsite) {
        coWebsites.remove(coWebsite);
    }


    public generateUniqueId() {
        let id = undefined;
        do {
            id = "cowebsite-iframe-" + (Math.random() + 1).toString(36).substring(7);
        } while (this.getCoWebsiteById(id));

        return id;
    }


    public getCoWebsiteById(coWebsiteId: string): CoWebsite | undefined {
        return get(coWebsites).find((coWebsite: CoWebsite) => {
            return coWebsite.getId() === coWebsiteId;
        });
    }


    public getCoWebsites() {
        return get(coWebsites);
    }


    public closeCoWebsites(): void {
        get(coWebsites).forEach((coWebsite: CoWebsite) => {
            this.closeCoWebsite(coWebsite);
        });
    }


    public closeCoWebsite(coWebsite: CoWebsite): void {
        this.removeCoWebsiteToStore(coWebsite);
    }


    public unloadCoWebsite(coWebsite: CoWebsite): Promise<void> {
        return new Promise<void>((resolve, reject) => {
        });
    }

    //Fonction dans le fichier WaScaleManager.ts

    public getGameSize(): { width: number; height: number } {
        return {
            width: window.innerWidth,
            height: window.innerHeight,
        };
    }

    // Fonction dans la game scene

    public cleanup(): void {
        this.closeCoWebsites();
    }

}



export const coWebsiteManager = new CoWebsiteManager();
