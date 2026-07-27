# Jericho Platform – Stage 1

Private, invitation-only commodity matching platform for verified brokers.

**This folder is completely self-contained.**  
It does **not** modify any existing files in the repository root.

---

## 1. What is included in Stage 1

- Invitation-only registration (unique one-time links)
- Automatic invitation emails (via Firebase Trigger Email extension)
- Operator approval workflow
- Two roles: Operator & Participant
- Create / edit Sell Offers and Buy Requests
- Sequential references: `SELL-26-001`, `BUY-26-001`, …
- Dynamic Origin/Destination field based on Incoterm
- Operator-managed searchable commodity list + "Other"
- Mandatory document upload (PDF, Word, Excel, Images, ZIP – max 20 MB)
- Basic version history (Operators only)
- Participant dashboard + full Operator dashboard
- Listing status management
- Document review queue
- Recent activity log
- Search
- Forgot password
- Professional soft off-white + subtle blue design
- English only
- Full anonymity for participants

---

## 2. Folder structure
---

## 3. Setup instructions (step-by-step)

### A. Firebase project

You already have a project named **Jericho Operation**.

1. Go to Firebase Console → Project Settings → General → Your apps
2. Add a Web app (if you don't have one yet)
3. Copy the `firebaseConfig` object
4. Open `platform/js/firebase-config.js` and replace the placeholders with your real values.

### B. Enable Authentication

1. Firebase Console → Authentication → Sign-in method
2. Enable **Email/Password**

### C. Create Firestore database

1. Firebase Console → Firestore Database → Create database
2. Start in **production mode**
3. Choose a location close to your users
4. Go to Rules tab and paste the entire content of `platform/rules/firestore.rules`
5. Publish the rules

### D. Create Storage bucket

1. Firebase Console → Storage → Get started
2. Use the same location as Firestore
3. Go to Rules tab and paste the entire content of `platform/rules/storage.rules`
4. Publish the rules

### E. Create the first Operator account

Because registration is invitation-only, you need to bootstrap the first operator manually:

1. In Firebase Authentication → Users → Add user  
   Email: `Rafael.e@telenet.be` (or your preferred temporary email)  
   Set a password
2. Copy the UID of the new user
3. In Firestore → Start collection `users` → Document ID = the UID you just copied  
   Add these fields:

   | Field       | Type   | Value          |
   |-------------|--------|----------------|
   | firstName   | string | Rafael         |
   | lastName    | string | (your choice)  |
   | company     | string | Jericho        |
   | country     | string | Belgium        |
   | email       | string | Rafael.e@telenet.be |
   | telephone   | string | (optional)     |
   | role        | string | operator       |
   | status      | string | approved       |
   | createdAt   | timestamp | (now)       |

4. You can now log in at `/platform/index.html` with that email and password.

### F. Firebase Trigger Email extension (for invitation emails)

1. Firebase Console → Extensions → Explore extensions
2. Install **Trigger Email from Firestore**
3. Follow the setup wizard (you will need an SMTP provider or Gmail / SendGrid / etc.)
4. The extension listens on the collection `mail` (already prepared in the code)

### G. Deploy to GitHub Pages

1. Commit and push the entire `/platform` folder to your repository  
   `https://github.com/Rafops71/Jerichotrack`
2. Go to repository Settings → Pages
3. Source: Deploy from branch `main` (or your default branch)
4. Folder: `/ (root)` is fine – the app lives at:

   `https://rafops71.github.io/Jerichotrack/platform/`

   or

   `https://rafops71.github.io/Jerichotrack/platform/index.html`

---

## 4. First actions after login as Operator

1. Go to **Commodities** and add the commodities you work with (Copper Cathodes, Aluminium Ingots, EN590, etc.)
2. Go to **Invitations** and send the first invitation links
3. Approve new users from **Pending Approvals**

---

## 5. Important security notes

- Participants never see real names, companies or contact details of other participants.
- Only the pure reference (`SELL-26-001`) is visible to them.
- All identity fields are stripped client-side and protected by Firestore rules.
- Document uploads are restricted by type and size in Storage rules.

---

## 6. Next stages (not included yet)

- Matching engine
- Email notifications for matches / updates
- Full audit trail improvements
- KYC / AML modules
- AI-assisted matching

---

Built as production-ready Stage 1 for Jericho.
