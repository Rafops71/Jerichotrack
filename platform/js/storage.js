/**
 * Jericho Platform – Firebase Storage helpers for documents
 */

const JerichoStorage = (() => {
  'use strict';

  let storage = null;
  let db = null;

  const ALLOWED_TYPES = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'image/jpeg',
    'image/png',
    'application/zip',
    'application/x-zip-compressed'
  ];

  const MAX_SIZE = 20 * 1024 * 1024; // 20 MB

  function init(firebaseStorage, firestore) {
    storage = firebaseStorage;
    db = firestore;
  }

  function validateFile(file) {
    if (!file) throw new Error('No file selected.');
    if (file.size > MAX_SIZE) throw new Error('File exceeds the 20 MB limit.');
    if (!ALLOWED_TYPES.includes(file.type)) {
      throw new Error('File type not allowed. Accepted: PDF, Word, Excel, JPG, PNG, ZIP.');
    }
  }

  /**
   * Upload a document linked to a listing
   * Path: documents/{userId}/{listingId}/{timestamp}_{filename}
   */
  async function uploadDocument(file, listingId) {
    validateFile(file);

    const user = JerichoAuth.getCurrentUser();
    if (!user) throw new Error('Not authenticated.');

    const safeName = JerichoUtils.sanitizeFilename(file.name);
    const timestamp = Date.now();
    const path = `documents/${user.uid}/${listingId}/${timestamp}_${safeName}`;
    const ref = storage.ref().child(path);

    const snapshot = await ref.put(file, {
      contentType: file.type,
      customMetadata: {
        originalName: file.name,
        uploadedBy: user.uid,
        listingId: listingId
      }
    });

    const downloadURL = await snapshot.ref.getDownloadURL();

    // Save metadata in Firestore
    const meta = {
      listingId,
      uploadedBy: user.uid,
      fileName: file.name,
      storagePath: path,
      downloadURL,
      contentType: file.type,
      size: file.size,
      uploadedAt: firebase.firestore.FieldValue.serverTimestamp(),
      status: 'pending_review' // for operator document review queue
    };

    const docRef = await db.collection('documents').add(meta);

    return { id: docRef.id, ...meta, downloadURL };
  }

  async function getDocumentsForListing(listingId) {
    const snap = await db.collection('documents')
      .where('listingId', '==', listingId)
      .orderBy('uploadedAt', 'desc')
      .get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  }

  async function deleteDocument(docId, storagePath) {
    // Delete from Storage
    if (storagePath) {
      try {
        await storage.ref().child(storagePath).delete();
      } catch (e) {
        console.warn('Storage delete warning:', e);
      }
    }
    // Delete metadata
    await db.collection('documents').doc(docId).delete();
  }

  return {
    init,
    uploadDocument,
    getDocumentsForListing,
    deleteDocument,
    validateFile
  };
})();
