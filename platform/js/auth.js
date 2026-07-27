/**
 * Jericho Platform – Authentication & Role Management
 */

const JerichoAuth = (() => {
  'use strict';

  let currentUser = null;
  let currentProfile = null;
  let auth = null;
  let db = null;

  function init(firebaseAuth, firestore) {
    auth = firebaseAuth;
    db = firestore;

    // Listen for auth state changes
    auth.onAuthStateChanged(async (user) => {
      if (user) {
        currentUser = user;
        try {
          const doc = await db.collection('users').doc(user.uid).get();
          if (doc.exists) {
            currentProfile = { uid: user.uid, ...doc.data() };
          } else {
            currentProfile = null;
          }
        } catch (err) {
          console.error('Failed to load user profile:', err);
          currentProfile = null;
        }
      } else {
        currentUser = null;
        currentProfile = null;
      }

      // Dispatch custom event so the rest of the app can react
      window.dispatchEvent(new CustomEvent('jericho-auth-changed', {
        detail: { user: currentUser, profile: currentProfile }
      }));
    });
  }

  async function login(email, password) {
    const result = await auth.signInWithEmailAndPassword(email, password);
    return result.user;
  }

  async function logout() {
    await auth.signOut();
    currentUser = null;
    currentProfile = null;
  }

  async function registerWithInvite(inviteToken, formData) {
    // 1. Validate invitation
    const inviteRef = db.collection('invitations').doc(inviteToken);
    const inviteSnap = await inviteRef.get();

    if (!inviteSnap.exists) {
      throw new Error('Invalid invitation link.');
    }

    const invite = inviteSnap.data();
    if (invite.used === true) {
      throw new Error('This invitation link has already been used.');
    }
    if (invite.expiresAt && invite.expiresAt.toDate() < new Date()) {
      throw new Error('This invitation link has expired.');
    }

    // 2. Create Firebase Auth account
    const emailLower = formData.email.trim().toLowerCase();
    const cred = await auth.createUserWithEmailAndPassword(emailLower, formData.password);

    // 3. Create user profile in Firestore (status = pending)
    const profile = {
      firstName: formData.firstName.trim(),
      lastName: formData.lastName.trim(),
      company: formData.company.trim(),
      country: formData.country.trim(),
      email: emailLower,
      telephone: formData.telephone.trim(),
      role: 'participant',
      status: 'pending',
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      invitedBy: invite.createdBy || null
    };

    await db.collection('users').doc(cred.user.uid).set(profile);

    // 4. Mark invitation as used
    await inviteRef.update({
      used: true,
      usedBy: cred.user.uid,
      usedAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    // 5. Log activity
    await db.collection('activity').add({
      type: 'user_registered',
      userId: cred.user.uid,
      email: emailLower,
      timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });

    return cred.user;
  }

  async function sendPasswordReset(email) {
    await auth.sendPasswordResetEmail(email);
  }

  function getCurrentUser() {
    return currentUser;
  }

  function getCurrentProfile() {
    return currentProfile;
  }

  function isOperator() {
    return currentProfile && currentProfile.role === 'operator';
  }

  function isApproved() {
    return currentProfile && currentProfile.status === 'approved';
  }

  function isPending() {
    return currentProfile && currentProfile.status === 'pending';
  }

  return {
    init,
    login,
    logout,
    registerWithInvite,
    sendPasswordReset,
    getCurrentUser,
    getCurrentProfile,
    isOperator,
    isApproved,
    isPending
  };
})();
