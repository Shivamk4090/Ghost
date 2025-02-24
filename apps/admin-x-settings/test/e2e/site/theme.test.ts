import {expect, test} from '@playwright/test';
import {globalDataRequests, limitRequests, mockApi, responseFixtures} from '../../utils/e2e';

test.describe('Theme settings', async () => {
    test('Browsing and installing default themes', async ({page}) => {
        const {lastApiRequests} = await mockApi({page, requests: {
            ...globalDataRequests,
            browseThemes: {method: 'GET', path: '/themes/', response: responseFixtures.themes},
            installTheme: {method: 'POST', path: /^\/themes\/install\/\?/, response: {
                themes: [{
                    name: 'headline',
                    package: {},
                    active: false,
                    templates: []
                }]
            }},
            activateTheme: {method: 'PUT', path: '/themes/headline/activate/', response: {
                themes: [{
                    name: 'headline',
                    package: {},
                    active: true,
                    templates: []
                }]
            }}
        }});

        await page.goto('/');

        const designSection = page.getByTestId('design');

        await designSection.getByRole('button', {name: 'Customize'}).click();

        const designModal = page.getByTestId('design-modal');

        await designModal.getByTestId('change-theme').click();

        const modal = page.getByTestId('theme-modal');

        // The default theme is always considered "installed"

        await modal.getByRole('button', {name: /Casper/}).click();

        await expect(modal.getByRole('button', {name: 'Activate Casper'})).toBeVisible();

        await expect(page.locator('iframe[title="Theme preview"]')).toHaveAttribute('src', 'https://demo.ghost.io/');

        await modal.getByRole('button', {name: 'Change theme'}).click();

        // Try installing another theme

        await modal.getByRole('button', {name: /Headline/}).click();

        await modal.getByRole('button', {name: 'Install Headline'}).click();

        await expect(page.getByTestId('confirmation-modal')).toHaveText(/successfully installed/);

        await page.getByRole('button', {name: 'Activate'}).click();

        await expect(page.getByTestId('toast')).toHaveText(/headline is now your active theme/);

        expect(lastApiRequests.installTheme?.url).toMatch(/\?source=github&ref=TryGhost%2FHeadline/);
    });

    test('Managing installed themes', async ({page}) => {
        const {lastApiRequests} = await mockApi({page, requests: {
            ...globalDataRequests,
            browseThemes: {method: 'GET', path: '/themes/', response: responseFixtures.themes},
            activateTheme: {method: 'PUT', path: '/themes/casper/activate/', response: {
                themes: [{
                    ...responseFixtures.themes.themes.find(theme => theme.name === 'casper')!,
                    active: true
                }]
            }},
            deleteTheme: {method: 'DELETE', path: '/themes/edition/', response: {}}
        }});

        await page.goto('/');

        const designSection = page.getByTestId('design');

        await designSection.getByRole('button', {name: 'Customize'}).click();

        const designModal = page.getByTestId('design-modal');

        await designModal.getByTestId('change-theme').click();

        const modal = page.getByTestId('theme-modal');

        await modal.getByRole('tab', {name: 'Installed'}).click();

        await expect(modal.getByTestId('theme-list-item')).toHaveCount(2);

        const casper = modal.getByTestId('theme-list-item').filter({hasText: /casper/});
        const edition = modal.getByTestId('theme-list-item').filter({hasText: /edition/});

        // Activate the inactive theme

        await expect(casper.getByRole('button', {name: 'Activate'})).toBeVisible();
        await expect(edition).toHaveText(/Active/);

        await casper.getByRole('button', {name: 'Activate'}).click();

        await expect(casper).toHaveText(/Active/);
        await expect(edition.getByRole('button', {name: 'Activate'})).toBeVisible();

        expect(lastApiRequests.activateTheme?.url).toMatch(/\/themes\/casper\/activate\//);

        // Download the active theme

        await casper.getByRole('button', {name: 'Menu'}).click();
        await page.getByTestId('popover-content').getByRole('button', {name: 'Download'}).click();

        await expect(page.locator('iframe#iframeDownload')).toHaveAttribute('src', /\/api\/admin\/themes\/casper\/download/);

        // Delete the inactive theme

        await edition.getByRole('button', {name: 'Menu'}).click();
        await page.getByTestId('popover-content').getByRole('button', {name: 'Delete'}).click();

        const confirmation = page.getByTestId('confirmation-modal');
        await confirmation.getByRole('button', {name: 'Delete'}).click();

        await expect(modal.getByTestId('theme-list-item')).toHaveCount(1);

        expect(lastApiRequests.deleteTheme?.url).toMatch(/\/themes\/edition\/$/);
    });

    test('Uploading a new theme', async ({page}) => {
        const {lastApiRequests} = await mockApi({page, requests: {
            ...globalDataRequests,
            browseThemes: {method: 'GET', path: '/themes/', response: responseFixtures.themes},
            uploadTheme: {method: 'POST', path: '/themes/upload/', response: {
                themes: [{
                    name: 'mytheme',
                    package: {},
                    active: false,
                    templates: []
                }]
            }}
        }});

        await page.goto('/');

        const designSection = page.getByTestId('design');

        await designSection.getByRole('button', {name: 'Customize'}).click();

        const designModal = page.getByTestId('design-modal');

        await designModal.getByTestId('change-theme').click();

        const modal = page.getByTestId('theme-modal');

        const fileChooserPromise = page.waitForEvent('filechooser');

        await modal.locator('label[for=theme-upload]').click();

        const fileChooser = await fileChooserPromise;
        await fileChooser.setFiles(`${__dirname}/../../utils/responses/theme.zip`);

        await expect(page.getByTestId('confirmation-modal')).toHaveText(/successful/);

        await expect(modal.getByTestId('theme-list-item')).toHaveCount(3);

        expect(lastApiRequests.uploadTheme).toBeTruthy();
    });

    test('Limits uploading new themes', async ({page}) => {
        await mockApi({page, requests: {
            ...globalDataRequests,
            ...limitRequests,
            browseThemes: {method: 'GET', path: '/themes/', response: responseFixtures.themes},
            browseConfig: {
                ...globalDataRequests.browseConfig,
                response: {
                    config: {
                        ...responseFixtures.config.config,
                        hostSettings: {
                            limits: {
                                customThemes: {
                                    allowlist: ['casper'],
                                    error: 'Upgrade to enable custom themes'
                                }
                            }
                        }
                    }
                }
            }
        }});

        await page.goto('/');

        const designSection = page.getByTestId('design');

        await designSection.getByRole('button', {name: 'Customize'}).click();

        const designModal = page.getByTestId('design-modal');

        await designModal.getByTestId('change-theme').click();

        const modal = page.getByTestId('theme-modal');

        await modal.getByRole('button', {name: 'Upload theme'}).click();

        await expect(page.getByTestId('limit-modal')).toHaveText(/Upgrade to enable custom themes/);
    });
});
