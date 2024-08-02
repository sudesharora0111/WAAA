import {expect, Page} from "@playwright/test";
import {expectInViewport} from "./viewport";

class Menu {

    async openChat(page: Page) {
        await page.click('div#chat-btn');
        await expectInViewport('#chatWindow', page);
        await expect(page.locator('div#chat-action')).toHaveClass(/hidden/);
        await expect(page.locator('#chatWindow')).toHaveClass(/show/);
    }

    async openMapEditor(page: Page) {
        await page.locator('#action-admin').click();
        await page.locator('#map-editor').click();
        await expect(await page.locator('#map-editor')).toBeHidden();
        // await expect(await page.getByRole('button', {name: 'toggle-map-editor'}).first()).toHaveClass(/border-top-light/);
    }

    async openMenu(page: Page) {
        await page.locator('#action-admin').click({timeout: 10_000});
        await expect(await page.locator('#profile-menu')).toHaveClass(/backdrop-blur/);
    }

    async openMenuAdmin(page: Page) {
        // await page.pause();
        await page.locator('#action-admin').click();
        await expect(await page.locator('#admin-menu')).toHaveClass(/backdrop-blur/);
    }

    async closeMenu(page: Page) {
        await page.locator('.menu-container').getByRole('button', { name: '×' }).click();
        await expect(await page.locator('#menuIcon')).not.toHaveClass(/border-top-light/);
    }

    async closeMapEditor(page: Page) {
        await page.locator('.map-editor .configure-my-room .close-window').click()
        await page.locator('.map-editor .sidebar .close-window').click()
        await expect(await page.locator('.map-editor .configure-my-room .close-window')).toBeHidden();
    }

    async toggleMegaphoneButton(page: Page) {
        await page.locator('#action-admin').click({timeout: 10_000});
        await page.getByTestId('global-message').click({timeout: 10_000});
    }

    async isThereMegaphoneButton(page: Page) {
        await page.locator('.configure-my-room .content .items-center #megaphone');
    }

    async isNotThereMegaphoneButton(page: Page) {
        await expect(await page.locator('.bottom-action-bar .bottom-action-button #megaphone')).toBeHidden({timeout: 30_000});
    }

    async openStatusList(page : Page){
        await page.click('#AvailabilityStatus');
    }

    async clickOnStatus(page:Page,status: string){
        await this.openStatusList(page);
        await expect(page.getByText(status)).toBeVisible();
        await page.getByText(status).click();
        //eslint-disable-next-line playwright/no-wait-for-timeout
        await page.waitForTimeout(500);
    }

    async turnOnCamera(page:Page){
        if(await page.getByAltText('Turn off webcam').isVisible()) return;
        await page.getByAltText('Turn on webcam').click();
        await expect(page.getByAltText('Turn off webcam')).toBeVisible();
    }
    async turnOffCamera(page:Page){
        if(await page.getByAltText('Turn on webcam').isVisible()) return;
        await page.getByAltText('Turn off webcam').click();
        await expect(page.getByAltText('Turn on webcam')).toBeVisible();
    }
    async turnOnMicrophone(page:Page){
        if(await page.getByAltText('Turn off microphone').isVisible()) return;
        await page.getByAltText('Turn on microphone').click();
        await expect(page.getByAltText('Turn off microphone')).toBeVisible();
    }
    async turnOffMicrophone(page:Page){
        if(await page.getByAltText('Turn on microphone').isVisible()) return;
        await page.getByAltText('Turn off microphone').click();
        await expect(page.getByAltText('Turn on microphone')).toBeVisible();
    }

    async closeNotificationPopUp(page:Page){
        if(await page.getByRole('button',{name:'Continue without notification'}).isHidden())return;
        await page.getByRole('button',{name:'Continue without notification'}).click();
        await expect(page.getByRole('button',{name:'Continue without notification'})).toBeVisible();

    }
    async closeCameraPopUp(page:Page){
        if(await page.getByRole('button',{name:'Continue without webcam'}).isHidden())return;
        await page.getByRole('button',{name:'Continue without webcam'}).click();
        await expect(page.getByRole('button',{name:'Continue without webcam'})).toBeVisible();

    }
}

export default new Menu();
