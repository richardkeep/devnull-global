import {test, expect} from '@playwright/test';

const profileUser = handle => ({handle, name: handle, location: 'Nairobi', latitude: 0, longitude: 15,
  avatar_url: 'https://example.test/avatar.png'});

const counts = {commits_count: 1594, followers_count: 12177, following_count: 12472};

test.beforeEach(async ({page}) => {
  await page.route(/\.(png|jpe?g|svg|webp)(\?.*)?$/, route => route.fulfill({
    contentType: 'image/png',
    body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j5ZkAAAAASUVORK5CYII=', 'base64')
  }));
  await page.route('**/api/v1/users/*/following', route => route.fulfill({json: {data: [profileUser('tom')]}}));
});

test('loads profile details on hover and reuses them on later hovers', async ({page}) => {
  let requests = 0;
  let release;
  const ready = new Promise(resolve => { release = resolve; });
  await page.route('**/api/v1/users/tom', async route => {
    requests++;
    await ready;
    await route.fulfill({json: {data: {...profileUser('tom'), bio: 'Full profile biography', ...counts}}});
  });
  await page.goto('/', {waitUntil: 'domcontentloaded'});
  const marker = page.locator('.person');
  await expect(marker).toBeVisible();
  expect(requests).toBe(0);
  // The auto-rotating globe keeps markers moving; skip the stability wait.
  await marker.hover({force: true});
  const card = page.getByRole('dialog', {name: 'User details'});
  await expect(card).toBeVisible();
  await expect(card).toHaveAttribute('aria-busy', 'true');
  await expect(card.getByRole('status')).toHaveText('Loading profile details…');
  release();
  await expect(card).toHaveAttribute('aria-busy', 'false');
  await expect(card).toContainText('Full profile biography');
  await expect(card.locator('.profile-stats dd')).toHaveText(['1,594', '12,177', '12,472']);
  await page.mouse.move(0, 0);
  await expect(card).toBeHidden();
  // The auto-rotating globe keeps markers moving; skip the stability wait.
  await marker.hover({force: true});
  await expect(card).toBeVisible();
  await expect(card.locator('.profile-stats dd')).toHaveText(['1,594', '12,177', '12,472']);
  expect(requests).toBe(1);
});

test('keeps the basic profile visible when details cannot be fetched', async ({page}) => {
  await page.route('**/api/v1/users/tom', route => route.fulfill({status: 429, json: {error: 'Rate limited'}}));
  await page.goto('/', {waitUntil: 'domcontentloaded'});
  const marker = page.locator('.person');
  await expect(marker).toBeVisible();
  await marker.focus();
  const card = page.getByRole('dialog', {name: 'User details'});
  await expect(card).toBeVisible();
  await expect(card.getByRole('status')).toContainText('HTTP 429');
  await expect(card).toContainText('@tom');
  await expect(card).toHaveAttribute('aria-busy', 'false');
  await expect(card.locator('.profile-stats dd')).toHaveText(['—', '—', '—']);
});

test('does not overwrite a new card with an earlier profile response', async ({page}) => {
  await page.route('**/api/v1/users/*/following', route => route.fulfill({json: {
    data: [profileUser('tom'), {...profileUser('alice'), longitude: 45}]
  }}));
  let release;
  const ready = new Promise(resolve => { release = resolve; });
  await page.route('**/api/v1/users/tom', async route => {
    await ready;
    await route.fulfill({json: {data: {...profileUser('tom'), ...counts}}});
  });
  await page.route('**/api/v1/users/alice', route => route.fulfill({json: {data: {
    ...profileUser('alice'), commits_count: 0, followers_count: 5, following_count: 10
  }}}));
  await page.goto('/', {waitUntil: 'domcontentloaded'});
  const tom = page.locator('.person[data-handle="tom"]');
  const alice = page.locator('.person[data-handle="alice"]');
  await expect(tom).toBeVisible();
  await expect(alice).toBeVisible();
  await tom.focus();
  const card = page.getByRole('dialog', {name: 'User details'});
  await expect(card).toHaveAttribute('aria-busy', 'true');
  const aborted = page.waitForEvent('requestfailed', request => new URL(request.url()).pathname === '/api/v1/users/tom');
  await alice.focus();
  await aborted;
  release();
  await expect(card).toContainText('@alice');
  await expect(card.locator('.profile-stats dd')).toHaveText(['0', '5', '10']);
});
