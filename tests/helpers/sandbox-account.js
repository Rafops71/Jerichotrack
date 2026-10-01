/*
 * THE SANDBOX ACCOUNT
 *
 * Since the password gate landed, the app signs in with a named account instead
 * of anonymously, so the robot has to get through that gate like a person does:
 * type the password, press Unlock.
 *
 * This account exists ONLY inside the local Firebase Auth emulator. It is
 * created fresh by scripts/run-robot.js on every run and dies with the
 * emulator. The password below is not a credential for anything real, it
 * unlocks nothing outside this machine, and the real password is never needed
 * here or known to this repo.
 *
 * The email is read out of companion.html rather than copied, so that renaming
 * the account in the app cannot leave the robot signing in as the wrong one.
 */
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '..', '..', 'companion.html');

function readAccountEmail() {
  const html = fs.readFileSync(SRC, 'utf8');
  const m = html.match(/const\s+JERICHO_ACCOUNT\s*=\s*['"]([^'"]+)['"]/);
  if (!m) {
    throw new Error(
      'Could not find JERICHO_ACCOUNT in companion.html. The app changed how it ' +
      'names the sign-in account; fix tests/helpers/sandbox-account.js rather than guessing.'
    );
  }
  return m[1];
}

module.exports = {
  email: readAccountEmail(),
  // Any value the emulator accepts; Firebase requires at least 6 characters.
  password: 'robot-sandbox-only'
};
