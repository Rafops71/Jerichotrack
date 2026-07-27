/**
 * Jericho Platform – Invitation Link Management
 */

const JerichoInvitations = (() => {
  'use strict';

  let db = null;

  function init(firestore) {
    db = firestore;
  }

  /**
   * Create a new one-time invitation and queue the email
   * @param {string} recipientEmail 
   * @param {string} recipientName  (optional, for the email)
   * @returns {Promise<{token: string, link: string}>}
   */
  async function createInvitation(recipientEmail, recipientName = '') {
    if (!JerichoAuth.isOperator()) {
      throw new Error('Only operators can create invitations.');
    }

    const token = JerichoUtils.generateInviteToken();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 14); // valid 14 days

    const inviteData = {
      email: recipientEmail.trim().toLowerCase(),
      name: recipientName.trim(),
      token: token,
      used: false,
      createdBy: JerichoAuth.getCurrentUser().uid,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      expiresAt: firebase.firestore.Timestamp.fromDate(expiresAt)
    };

    await db.collection('invitations').doc(token).set(inviteData);

    // Build the registration link
    const baseUrl = window.location.origin + window.location.pathname.replace(/\/[^/]*$/, '/');
    const link = `${baseUrl}register.html?invite=${token}`;

    // Queue email via Firebase Trigger Email extension
    // The extension listens on the /mail collection
    await db.collection('mail').add({
      to: recipientEmail.trim().toLowerCase(),
      message: {
        subject: 'Invitation to join Jericho',
        html: `
          <div style="font-family: system-ui, sans-serif; max-width: 560px; margin: 0 auto; color: #1a1d23;">
            <h2 style="margin-bottom: 0.5rem;">You are invited to Jericho</h2>
            <p>Hello${recipientName ? ' ' + recipientName : ''},</p>
            <p>You have been invited to join the private Jericho platform for verified commodity professionals.</p>
            <p style="margin: 1.5rem 0;">
              <a href="${link}" 
                 style="background:#3b82f6;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:500;display:inline-block;">
                Accept Invitation
              </a>
            </p>
            <p style="font-size:0.875rem;color:#718096;">
              This link can be used only once and expires in 14 days.<br>
              If the button does not work, copy and paste this URL into your browser:<br>
              <span style="word-break:break-all;">${link}</span>
            </p>
            <hr style="border:none;border-top:1px solid #e5e7eb;margin:1.5rem 0;">
            <p style="font-size:0.8rem;color:#9ca3af;">Jericho – Private commodity network</p>
          </div>
        `
      }
    });

    // Activity log
    await db.collection('activity').add({
      type: 'invitation_created',
      email: recipientEmail,
      createdBy: JerichoAuth.getCurrentUser().uid,
      timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });

    return { token, link };
  }

  /**
   * Load a single invitation by token (used on register page)
   */
  async function getInvitation(token) {
    const snap = await db.collection('invitations').doc(token).get();
    if (!snap.exists) return null;
    return { id: snap.id, ...snap.data() };
  }

  /**
   * List recent invitations (for operator dashboard)
   */
  async function listRecentInvitations(limit = 20) {
    const snap = await db.collection('invitations')
      .orderBy('createdAt', 'desc')
      .limit(limit)
      .get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  }

  return {
    init,
    createInvitation,
    getInvitation,
    listRecentInvitations
  };
})();
