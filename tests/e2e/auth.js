export const testUser = {handle: 'tester', name: 'Tester', avatar_url: 'https://example.test/avatar.png'};

// Mocks dev/null's sign-in: the authorize page approves at once and redirects to its redirect_uri,
// and redeeming the code approves the device.
export async function mockSignIn(target) {
  await target.route('https://dev-null.sh/mobile/authorize?**', route => {
    const params = new URL(route.request().url()).searchParams;
    const back = new URL(params.get('redirect_uri'));
    back.searchParams.set('code', 'test-code');
    back.searchParams.set('state', params.get('state'));
    return route.fulfill({status: 303, headers: {Location: back.href}});
  });
  await target.route('**/api/v1/devices', route => route.fulfill({json: {data: testUser}}));
}

// Signs in through the app's own auth module on a page that doesn't run the globe, so each test
// still starts without a cached session.
export async function signIn(page) {
  await mockSignIn(page);
  await page.goto('/src/styles.css');
  await page.evaluate(async () => {
    const auth = await import('/src/services/auth.js');
    const url = new URL(await auth.beginSignIn());
    await auth.finishSignIn({code: 'test-code', state: url.searchParams.get('state')});
  });
}
