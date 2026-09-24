const { test, expect } = require('@playwright/test');
const app = require('./helpers/app');
const verify = require('./helpers/verify');

/* The expected times below are worked out here, with the JavaScript standard
   timezone database, completely independently of the app's own conversion
   code. If the app and this calculation disagree, the test fails. */
function localTimeIn(tz, dateStr, timeStr, fromTz) {
  const [h, m] = timeStr.split(':').map(Number);
  const offset = t => {
    const ref = new Date(dateStr + 'T12:00:00Z');
    const asUTC = new Date(ref.toLocaleString('en-US', { timeZone: 'UTC' }));
    const asTZ = new Date(ref.toLocaleString('en-US', { timeZone: t }));
    return (asTZ - asUTC) / 3600000;
  };
  let total = h * 60 + m + (offset(tz) - offset(fromTz)) * 60;
  let shift = 0;
  while (total < 0) { total += 1440; shift--; }
  while (total >= 1440) { total -= 1440; shift++; }
  const hh = String(Math.floor(total / 60)).padStart(2, '0');
  const mm = String(Math.round(total % 60)).padStart(2, '0');
  return { time: `${hh}:${mm}`, shift };
}

const FUTURE = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);

async function setUpMeeting(page, { date, time, myCountry, attendee }) {
  await app.tap(page, 'openMeetingSheet()');
  await page.fill('#meetingDate', date);
  await page.fill('#meetingTime', time);
  await page.locator(`#myQuickLocs .quick-loc[data-country="${myCountry}"]`).click();
  if (attendee) {
    await page.fill('#attendeeNameInput', attendee.name);
    await page.locator(`#attendeeQuickLocs .quick-loc[data-country="${attendee.country}"]`).click();
  }
}

test.beforeEach(async () => { await verify.wipe(); });

test('@robot Item12_call_saves_with_date_and_time', async ({ page }) => {
  await app.openApp(page);
  await setUpMeeting(page, { date: FUTURE, time: '15:00', myCountry: 'Belgium' });
  await app.tap(page, 'saveMeeting()');
  const saved = await verify.waitFor('jericho_meetings', d => d.date === FUTURE, { label: FUTURE });
  expect(saved.time).toBe('15:00');
  expect(saved.myCountry).toBe('Belgium');
});

test('@robot Item13_attendee_with_location_can_be_added', async ({ page }) => {
  await app.openApp(page);
  await setUpMeeting(page, {
    date: FUTURE, time: '15:00', myCountry: 'Belgium',
    attendee: { name: 'Carlos', country: 'Mexico' }
  });
  await expect(page.locator('#attendeeChips')).toContainText('Carlos');
  await expect(page.locator('#attendeeChips')).toContainText('Mexico');
});

test('@robot Item14_shows_each_attendee_local_time', async ({ page }) => {
  await app.openApp(page);
  await setUpMeeting(page, {
    date: FUTURE, time: '15:00', myCountry: 'Belgium',
    attendee: { name: 'Carlos', country: 'Mexico' }
  });
  const expected = localTimeIn('America/Mexico_City', FUTURE, '15:00', 'Europe/Brussels');
  await expect(page.locator('#calcPreview')).toBeVisible();
  await expect(page.locator('#calcPreviewList')).toContainText(expected.time);
});

test('@robot Item15_day_shift_is_correct_when_the_call_crosses_midnight', async ({ page }) => {
  await app.openApp(page);
  await setUpMeeting(page, {
    date: FUTURE, time: '02:00', myCountry: 'Belgium',
    attendee: { name: 'Carlos', country: 'Mexico' }
  });
  const expected = localTimeIn('America/Mexico_City', FUTURE, '02:00', 'Europe/Brussels');
  expect(expected.shift, 'this test only means something if the time really does cross midnight')
    .not.toBe(0);
  const marker = expected.shift > 0 ? '(+1 day)' : '(-1 day)';
  await expect(page.locator('#calcPreviewList')).toContainText(expected.time);
  await expect(page.locator('#calcPreviewList')).toContainText(marker);
});

test('@robot Item16_meeting_can_be_shared_on_whatsapp', async ({ page, context }) => {
  await app.openApp(page);
  await setUpMeeting(page, {
    date: FUTURE, time: '15:00', myCountry: 'Belgium',
    attendee: { name: 'Carlos', country: 'Mexico' }
  });
  // Catch the outgoing WhatsApp link instead of actually opening it.
  const opened = [];
  await page.evaluate(() => { window.open = url => { window.__waUrl = url; return null; }; });
  await app.tap(page, 'shareMeetingWhatsApp()');
  const url = await page.evaluate(() => window.__waUrl || (location.href.includes('wa.me') ? location.href : null));
  expect(url, 'tapping the WhatsApp button did not produce a wa.me link').toBeTruthy();
  expect(decodeURIComponent(url)).toContain('Carlos');
});

test('@robot Item06_upcoming_calls_are_listed_soonest_first', async ({ page }) => {
  const soon  = new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10);
  const later = new Date(Date.now() + 9 * 86400000).toISOString().slice(0, 10);
  await app.openApp(page);

  // Create the later one FIRST, so passing cannot be an accident of insertion order.
  await setUpMeeting(page, { date: later, time: '11:00', myCountry: 'Belgium' });
  await app.tap(page, 'saveMeeting()');
  await verify.waitFor('jericho_meetings', d => d.date === later);

  await setUpMeeting(page, { date: soon, time: '09:00', myCountry: 'Belgium' });
  await app.tap(page, 'saveMeeting()');
  await verify.waitFor('jericho_meetings', d => d.date === soon);

  await app.goToScreen(page, 'home');
  const rows = page.locator('#upcomingList .upcoming-row, .upcoming-card .upcoming-row');
  await expect(rows.first()).toBeVisible({ timeout: 10000 });
  const firstRow = await rows.first().innerText();
  expect(firstRow, 'the soonest call should be at the top').toContain('09:00');
});
