/*
 * DESKTOP APP - deals, tasks and the comms log.
 *
 * Item 32 is deliberate: the price of the goods STAYS visible. Commission left
 * this app because what Jericho earns is not an operational fact, but what the
 * cargo costs is the work itself and a trader needs it.
 */
const { test, expect } = require('@playwright/test');
const app = require('./helpers/desktop');
const verify = require('./helpers/verify');

test.beforeEach(async () => { await verify.wipe(); });

const yesterday = () => {
  const d = new Date(); d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
};

/*
 * The commodity is a picker built at runtime rather than a plain <select>, so the
 * deal form is filled by clicking what is actually on screen.
 */
async function addDeal(page, { commodity, buyer, seller, quantity, unit, price, stage }) {
  await app.goToTab(page, 'pipeline');
  await page.click('[onclick="showAddDeal()"]');
  await page.locator('#dealCommodityPicker').getByText(commodity, { exact: true }).first().click();
  if (buyer) await page.fill('#dealBuyer', buyer);
  if (seller) await page.fill('#dealSeller', seller);
  if (quantity) await page.fill('#dealQuantity', quantity);
  if (unit) await page.selectOption('#dealUnit', unit).catch(() => {});
  if (price) await page.fill('#dealPrice', price);
  if (stage) await page.selectOption('#dealStage', stage);
  await page.click('[onclick="saveDeal()"]');
  await page.waitForTimeout(400);
}

test('@robot DeskItem31_can_add_a_deal_with_quantity_and_price', async ({ page }) => {
  await app.openApp(page);
  await addDeal(page, {
    commodity: 'Iron Ore', buyer: 'Tianjin Ore Import Co', seller: 'Vale Trading',
    quantity: '50000', price: '103.50', stage: 'Negotiation'
  });

  const saved = await verify.waitFor('jericho_pipeline', d => d.buyer === 'Tianjin Ore Import Co',
    { label: 'the saved deal' });
  expect(saved.commodity).toContain('Iron Ore');
  expect(saved.quantity).toBe('50000');
  expect(saved.price).toBe('103.50');
  expect(saved.stage).toBe('Negotiation');

  await page.reload();
  await page.waitForFunction(() => window._fbReady === true, null, { timeout: 60000 });
  await app.goToTab(page, 'pipeline');
  await expect(page.locator('#pipelineBoard'),
    'the deal should survive a reload').toContainText('Tianjin Ore Import Co');
});

test('@robot DeskItem32_the_price_of_the_goods_is_still_shown', async ({ page }) => {
  await app.openApp(page);
  await addDeal(page, {
    commodity: 'Iron Ore', buyer: 'Tianjin Ore Import Co', quantity: '50000',
    price: '103.50', stage: 'Negotiation'
  });
  await app.goToTab(page, 'pipeline');

  /* The price field must still exist and still be filled in. This is the
     counterpart to items 5 to 7: money that is the WORK stays, money that is
     Rafael's PAY went. */
  await expect(page.locator('#dealPrice'), 'the deal form must still ask for a price')
    .toHaveCount(1);
  await expect(page.locator('#pipelineBoard'),
    'the price should be visible on the deal').toContainText('103.50');
});

test('@robot DeskItem33_a_task_with_a_due_date_turns_up_on_the_first_page', async ({ page }) => {
  await app.openApp(page);
  await app.addTask(page, { title: 'Confirm vessel nomination', due: yesterday() });

  const saved = await verify.waitFor('jericho_tasks', t => t.title === 'Confirm vessel nomination',
    { label: 'the saved task' });
  expect(saved.completed).toBe(false);

  await app.goToTab(page, 'dashboard');
  await expect(page.locator('#mainContent')).toContainText('Confirm vessel nomination');
});

test('@robot DeskItem34_overdue_is_shown_as_overdue_not_as_today', async ({ page }) => {
  await app.openApp(page);
  await app.addTask(page, { title: 'Chase the assay report', due: yesterday() });
  await app.goToTab(page, 'dashboard');

  await expect(page.locator('#dashOverdueBody')).toContainText('Chase the assay report');
  await expect(page.locator('#dashTodayBody'),
    'a task due yesterday must not be filed under today').not.toContainText('Chase the assay report');
  await expect(page.locator('#overdueCount')).toHaveText('1');
  await expect(page.locator('#tasksTodayCount')).toHaveText('0');
});

test('@robot DeskItem35_can_log_a_call_and_read_it_back', async ({ page }) => {
  await app.openApp(page);
  await app.goToTab(page, 'commslog');
  await page.click('[onclick="showAddComm()"]');
  await page.fill('#commLogContact', 'Ahmet Yilmaz');
  await page.selectOption('#commLogType', 'Call');
  await page.fill('#commLogSummary', 'Can do 5,000t a month at 20 under. Wants our assay first.');
  await page.click('[onclick="saveComm()"]');
  await page.waitForTimeout(400);

  const saved = await verify.waitFor('jericho_commslog', c => c.contact === 'Ahmet Yilmaz',
    { label: 'the logged call' });
  expect(saved.type).toBe('Call');
  expect(saved.summary).toContain('5,000t a month');

  await page.reload();
  await page.waitForFunction(() => window._fbReady === true, null, { timeout: 60000 });
  await app.goToTab(page, 'commslog');
  await expect(page.locator('#commsContainer, #commslog-section'),
    'the logged call should be readable later').toContainText('5,000t a month');
});

test('@robot DeskItem36_the_first_page_counts_logged_calls_and_names_them_properly', async ({ page }) => {
  await app.openApp(page);
  await app.goToTab(page, 'commslog');
  await page.click('[onclick="showAddComm()"]');
  await page.fill('#commLogContact', 'Li Wei');
  await page.fill('#commLogSummary', 'Iron ore 62%, asked for a firm offer');
  await page.click('[onclick="saveComm()"]');
  await page.waitForTimeout(400);

  await app.goToTab(page, 'dashboard');
  await expect(page.locator('#statComms')).toHaveText('1');

  /* The label used to read "Comm Records", which was mistaken for commission.
     That word has no place in this app any more. */
  const labels = await page.$$eval('#mainContent .stat-label', els => els.map(e => e.textContent.trim()));
  expect(labels, 'the count should be named after the Comms Log tab').toContain('Comms Logged');
  expect(labels.join(' | ')).not.toMatch(/comm records/i);
});
