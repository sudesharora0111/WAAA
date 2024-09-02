import { expect, test } from "@playwright/test";
import Map from "./utils/map";
import AreaEditor from "./utils/map-editor/areaEditor";
import EntityEditor from "./utils/map-editor/entityEditor";
import { resetWamMaps } from "./utils/map-editor/uploader";
import MapEditor from "./utils/mapeditor";
import Menu from "./utils/menu";
import { login } from "./utils/roles";
import { map_storage_url } from "./utils/urls";
import { oidcAdminTagLogin } from "./utils/oidc";

test.setTimeout(240_000); // Fix Webkit that can take more than 60s
test.use({
  baseURL: map_storage_url,
});

test.describe("Map editor interacting with object @oidc", () => {
  test.beforeEach(
    "Ignore tests on mobilechromium because map editor not available for mobile devices",
    ({}, { project }) => {
      //Map Editor not available on mobile
      if (project.name === "mobilechromium") {
        //eslint-disable-next-line playwright/no-skipped-test
        test.skip();
        return;
      }
    }
  );

  test("Success to interact with area", async ({
    page,
    browser,
    request,
    browserName,
  }, { project }) => {
    // Go to the map
    await resetWamMaps(request);
    await page.goto(Map.url("empty"));
    await login(page, "Bob", 2, "en-US", project.name === "mobilechromium");
    await oidcAdminTagLogin(page, false);

    // Create area on the map for the test
    await Menu.openMapEditor(page);
    await MapEditor.openAreaEditor(page);
    await AreaEditor.drawArea(
      page,
      { x: 13 * 32, y: 13 * 32 },
      { x: 15 * 32, y: 15 * 32 }
    );
    await AreaEditor.setAreaName(page, "MyLinkZone");
    await AreaEditor.addProperty(page, "Open Link");
    await AreaEditor.setOpenLinkProperty(
      page,
      "https://workadventu.re",
      "Show action toast with message"
    );
    await Menu.closeMapEditor(page);

    // Walk to the area
    await Map.teleportToPosition(page, 9 * 32, 9 * 32);

    // Test if the DomElement generated by the character is visible
    await expect(page.locator("span.characterTriggerAction")).toBeVisible();
  });

  test("Success to interact with entity", async ({
    page,
    browser,
    request,
    browserName,
  }, { project }) => {
    // Skip the test on Webkit because the click up doesn't work
    if (browserName === "webkit") {
      //eslint-disable-next-line playwright/no-skipped-test
      test.skip();
      return;
    }

    // Go to the map
    await resetWamMaps(request);
    await page.goto(Map.url("empty"));
    await login(page, "Bob", 3, "en-US", project.name === "mobilechromium");
    await oidcAdminTagLogin(page, false);

    // Create entity on the map for the test
    await Menu.openMapEditor(page);
    await MapEditor.openEntityEditor(page);
    await EntityEditor.selectEntity(page, 0, "small table");
    await EntityEditor.moveAndClick(page, 14 * 32, 13 * 32);
    await EntityEditor.clearEntitySelection(page);
    await EntityEditor.moveAndClick(page, 14 * 32, 13 * 32);
    await EntityEditor.setEntityName(page, "My Open Link");
    await EntityEditor.addProperty(page, "Open Link");
    await EntityEditor.setOpenLinkProperty(page, "https://workadventu.re");
    await Menu.closeMapEditor(page);

    // Refresh the page to see the entity
    await page.reload();

    // Move to the entity
    await EntityEditor.moveAndRightClick(page, 13 * 32, 13 * 32);

    // Test if the DomElement generated by the character is visible
    await expect(page.locator("span.characterTriggerAction")).toBeVisible();
  });
});
