import { test, expect, type Page } from '@playwright/test';

const publicOrigin = 'https://catalog.brutti.my';
const adminOrigin = 'https://admincatalog.brutti.my';
const api = 'https://lgdjoxafleqnbomtfzqt.supabase.co';
const user = { id: '90000000-0000-4000-8000-000000000001', email: 'domain-fixture@example.invalid', aud: 'authenticated', role: 'authenticated', user_metadata: { full_name: 'Domain Fixture' } };
const token = `e30.${Buffer.from(JSON.stringify({ sub: user.id, exp: 4102444800, role: 'authenticated' })).toString('base64url')}.fixture`;
const productId = '90000000-0000-4000-8000-000000000002';
const pixel = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=', 'base64');
const product = {
  id: productId, name: 'Domain fixture table', sku: 'TEST-01', category_id: 'cat-1',
  description: 'A product for isolated routing tests.', materials: 'Timber',
  width: 50, depth: 60, height: 70, price: 350, status: 'published', availability: 'available', featured: false,
  created_at: '2026-11-27T00:00:00Z', updated_at: '2026-11-27T00:00:00Z',
  images: [{ id: 'fixture-photo', alt: 'Domain fixture table', url: `${api}/storage/v1/object/public/product-images/fixture.png` }],
};

async function fixture(page: Page, acceptedLogin = false) {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => {
    if (message.type() === 'error' && !message.text().includes('400 (Bad Request)')) errors.push(message.text() + ' ' + message.location().url);
  });
  page.on('requestfailed', request => {
    if (request.failure()?.errorText !== 'net::ERR_ABORTED') errors.push(`Request failed: ${request.url()} ${request.failure()?.errorText}`);
  });
  page.on('response', response => {
    if (response.status() >= 400 && !response.url().includes('/auth/v1/token')) errors.push(`HTTP ${response.status()}: ${new URL(response.url()).pathname}`);
  });
  await page.routeWebSocket('**/realtime/v1/websocket**', () => {});
  // Isolate routing/layout from the test runner's unavailable Google Fonts network.
  // Product images and all application assets still have to load successfully.
  await page.route('https://fonts.googleapis.com/**', route => route.fulfill({
    status: 200, contentType: 'text/css', body: '',
  }));
  // The custom hostnames are simulated against our production build. No DNS
  // claim or real certificate validation is implied by these browser tests.
  for (const origin of [publicOrigin, adminOrigin, 'https://brutti-catalog.pages.dev', 'https://brutti-team.github.io']) {
    await page.route(`${origin}/**`, async route => {
      const url = new URL(route.request().url());
      const response = await route.fetch({ url: `http://127.0.0.1:5191${url.pathname}${url.search}` });
      await route.fulfill({ response });
    });
  }
  await page.route(`${api}/**`, async route => {
    const req = route.request(), path = new URL(req.url()).pathname;
    const json = (value: unknown) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(value) });
    if (path === '/auth/v1/token') {
      if (acceptedLogin) return json({ access_token: token, refresh_token: 'test-refresh', expires_in: 3600, expires_at: 4102444800, token_type: 'bearer', user });
      return route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ code: 'invalid_credentials', message: 'Invalid login credentials' }) });
    }
    if (path === '/auth/v1/user') return json(user);
    if (path === '/auth/v1/logout') return json({});
    if (path.endsWith('/products')) return json([product]);
    if (path.endsWith('/categories')) return json([{ id: 'cat-1', name: 'Tables', slug: 'tables' }]);
    if (path.endsWith('/catalog_admins')) return json({ user_id: user.id });
    if (path.endsWith('/rpc/catalog_capabilities')) return json({ ordering: false, imageCleanup: false, priceBasis: false });
    if (path.endsWith('/rpc/catalog_product_models_enabled')) return json(false);
    if (path.endsWith('/rpc/catalog_my_role')) return json('admin');
    if (path.endsWith('/rpc/catalog_customer_insights')) return json({});
    if (path.includes('/storage/v1/object/public/')) return route.fulfill({ status: 200, contentType: 'image/png', body: pixel });
    if (path.includes('/rpc/')) return json({});
    return json([]);
  });
  return errors;
}

for (const width of [1440, 390]) {
  test(`public domain supports clean product links, refresh and browser back at ${width}px`, async ({ page }) => {
    const errors = await fixture(page);
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
    await page.goto(`${publicOrigin}/`);
    const detail = page.getByRole('link', { name: 'View details for Domain fixture table', exact: true }).first();
    await expect(detail).toHaveAttribute('href', `/product/${productId}`);
    await detail.click();
    await expect(page).toHaveURL(`${publicOrigin}/product/${productId}`);
    await expect(page.getByRole('heading', { name: product.name, exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByRole('heading', { name: product.name, exact: true })).toBeVisible();
    const photo = page.locator('.pub-detail-photo img, .pub-detail-main-image img, .pub-detail-image img, .pub-detail img').first();
    await expect(photo).toBeVisible();
    expect(await photo.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.goBack();
    await expect(page).toHaveURL(`${publicOrigin}/`);
    await expect(detail).toBeVisible();
    expect(errors).toEqual([]);
  });

  test(`staff domain signs in and preserves the admin dashboard at ${width}px`, async ({ page }) => {
    const errors = await fixture(page, true);
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
    await page.goto(`${adminOrigin}/`);
    await expect(page.getByRole('heading', { name: 'Brutti’s Collection' })).toBeVisible();
    await expect(page.locator('.catalog-login-wordmark')).toHaveAttribute('href', `${publicOrigin}/`);
    await page.getByLabel('Email', { exact: true }).fill(user.email);
    await page.getByLabel('Password', { exact: true }).fill('test-fixture-password');
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Catalog overview' })).toBeVisible();
    await expect(page).toHaveURL(`${adminOrigin}/`);
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Catalog overview' })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(errors).toEqual([]);
  });
}

test('rejected credentials do not grant staff access', async ({ page }) => {
  await fixture(page);
  await page.goto(`${adminOrigin}/`);
  await page.getByLabel('Email', { exact: true }).fill('unauthorized@example.invalid');
  await page.getByLabel('Password', { exact: true }).fill('invalid-fixture-password');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Invalid login credentials');
  await expect(page.getByRole('heading', { name: 'Catalog overview' })).toHaveCount(0);
});

test('legacy links keep working and custom-domain legacy fragments become clean URLs', async ({ page }) => {
  await fixture(page);
  await page.goto('https://brutti-team.github.io/catalog/#/admin');
  await expect(page.getByRole('heading', { name: 'Brutti’s Collection' })).toBeVisible();
  await expect(page.locator('.catalog-login-wordmark')).toHaveAttribute('href', '#/catalog');
  await page.goto(`${publicOrigin}/#/product/${productId}`);
  await expect(page).toHaveURL(`${publicOrigin}/product/${productId}`);
  await expect(page.getByRole('heading', { name: product.name, exact: true })).toBeVisible();
});

test('Pages preview offers public root and a direct admin entry', async ({ page }) => {
  await fixture(page);
  await page.goto('https://brutti-catalog.pages.dev/');
  await expect(page.getByRole('heading', { name: /Considered spaces/ })).toBeVisible();
  await page.goto('https://brutti-catalog.pages.dev/admin');
  await expect(page.getByRole('heading', { name: 'Brutti’s Collection' })).toBeVisible();
});
