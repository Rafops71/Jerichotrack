/**
 * Jericho Platform – Utility functions
 * Reference generation, validation, date formatting, etc.
 */

const JerichoUtils = (() => {
  'use strict';

  /**
   * Generate sequential reference number using Firestore transaction
   * Format: SELL-26-001  or  BUY-26-001
   */
  async function generateReference(db, type) {
    const year = new Date().getFullYear().toString().slice(-2); // "26"
    const counterId = `${type.toLowerCase()}_${year}`; // e.g. sell_26
    const counterRef = db.collection('counters').doc(counterId);

    try {
      const newNumber = await db.runTransaction(async (transaction) => {
        const doc = await transaction.get(counterRef);
        let next = 1;
        if (doc.exists) {
          next = (doc.data().value || 0) + 1;
        }
        transaction.set(counterRef, { value: next, updatedAt: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true });
        return next;
      });

      const padded = String(newNumber).padStart(3, '0');
      return `${type.toUpperCase()}-${year}-${padded}`;
    } catch (err) {
      console.error('Reference generation failed:', err);
      throw new Error('Could not generate reference number. Please try again.');
    }
  }

  /**
   * Basic form validation helpers
   */
  function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  function isStrongPassword(password) {
    // Minimum 8 characters, at least one letter and one number
    return password.length >= 8 && /[A-Za-z]/.test(password) && /[0-9]/.test(password);
  }

  function required(value) {
    return value !== null && value !== undefined && String(value).trim() !== '';
  }

  /**
   * Date formatting
   */
  function formatDate(timestamp) {
    if (!timestamp) return '—';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  }

  function formatDateTime(timestamp) {
    if (!timestamp) return '—';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  /**
   * Incoterm → dynamic label for Origin/Destination field
   */
  function getLocationLabel(incoterm) {
    const originTerms = ['FOB', 'EXW', 'FCA'];
    const destTerms = ['CIF', 'CFR', 'DAP', 'DDP'];

    if (originTerms.includes(incoterm)) {
      return 'Origin / Loading Port';
    }
    if (destTerms.includes(incoterm)) {
      return 'Destination / Delivery Port';
    }
    return 'Origin / Destination';
  }

  /**
   * Simple debounce
   */
  function debounce(fn, delay = 300) {
    let timer;
    return function (...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), delay);
    };
  }

  /**
   * Sanitize filename for storage
   */
  function sanitizeFilename(name) {
    return name
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .replace(/_{2,}/g, '_')
      .substring(0, 120);
  }

  /**
   * Generate a random invitation token
   */
  function generateInviteToken() {
    const array = new Uint8Array(24);
    crypto.getRandomValues(array);
    return Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Show temporary toast notification
   */
  function showToast(message, type = 'info') {
    const existing = document.querySelector('.jericho-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = `jericho-toast alert alert-${type}`;
    toast.style.cssText = `
      position: fixed;
      bottom: 1.5rem;
      right: 1.5rem;
      z-index: 200;
      min-width: 280px;
      max-width: 420px;
      box-shadow: 0 10px 25px rgba(0,0,0,0.12);
      animation: slideIn 0.25s ease;
    `;
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.3s';
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }

  // Expose public API
  return {
    generateReference,
    isValidEmail,
    isStrongPassword,
    required,
    formatDate,
    formatDateTime,
    getLocationLabel,
    debounce,
    sanitizeFilename,
    generateInviteToken,
    showToast
  };
})();
