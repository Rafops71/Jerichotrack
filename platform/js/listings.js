/**
 * Jericho Platform – Listings (Sell Offer / Buy Request)
 * SECURITY: Never store real name or company inside listing documents.
 */

const JerichoListings = (() => {
  'use strict';

  let db = null;

  function init(firestore) {
    db = firestore;
  }

  /**
   * Create a new listing
   * Only the UID is stored – never the real name or company.
   */
  async function create(data) {
    const user = JerichoAuth.getCurrentUser();
    if (!user || !JerichoAuth.isApproved()) {
      throw new Error('Only approved participants can create listings.');
    }

    const type = data.type; // 'SELL' or 'BUY'
    if (!['SELL', 'BUY'].includes(type)) {
      throw new Error('Invalid listing type.');
    }

    // Generate sequential reference
    const reference = await JerichoUtils.generateReference(db, type);

    const listing = {
      reference,
      type,
      commodity: data.commodity.trim(),
      commodityOther: data.commodityOther ? data.commodityOther.trim() : null,
      quantity: data.quantity.trim(),
      unit: data.unit.trim(),
      incoterm: data.incoterm,
      location: data.location.trim(),
      priceBasis: data.priceBasis.trim(),
      remarks: data.remarks ? data.remarks.trim() : '',
      status: 'active',
      createdBy: user.uid,               // ONLY the UID – no name, no company
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      version: 1
    };

    const docRef = await db.collection('listings').add(listing);

    // Version history (operators only)
    await db.collection('listingHistory').add({
      listingId: docRef.id,
      version: 1,
      action: 'created',
      changedBy: user.uid,
      changedAt: firebase.firestore.FieldValue.serverTimestamp(),
      snapshot: listing
    });

    // Activity log
    await db.collection('activity').add({
      type: 'listing_created',
      listingId: docRef.id,
      reference,
      userId: user.uid,
      timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });

    return { id: docRef.id, ...listing };
  }

  /**
   * Update an existing listing (owner or operator)
   */
  async function update(listingId, changes) {
    const user = JerichoAuth.getCurrentUser();
    const listingRef = db.collection('listings').doc(listingId);
    const snap = await listingRef.get();

    if (!snap.exists) throw new Error('Listing not found.');
    const existing = snap.data();

    const isOwner = existing.createdBy === user.uid;
    if (!isOwner && !JerichoAuth.isOperator()) {
      throw new Error('You do not have permission to edit this listing.');
    }

    const updateData = {
      ...changes,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      version: (existing.version || 1) + 1
    };

    // Never allow these fields to be written
    delete updateData.reference;
    delete updateData.type;
    delete updateData.createdBy;
    delete updateData.createdAt;
    delete updateData.createdByName;
    delete updateData.createdByCompany;

    await listingRef.update(updateData);

    // History
    await db.collection('listingHistory').add({
      listingId,
      version: updateData.version,
      action: 'updated',
      changedBy: user.uid,
      changedAt: firebase.firestore.FieldValue.serverTimestamp(),
      changes: updateData
    });

    await db.collection('activity').add({
      type: 'listing_updated',
      listingId,
      reference: existing.reference,
      userId: user.uid,
      timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });

    return { id: listingId, ...existing, ...updateData };
  }

  async function setStatus(listingId, status) {
    const allowed = ['active', 'pending', 'expired', 'archived'];
    if (!allowed.includes(status)) throw new Error('Invalid status.');
    return update(listingId, { status });
  }

  async function getById(listingId) {
    const snap = await db.collection('listings').doc(listingId).get();
    if (!snap.exists) return null;
    return { id: snap.id, ...snap.data() };
  }

  async function query(filters = {}) {
    let q = db.collection('listings');

    if (filters.type) q = q.where('type', '==', filters.type);
    if (filters.status) q = q.where('status', '==', filters.status);
    if (filters.createdBy) q = q.where('createdBy', '==', filters.createdBy);

    q = q.orderBy('createdAt', 'desc');
    if (filters.limit) q = q.limit(filters.limit);

    const snap = await q.get();
    let results = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    // Client-side text search
    if (filters.search && filters.search.trim()) {
      const term = filters.search.trim().toLowerCase();
      results = results.filter(l =>
        (l.reference && l.reference.toLowerCase().includes(term)) ||
        (l.commodity && l.commodity.toLowerCase().includes(term)) ||
        (l.commodityOther && l.commodityOther.toLowerCase().includes(term)) ||
        (l.remarks && l.remarks.toLowerCase().includes(term)) ||
        (l.location && l.location.toLowerCase().includes(term))
      );
    }

    return results;
  }

  /**
   * For Operators only: look up the real identity of a listing creator
   */
  async function getCreatorProfile(uid) {
    if (!JerichoAuth.isOperator()) {
      throw new Error('Only operators can view identity.');
    }
    const snap = await db.collection('users').doc(uid).get();
    if (!snap.exists) return null;
    return { uid, ...snap.data() };
  }

  return {
    init,
    create,
    update,
    setStatus,
    getById,
    query,
    getCreatorProfile
  };
})();
