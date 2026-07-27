/**
 * Jericho Platform – Commodity list management (operator controlled)
 */

const JerichoCommodities = (() => {
  'use strict';

  let db = null;
  let cache = [];

  function init(firestore) {
    db = firestore;
  }

  async function loadAll() {
    const snap = await db.collection('commodities')
      .orderBy('name')
      .get();
    cache = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    return cache;
  }

  function getCached() {
    return cache;
  }

  async function add(name) {
    if (!JerichoAuth.isOperator()) throw new Error('Only operators can manage commodities.');
    const clean = name.trim();
    if (!clean) throw new Error('Commodity name is required.');

    // Prevent duplicates (case-insensitive)
    const existing = cache.find(c => c.name.toLowerCase() === clean.toLowerCase());
    if (existing) throw new Error('This commodity already exists.');

    const docRef = await db.collection('commodities').add({
      name: clean,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      createdBy: JerichoAuth.getCurrentUser().uid
    });

    cache.push({ id: docRef.id, name: clean });
    cache.sort((a, b) => a.name.localeCompare(b.name));
    return docRef.id;
  }

  async function remove(id) {
    if (!JerichoAuth.isOperator()) throw new Error('Only operators can manage commodities.');
    await db.collection('commodities').doc(id).delete();
    cache = cache.filter(c => c.id !== id);
  }

  async function update(id, newName) {
    if (!JerichoAuth.isOperator()) throw new Error('Only operators can manage commodities.');
    const clean = newName.trim();
    if (!clean) throw new Error('Commodity name is required.');

    await db.collection('commodities').doc(id).update({
      name: clean,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    const item = cache.find(c => c.id === id);
    if (item) item.name = clean;
    cache.sort((a, b) => a.name.localeCompare(b.name));
  }

  return {
    init,
    loadAll,
    getCached,
    add,
    remove,
    update
  };
})();
