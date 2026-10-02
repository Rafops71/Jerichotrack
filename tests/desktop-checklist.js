/*
 * THE APPROVED CHECKLIST - DESKTOP APP (index.html)
 *
 * The companion app's list lives in checklist.js. This is the same idea for the
 * desktop CRM: what the app is supposed to do, in Rafael's words, one line each,
 * every line backed by a browser test. The report is generated from this list,
 * so an item with no passing test cannot quietly disappear.
 *
 * These items were DRAFTED from how the app actually behaves and from what
 * Rafael asked for in conversation. They are a first pass and he has not yet
 * corrected the wording. Where an item is a decision of his rather than an
 * observation, it is marked `draft: true` so the report can say so honestly.
 *
 * "manual" means the robot genuinely cannot check it here, and why. A manual
 * item still counts as NOT covered and still fails the gate.
 */
module.exports = [
  { n: 1,  group: 'Starting up',   text: 'The app opens without a blank screen or an error' },
  { n: 2,  group: 'Starting up',   text: 'It asks for my password once per device, then connects and stays connected' },
  { n: 3,  group: 'Starting up',   text: 'The status pill honestly says online, offline or syncing' },
  { n: 4,  group: 'Starting up',   text: 'Every tab opens without breaking the page' },

  /* 01/10/2026: commission tracking was removed from this app entirely. It is an
     operations tool, and what Jericho earns is not an operational fact. These two
     items are the guard against it creeping back in. */
  { n: 5,  group: 'No money here', text: 'There is no Commissions button anywhere in the app' },
  { n: 6,  group: 'No money here', text: 'The first page shows no money at all - no totals, no commission, no structures' },
  { n: 7,  group: 'No money here', text: 'The word "commission" appears nowhere on the first page' },

  { n: 8,  group: 'First page',    text: 'The first thing I see is what needs me today, not a summary' },
  { n: 9,  group: 'First page',    text: 'Overdue tasks are listed above everything else, and they are red' },
  { n: 10, group: 'First page',    text: "Today's tasks are listed under the overdue ones" },
  { n: 11, group: 'First page',    text: 'The counts sit underneath the lists, not above them' },
  { n: 12, group: 'First page',    text: 'Ticking a task off removes it from the first page' },

  { n: 13, group: 'Contacts',      text: 'I can add a contact and it is still there afterwards' },
  { n: 14, group: 'Contacts',      text: 'A contact I save on the desktop reaches the database, not just the screen' },
  { n: 15, group: 'Contacts',      text: 'I can delete a contact and it stays deleted' },

  { n: 16, group: 'Importing',     text: 'I can import a .vcf exported from my phone' },
  { n: 17, group: 'Importing',     text: 'I can import a .csv and it works out which column is which' },
  { n: 18, group: 'Importing',     text: 'It shows me what it found and what it will do before anything is saved' },
  { n: 19, group: 'Importing',     text: 'Importing the same file twice does not double my contacts' },
  { n: 20, group: 'Importing',     text: 'A company name with a comma in it does not break the import' },
  { n: 21, group: 'Importing',     text: 'Accents and Turkish spelling are not treated as a different person' },
  { n: 22, group: 'Importing',     text: 'The same number written +90, 0090 or 090 is one number, not three' },
  { n: 23, group: 'Importing',     text: 'Two colleagues at one company with their own mobiles stay two people' },
  { n: 24, group: 'Importing',     text: 'Two people sharing a company info@ address stay two people' },
  { n: 25, group: 'Importing',     text: 'Imported contacts are saved to the database, not only shown on screen' },

  { n: 26, group: 'Duplicates',    text: 'Find Duplicates shows me pairs that look like the same person' },
  { n: 27, group: 'Duplicates',    text: 'It tells me in plain words why it thinks they are the same' },
  { n: 28, group: 'Duplicates',    text: 'Nothing is merged until I press Merge on that pair' },
  { n: 29, group: 'Duplicates',    text: 'Merging keeps the fuller record and loses none of the details' },
  { n: 30, group: 'Duplicates',    text: '"Not the same person" is remembered and that pair stops coming back' },

  { n: 31, group: 'Deals',         text: 'I can add a deal with a quantity and a price and it is still there' },
  { n: 32, group: 'Deals',         text: 'The price of the goods is still shown - that is the work, not my pay' },

  { n: 33, group: 'Tasks',         text: 'I can add a task with a due date and it turns up on the first page' },
  { n: 34, group: 'Tasks',         text: 'An overdue task is shown as overdue, not as due today' },

  { n: 35, group: 'Comms log',     text: 'I can log a call and read it back later' },
  { n: 36, group: 'Comms log',     text: 'The first page counts my logged calls, and calls them Comms Logged' },

  { n: 37, group: 'Prices',        text: 'Iron ore, platinum and palladium show a live price' },
  { n: 38, group: 'Prices',        text: 'Platinum and palladium are priced per kilogram, not per ounce' },
  { n: 39, group: 'Prices',        text: 'The ticker scrolls without going blank' },

  { n: 40, group: 'Map',           text: 'The map opens and draws the world' },
  { n: 41, group: 'Map',           text: 'I can switch between the operations map and the atlas map' },
  { n: 42, group: 'Map',           text: 'I can filter the map by commodity, service or name' },
  { n: 43, group: 'Map',           text: 'I can zoom in and see cities, not only countries' },

  { n: 44, group: 'Backup',        text: 'I can download a backup of everything' },
  { n: 45, group: 'Backup',        text: 'The backup counts match what is actually in the app' },

  { n: 46, group: 'Safety',        text: 'Nothing I do in the test app can reach my real data',
    manual: false },
  { n: 47, group: 'Safety',        text: 'Without the password, nothing is connected and nothing is readable',
    manual: 'needs a second browser with no password typed; covered by item 2 from the other side' }
];
