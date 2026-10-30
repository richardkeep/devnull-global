import {test, expect} from '@playwright/test';

const members = Array.from({length: 12}, (_, index) => ({
  handle: `developer-${String(index).padStart(2, '0')}`, name: `Developer ${index}`,
  location: 'Canada', latitude: 10, longitude: 15, avatar_url: 'https://example.test/avatar.png'
}));

test.beforeEach(async ({page}) => {
  await page.route(/\.(png|jpe?g|svg|webp)(\?.*)?$/, route => route.fulfill({
    contentType: 'image/png',
    body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j5ZkAAAAASUVORK5CYII=', 'base64')
  }));
  await page.route('**/api/v1/users/**', route => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/following')) return route.fulfill({json: {data: members}});
    const handle = path.split('/').pop();
    return route.fulfill({json: {data: {...members.find(user => user.handle === handle), commits_count: 1, followers_count: 2, following_count: 3}}});
  });
});

async function openCluster(page) {
  await page.goto('/', {waitUntil: 'domcontentloaded'});
  const cluster = page.locator('.marker-cluster');
  await expect(cluster.getByRole('button')).toBeVisible();
  await expect(cluster.locator('.person:visible')).toHaveCount(3);
  await expect(cluster.getByRole('button', {name: 'Zoom in to see 12 developers at Canada'})).toHaveText('12');
  return cluster;
}

test('expands shared coordinates into distinct, interactive avatars', async ({page}) => {
  const cluster = await openCluster(page);
  // The globe rotates continuously, so its count button never becomes stationary.
  await cluster.getByRole('button').click({force: true});
  await expect(cluster).toHaveClass(/expanded/);
  await expect(cluster.locator('.person:visible')).toHaveCount(12);
  await expect(cluster.getByRole('button')).toHaveCount(0);
  const boxes = await cluster.locator('.person').evaluateAll(markers => markers.map(marker => {
    const {x, y, width, height} = marker.getBoundingClientRect();
    return {x, y, width, height};
  }));
  for (let i = 0; i < boxes.length; i++) {
    for (let j = 0; j < i; j++) {
      const a = boxes[i], b = boxes[j];
      // Avatars are circles; compare their centres rather than square corners.
      expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThanOrEqual(51.9);
    }
  }
  for (const handle of [members[0].handle, members[11].handle]) {
    await cluster.locator(`[data-handle="${handle}"]`).focus();
    await expect(page.getByRole('dialog')).toContainText('@' + handle);
  }
});

test('opens a cluster by keyboard and collapses it when zooming back out', async ({page}) => {
  const cluster = await openCluster(page);
  const button = cluster.getByRole('button');
  await button.focus();
  await button.press('Enter');
  await expect(cluster).toHaveClass(/expanded/);
  await expect(cluster.locator('.person').first()).toBeFocused();
  // Clear the profile, then zoom out over open globe space.
  await page.locator('#collapse-toggle').focus();
  await expect(page.getByRole('dialog')).toBeHidden();
  const viewport = page.viewportSize();
  await page.mouse.move(viewport.width - 20, viewport.height - 20);
  await page.mouse.wheel(0, 2400);
  await expect(cluster).not.toHaveClass(/expanded/);
  await expect(cluster.locator('.person:visible')).toHaveCount(3);
  await expect(cluster.getByRole('button')).toBeVisible();
});
