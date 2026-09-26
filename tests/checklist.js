/*
 * THE APPROVED CHECKLIST - the single source of truth for what this app is
 * supposed to do, in Rafael's words. The report is generated from this list,
 * so an item that has no passing test cannot quietly disappear.
 *
 * "manual" means the robot genuinely cannot check it here, and why. It is not
 * a way of excusing a failure - a manual item still counts as NOT covered and
 * still fails the gate until it is checked by hand and recorded.
 */
module.exports = [
  { n: 1,  group: 'Starting up',  text: 'The app opens without a blank screen or an error' },
  { n: 2,  group: 'Starting up',  text: 'It connects to the database automatically, without me logging in' },
  { n: 3,  group: 'Starting up',  text: 'The status pill honestly says online, offline or syncing' },
  { n: 4,  group: 'Starting up',  text: 'Something I save on my iPhone shows up on my iPad' },
  { n: 5,  group: 'Starting up',  text: 'With no signal it still lets me save, and catches up later' },

  { n: 6,  group: 'Home screen',  text: 'My upcoming calls are listed, soonest first' },
  { n: 7,  group: 'Home screen',  text: "Today's follow-ups are shown" },
  { n: 8,  group: 'Home screen',  text: 'Overdue is red, today is amber, no-date is grey' },
  { n: 9,  group: 'Home screen',  text: 'The quick tiles open the right thing when tapped' },

  { n: 10, group: 'Leads',        text: 'I can add a lead quickly and it is still there afterwards' },
  { n: 11, group: 'Leads',        text: 'A lead I already have is flagged, not silently duplicated' },

  { n: 12, group: 'Calls',        text: 'I can create a call with a date and a time' },
  { n: 13, group: 'Calls',        text: 'I can add who is attending and where they are' },
  { n: 14, group: 'Calls',        text: "It shows the time in each attendee's own country" },
  { n: 15, group: 'Calls',        text: 'It gets that right when the call falls on a different day for them' },
  { n: 16, group: 'Calls',        text: 'I can send the meeting details to someone on WhatsApp' },

  { n: 17, group: 'Follow-ups',   text: 'I can add an action with a note, a tag and a due date' },
  { n: 18, group: 'Follow-ups',   text: 'I can tick an action off as done' },
  { n: 19, group: 'Follow-ups',   text: 'I can delete an action' },
  { n: 20, group: 'Follow-ups',   text: 'A done action stops showing up in my follow-ups' },

  { n: 21, group: 'Notes',        text: 'I can jot a quick note and it saves' },
  { n: 22, group: 'Notes',        text: 'I can delete a note' },

  { n: 23, group: 'Pipeline',     text: 'My deals show up under the right stage' },
  { n: 24, group: 'Pipeline',     text: 'All eight stages exist and are spelled right' },
  { n: 25, group: 'Pipeline',     text: 'A deal already in the pipeline is not added twice' },

  { n: 26, group: 'Dictation',    text: 'The mic starts when I tap it and stops when I tap again',
    manual: 'Needs a real microphone and Apple/Google speech recognition. The browser the robot drives has neither.' },
  { n: 27, group: 'Dictation',    text: 'What I say turns into text in the right box',
    manual: 'Requires real speech recognition; cannot be simulated honestly.' },
  { n: 28, group: 'Dictation',    text: 'Words it reliably mishears get corrected automatically' },
  { n: 29, group: 'Dictation',    text: 'The last thing I said is not lost when I tap stop',
    manual: 'KNOWN BUG, reported by you. Needs a real device to reproduce and confirm a fix.' },
  { n: 30, group: 'Dictation',    text: 'It is obvious whether it is listening or not',
    manual: 'Tied to real recognition start/stop events.' },

  { n: 31, group: 'Intake',       text: 'My Worker address and key are remembered' },
  { n: 32, group: 'Intake',       text: 'I can paste messy text and press Process' },
  { n: 33, group: 'Intake',       text: 'It comes back with cards I can read and edit' },
  { n: 34, group: 'Intake',       text: 'NOTHING is saved to my database until I press Confirm' },
  { n: 35, group: 'Intake',       text: 'When I press Confirm, the items really do appear' },
  { n: 36, group: 'Intake',       text: 'If I close it without confirming, nothing was saved' },
  { n: 37, group: 'Intake',       text: 'If it fails, it says why - and my original text is still there' },

  { n: 38, group: 'Editing',      text: 'I can change a follow-up I already saved' },
  { n: 39, group: 'Editing',      text: 'I can change a call I already saved' },
  { n: 40, group: 'Editing',      text: 'I can cancel a call' },
  { n: 41, group: 'Editing',      text: 'Deleting takes two taps, so a stray tap cannot lose anything' },
  { n: 42, group: 'Editing',      text: 'I can move a deal to a different stage from my phone' },

  { n: 43, group: 'Appearance',   text: 'I can change the colours, and the app remembers next time' },
  { n: 44, group: 'Appearance',   text: 'I can choose between the three layouts' },
  { n: 45, group: 'Appearance',   text: 'Reset puts it back to how it looked before' },
  { n: 46, group: 'Appearance',   text: 'A pale colour still leaves the header text readable' },

  { n: 47, group: 'Version',      text: 'The version number is always shown in the banner' },
  { n: 48, group: 'Version',      text: 'The number shown matches the actual version of the file' },

  { n: 49, group: 'Dictation',    text: 'I can add my own corrections for words it keeps getting wrong' }
];
