/**
 * The full user journey, entirely through the UI:
 *   admin creates a poll -> opens it -> consumer votes -> admin sees the tally
 *
 * Nothing here calls the API directly. Every step is a real click in a real
 * browser, so it exercises the SPAs, the token path, the guards and the
 * database together.
 */
// Playwright is not a dependency of this repo — install it on demand:
//   npm i -D playwright
import { chromium } from 'playwright';
import { createHmac } from 'node:crypto';

const CONSUMER = 'http://localhost:8084';
const ADMIN = 'http://localhost:8085';
const EMAIL = 'lan@example.com';
const PASSWORD = 'demo-pass-123';

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
function totp() {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 1000 / 30)));
  const h = createHmac('sha1', base32Decode('JBSWY3DPEHPK3PXP')).update(buf).digest();
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

async function signIn(page, url, mfa) {
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
  await page.getByRole('button', { name: /sign out/i }).first().waitFor({ timeout: 20000 });
  await page.waitForTimeout(1500);
}

const browser = await chromium.launch({ channel: 'chrome' });
const title = `Browser journey ${new Date().toISOString().slice(11, 19)}`;

// ── admin: create and open ─────────────────────────────────────────────────
console.log('\n[1] admin creates and opens a poll');
const adminCtx = await browser.newContext();
const admin = await adminCtx.newPage();
await signIn(admin, ADMIN, true);

await admin.getByRole('button', { name: /new poll/i }).click();
await admin.getByPlaceholder('Question').fill(title);
await admin.getByPlaceholder(/one option per line/i).fill('Fox\nOwl\nOctopus');
await admin.getByRole('button', { name: /create as draft/i }).click();
await admin.waitForTimeout(2000);

const afterCreate = await admin.locator('body').innerText();
check('poll appears in the admin list', afterCreate.includes(title), 'not listed');
check('created as draft', /draft/i.test(afterCreate));

// Target the div containing BOTH the title and the button. Filtering on text
// alone matches every ancestor, and .last() picks the innermost — the title's
// own div, which has no buttons in it.
const row = admin
  .locator('div')
  .filter({ hasText: title })
  .filter({ has: admin.getByRole('button', { name: /^open$/i }) })
  .last();
await row.getByRole('button', { name: /^open$/i }).click();
await admin.waitForTimeout(2000);
check('poll opened', /accepting votes/i.test(await admin.locator('body').innerText()));

// ── consumer: vote ─────────────────────────────────────────────────────────
console.log('\n[2] consumer votes');
const userCtx = await browser.newContext();
const user = await userCtx.newPage();
await signIn(user, CONSUMER, false);

const listText = await user.locator('body').innerText();
check('new poll is visible to the consumer', listText.includes(title), 'not visible');

const card = user
  .locator('div')
  .filter({ hasText: title })
  .filter({ has: user.getByRole('button', { name: /view & vote/i }) })
  .last();
await card.getByRole('button', { name: /view & vote/i }).click();
await user.waitForTimeout(1500);

await user.getByRole('button', { name: /^Owl/ }).click();
await user.getByRole('button', { name: /submit vote/i }).click();
await user.waitForTimeout(2500);

const afterVote = await user.locator('body').innerText();
check('vote recorded', /vote recorded/i.test(afterVote), afterVote.slice(0, 200));

// ── one vote per user, through the UI ──────────────────────────────────────
console.log('\n[3] the UI reflects one-vote-per-user');
check(
  'shows the vote is final',
  /already voted|does not allow changes/i.test(afterVote),
  afterVote.slice(0, 300),
);

// ── admin: tally ───────────────────────────────────────────────────────────
console.log('\n[4] admin sees the tally');
await admin.reload({ waitUntil: 'domcontentloaded' });
await admin.getByRole('button', { name: /sign out/i }).first().waitFor({ timeout: 20000 });
await admin.waitForTimeout(2000);

const row2 = admin
  .locator('div')
  .filter({ hasText: title })
  .filter({ has: admin.getByRole('button', { name: /^results$/i }) })
  .last();
await row2.getByRole('button', { name: /^results$/i }).click();
await admin.waitForTimeout(2000);

const tally = await admin.locator('body').innerText();
check('tally shows one voter', /1 voter\(s\)/.test(tally), tally.match(/\d+ voter\(s\)/)?.[0] ?? 'no tally');
check('Owl has one vote', /Owl:\s*1/.test(tally), tally.match(/Owl:\s*\d+/)?.[0] ?? 'no Owl count');
check('Fox has zero votes', /Fox:\s*0/.test(tally), tally.match(/Fox:\s*\d+/)?.[0] ?? 'no Fox count');

await browser.close();
console.log(failures ? `\n${failures} CHECK(S) FAILED\n` : '\nFull journey passed\n');
process.exit(failures ? 1 : 0);
