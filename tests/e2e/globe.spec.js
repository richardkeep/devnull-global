import { test, expect } from '@playwright/test';

const user = (handle, lat, lng) => ({
  handle, name: handle, location: 'Nairobi, Kenya', latitude: lat, longitude: lng,
  avatar_url: 'https://example.test/avatar.png'
});

test.beforeEach(async ({ page }) => {
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
  await expect(page.locator('#status')).toContainText('1 on globe');
  await expect(page.locator('#status')).toContainText('2 fetched');
  await expect(page.locator('.person')).toHaveCount(1);
  await page.getByRole('button', { name: 'Load 30 more' }).click();
  await expect(page.locator('.person')).toHaveCount(2);
  await expect(page.getByRole('button', { name: 'All pages loaded' })).toBeDisabled();
});

test('switches between following and followers', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.person')).toHaveCount(1);
  await page.getByRole('button', { name: 'Followers', exact: true }).click();
  await expect(page.locator('#heading')).toContainText('Followers');
  await expect(page.locator('.person[data-handle="followers-user"]')).toHaveCount(1);
});

test('control panel collapse is persisted', async ({ page }) => {
  await page.goto('/');
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
