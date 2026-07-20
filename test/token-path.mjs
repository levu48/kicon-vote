/**
 * Real-browser verification of the vote SPAs.
 *
 * This is the ONLY check that proves the `resource` threading works. A scripted
 * flow (test/vote-e2e.mjs) constructs its own authorize URL, so it can pass
 * while the SPA silently omits `resource` and receives an opaque
 * userinfo-audience token — login succeeds and every API call 401s.
 *
 * Here oidc-client-ts builds the request, so what the browser sends is what
 * production would send.
 */
// Playwright is not a dependency of this repo — install it on demand:
//   npm i -D playwright
import { chromium } from 'playwright';

const CONSUMER = 'http://localhost:8084';
const ADMIN = 'http://localhost:8085';
const EMAIL = 'lan@example.com';
const PASSWORD = 'demo-pass-123';
const TOTP_SECRET = 'JBSWY3DPEHPK3PXP';

import { createHmac } from 'node:crypto';
function base32Decode(s) {
  const A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '';
  for (const c of s.replace(/=+$/, '').toUpperCase()) {
    const i = A.indexOf(c);
    if (i >= 0) bits += i.toString(2).padStart(5, '0');
  }
  const out = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) out.push(parseInt(bits.slice(i, i + 8), 2));
  return Buffer.from(out);
}
function totp(secret = TOTP_SECRET) {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 1000 / 30)));
  const h = createHmac('sha1', base32Decode(secret)).update(buf).digest();
  const off = h[h.length - 1] & 0xf;
  return ((h.readUInt32BE(off) & 0x7fffffff) % 1_000_000).toString().padStart(6, '0');
}

let failures = 0;
const check = (name, cond, detail = '') => {
  if (cond) console.log(`  PASS  ${name}`);
  else {
    console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
    failures++;
  }
};

// Use the system Chrome rather than downloading Playwright's bundled build —
// it is already installed, and this avoids a ~150MB download.
const browser = await chromium.launch({ channel: 'chrome' });

async function signIn(page, url, { mfa }) {
  const authorizeUrls = [];
  const apiCalls = [];

  page.on('request', (r) => {
    const u = r.url();
    if (u.includes('/auth?')) authorizeUrls.push(u);
    if (u.startsWith('http://localhost:3100/v1/')) apiCalls.push({ url: u, method: r.method() });
  });

  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: /sign in/i }).first().click();
  await page.waitForURL(/localhost:3000/, { timeout: 15000 });

  await page.fill('input[name="email"]', EMAIL);
  await page.fill('input[name="password"]', PASSWORD);
  await page.click('button[type="submit"]');

  if (mfa) {
    await page.waitForSelector('input[name="code"]', { timeout: 15000 });
    await page.fill('input[name="code"]', totp());
    await page.click('button[type="submit"]');
  }

  await page.waitForURL((u) => u.origin === new URL(url).origin, { timeout: 20000 });
  // Vite keeps an HMR websocket open, so 'networkidle' never fires. Wait for
  // the signed-in UI instead, then give the API calls a moment to land.
  await page.getByRole('button', { name: /sign out/i }).first().waitFor({ timeout: 20000 });
  await page.waitForTimeout(2500);
  return { authorizeUrls, apiCalls };
}

// ── consumer ───────────────────────────────────────────────────────────────
console.log('\n[1] consumer surface (vote.kicon.com)');
{
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const { authorizeUrls, apiCalls } = await signIn(page, CONSUMER, { mfa: false });

  const authUrl = authorizeUrls[0] ?? '';
  const params = new URL(authUrl).searchParams;
  check('SPA sent resource= on /authorize', params.get('resource') === 'https://api.kicon.com', `got ${params.get('resource')}`);
  check('SPA requested vote scopes', (params.get('scope') ?? '').includes('vote:read'), params.get('scope') ?? '');

  // The decisive assertion: what the SPA actually holds.
  const token = await page.evaluate(() => {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith('oidc.user:')) return JSON.parse(localStorage.getItem(k)).access_token;
    }
    return null;
  });
  check('SPA stored an access token', !!token);
  const segments = (token ?? '').split('.').length;
  check('access token is a JWT, not opaque', segments === 3, `${segments} segment(s)`);
  if (segments === 3) {
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url'));
    console.log(`  aud=${payload.aud}  scope="${payload.scope}"  acr=${payload.acr}`);
    check('aud is api.kicon.com', payload.aud === 'https://api.kicon.com');
    check('carries vote:read + vote:write', /vote:read/.test(payload.scope) && /vote:write/.test(payload.scope));
    check('consumer did NOT receive vote:admin', !/vote:admin/.test(payload.scope), payload.scope);
  }

  check('SPA called the API', apiCalls.length > 0, `${apiCalls.length} calls`);
  const listCall = apiCalls.find((c) => c.url.includes('/v1/vote/polls'));
  check('fetched the poll list', !!listCall);

  const body = await page.locator('body').innerText();
  check('no placeholder text remains', !/placeholder/i.test(body));
  check('rendered real poll content or an empty state', /vote|poll/i.test(body));
  console.log(`  page shows: ${body.replace(/\s+/g, ' ').slice(0, 160)}…`);

  await ctx.close();
}

// ── admin ──────────────────────────────────────────────────────────────────
console.log('\n[2] admin surface (admin.vote.kicon.com)');
{
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const { authorizeUrls, apiCalls } = await signIn(page, ADMIN, { mfa: true });

  const params = new URL(authorizeUrls[0] ?? '').searchParams;
  check('SPA sent resource= on /authorize', params.get('resource') === 'https://api.kicon.com');
  check('requested vote:admin', (params.get('scope') ?? '').includes('vote:admin'));

  const token = await page.evaluate(() => {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith('oidc.user:')) return JSON.parse(localStorage.getItem(k)).access_token;
    }
    return null;
  });
  const segments = (token ?? '').split('.').length;
  check('admin access token is a JWT', segments === 3, `${segments} segment(s)`);
  if (segments === 3) {
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url'));
    console.log(`  aud=${payload.aud}  scope="${payload.scope}"  acr=${payload.acr}`);
    check('admin token carries vote:admin', /vote:admin/.test(payload.scope));
    check('admin authenticated at loa2 (MFA)', payload.acr === 'urn:kicon:loa2', payload.acr);
  }

  check('admin called the API', apiCalls.some((c) => c.url.includes('/v1/vote/admin/polls')));
  const body = await page.locator('body').innerText();
  console.log(`  page shows: ${body.replace(/\s+/g, ' ').slice(0, 200)}…`);
  check('admin poll UI rendered', /polls/i.test(body));

  await ctx.close();
}

await browser.close();
console.log(failures ? `\n${failures} CHECK(S) FAILED\n` : '\nAll browser checks passed\n');
process.exit(failures ? 1 : 0);
