import { test, expect } from '@playwright/test';

const user = (handle, lat, lng) => ({
  handle, name: handle, location: 'Nairobi, Kenya', latitude: lat, longitude: lng,
  avatar_url: 'https://example.test/avatar.png'
});

test.beforeEach(async ({ page }) => {
  // Keep image downloads from delaying the short automatic pagination timer.
  await page.route(/\.(png|jpe?g|svg)(\?.*)?$/, route => route.fulfill({
    contentType: 'image/png',
    body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j5ZkAAAAASUVORK5CYII=', 'base64')
  }));
  await page.route('**/api/v1/users/**', async route => {
    const url = new URL(route.request().url());
    const mode = url.pathname.endsWith('/followers') ? 'followers' : 'following';
    const second = url.searchParams.has('page');
    const data = second ? [user('second-user', -1.28, 36.82)] :
      [user(mode + '-user', -1.29, 36.81), { handle: 'no-location', name: 'No location' }];
    await route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ data, links: { next: second ? null : url.pathname + '?page=2' } })
    });
  });
});

test('loads users, skips missing locations and paginates on demand', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#status')).toContainText('on globe');
  if (await page.locator('.panel').evaluate(el => el.classList.contains('collapsed'))) await page.locator('#collapse-toggle').click();
  await page.locator('#auto').click();
  await expect(page.locator('#countdown')).toHaveText('Automatic loading paused');
  await expect(page.locator('#status')).toContainText('1 on globe');
  await expect(page.locator('#status')).toContainText('2 fetched');
  await expect(page.locator('.person')).toHaveCount(1);
  await page.getByRole('button', { name: 'Load 30 more' }).click();
  await expect(page.locator('.person')).toHaveCount(2);
  await expect(page.getByRole('button', { name: 'All pages loaded' })).toBeDisabled();
});

test('switches between following and followers', async ({ page }) => {
  await page.goto('/');
  if (await page.locator('.panel').evaluate(el => el.classList.contains('collapsed'))) await page.locator('#collapse-toggle').click();
  await expect(page.locator('.person')).toHaveCount(1);
  await page.getByRole('button', { name: 'Followers', exact: true }).click();
  await expect(page.locator('#heading')).toContainText('Followers');
  await expect(page.locator('.person[data-handle="followers-user"]')).toHaveCount(1);
});

test('control panel collapse is persisted', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#collapse-toggle')).toBeVisible();
  const toggle = page.locator('#collapse-toggle');
  const before = await toggle.getAttribute('aria-expanded');
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', before === 'true' ? 'false' : 'true');
  await page.reload();
  await expect(toggle).toHaveAttribute('aria-expanded', before === 'true' ? 'false' : 'true');
});

test('shows the API error and stops automatic loading', async ({ page }) => {
  await page.route('**/api/v1/users/**', route => route.fulfill({
    status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'test failure' })
  }));
  await page.goto('/?user=error-case');
  await expect(page.locator('#error')).toContainText('500');
  await expect(page.locator('#auto')).toContainText('Resume auto-load');
});

async function expandPanel(page) {
  if (await page.locator('#collapse-toggle').getAttribute('aria-expanded') === 'false') {
    await page.locator('#collapse-toggle').click();
  }
}

test('looks up a username and preserves the selected mode in the URL', async ({ page }) => {
  await page.goto('/?user=tom&mode=followers');
  await expect(page.locator('#status')).toContainText('on globe');
  await expandPanel(page);
  await page.getByRole('textbox', { name: 'dev/null username' }).fill('Alice');
  await page.getByRole('button', { name: 'Show globe' }).click();
  await expect(page.locator('#heading')).toHaveText("🌍 alice's Followers");
  await expect(page.locator('#handle')).toHaveValue('alice');
  await expect(page).toHaveURL(/\?user=alice&mode=followers$/);
  await expect(page.locator('[data-mode="followers"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#status')).toContainText('1 on globe');
});

test('restores cached users and the paused auto-load preference', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#status')).toContainText('on globe');
  await expandPanel(page);
  await page.locator('#auto').click();
  await expect(page.locator('#countdown')).toHaveText('Automatic loading paused');
  let requests = 0;
  page.on('request', request => {
    if (request.url().includes('/api/v1/users/')) requests++;
  });
  await page.reload();
  await expect(page.locator('#status')).toContainText('(restored)');
  await expect(page.locator('.person')).toHaveCount(1);
  await expect(page.locator('#auto')).toHaveText('▶ Resume auto-load');
  expect(requests).toBe(0);
});

test('pauses and resumes automatic pagination', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#status')).toContainText('on globe');
  await expandPanel(page);
  await page.locator('#auto').click();
  await expect(page.locator('#auto')).toHaveAttribute('aria-pressed', 'false');
  await page.waitForTimeout(3300);
  await expect(page.locator('.person')).toHaveCount(1);
  await page.locator('#auto').click();
  await expect(page.locator('#countdown')).toContainText('Loading 30 more devs in');
  await expect(page.locator('.person')).toHaveCount(2);
  await expect(page.locator('#auto')).toBeDisabled();
});

test('renders a profile card from keyboard focus and rejects unsafe links', async ({ page }) => {
  await page.route('**/api/v1/users/**', route => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({data: [{...user('profile-user', -1.29, 36.81),
      bio: 'Builds things', company: 'Example', github_url: 'https://github.com/example',
      website: 'javascript:alert(1)'
    }]})
  }));
  await page.goto('/');
  const marker = page.locator('.person');
  await expect(marker).toBeVisible();
  await marker.focus();
  const card = page.getByRole('dialog', { name: 'User details' });
  await expect(card).toBeVisible();
  await expect(card).toContainText('Builds things');
  await expect(card).toContainText('Example');
  await expect(card.getByRole('link', { name: '↗ GitHub' })).toHaveAttribute('href', 'https://github.com/example');
  await expect(card.getByRole('link', { name: '↗ Website' })).toHaveCount(0);
  await expect(marker).toHaveClass(/profile-selected/);
  await card.getByRole('link', { name: '↗ GitHub' }).focus();
  await expect(card).toBeVisible();
  await page.locator('#collapse-toggle').focus();
  await expect(card).toBeHidden();
  await expect(page.locator('body')).not.toHaveClass(/profile-active/);
});
