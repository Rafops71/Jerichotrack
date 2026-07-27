/**
 * Jericho Platform – Main Application Controller
 * Handles routing between views and role-based UI
 */

const JerichoApp = (() => {
  'use strict';

  let currentView = 'dashboard';

  function init() {
    // Auth state listener
    window.addEventListener('jericho-auth-changed', (e) => {
      const { user, profile } = e.detail;

      if (!user) {
        window.location.href = 'index.html';
        return;
      }

      if (profile && profile.status === 'pending' && profile.role !== 'operator') {
        renderPendingScreen();
        return;
      }

      if (profile && (profile.status === 'approved' || profile.role === 'operator')) {
        renderAppShell(profile);
        navigate('dashboard');
      }
    });
  }

  function renderPendingScreen() {
    document.body.innerHTML = `
      <div class="auth-page">
        <div class="auth-card">
          <div class="auth-header">
            <div class="auth-logo">Jericho</div>
          </div>
          <div class="auth-body text-center">
            <div class="alert alert-warning">
              Your account is pending operator approval.<br>
              You will be able to access the platform once approved.
            </div>
            <button class="btn btn-secondary" onclick="JerichoAuth.logout()">Sign Out</button>
          </div>
        </div>
      </div>
    `;
  }

  function renderAppShell(profile) {
    const isOp = profile.role === 'operator';

    document.body.innerHTML = `
      <div class="app-shell">
        <aside class="sidebar" id="sidebar">
          <div class="sidebar-header">Jericho</div>
          <nav class="sidebar-nav" id="sidebar-nav">
            <!-- populated below -->
          </nav>
          <div class="sidebar-footer">
            <div class="text-sm font-medium">${profile.firstName} ${profile.lastName}</div>
            <div class="text-xs">${isOp ? 'Operator' : 'Participant'}</div>
          </div>
        </aside>

        <div class="main-content">
          <header class="topbar">
            <div class="flex items-center gap-3">
              <button class="btn btn-ghost btn-sm" id="menu-toggle" style="display:none;">☰</button>
              <h1 id="page-title" style="font-size:1.15rem;font-weight:600;">Dashboard</h1>
            </div>
            <div class="flex items-center gap-3">
              <button class="btn btn-ghost btn-sm" id="logout-btn">Sign Out</button>
            </div>
          </header>
          <main class="page-content" id="page-content">
            <!-- dynamic content -->
          </main>
        </div>
      </div>
    `;

    // Build navigation
    const nav = document.getElementById('sidebar-nav');
    const items = isOp ? getOperatorNav() : getParticipantNav();
    nav.innerHTML = items.map(item => `
      <a href="#" class="nav-item" data-view="${item.view}">
        ${item.label}
      </a>
    `).join('');

    // Nav click handlers
    nav.querySelectorAll('.nav-item').forEach(el => {
      el.addEventListener('click', (e) => {
        e.preventDefault();
        navigate(el.dataset.view);
      });
    });

    document.getElementById('logout-btn').addEventListener('click', () => {
      JerichoAuth.logout();
    });

    // Mobile menu
    const menuBtn = document.getElementById('menu-toggle');
    if (window.innerWidth < 900) {
      menuBtn.style.display = 'inline-flex';
      menuBtn.addEventListener('click', () => {
        document.getElementById('sidebar').classList.toggle('open');
      });
    }
  }

  function getParticipantNav() {
    return [
      { view: 'dashboard', label: 'Dashboard' },
      { view: 'my-listings', label: 'My Listings' },
      { view: 'create-listing', label: 'New Listing' },
      { view: 'profile', label: 'Profile' }
    ];
  }

  function getOperatorNav() {
    return [
      { view: 'dashboard', label: 'Dashboard' },
      { view: 'pending-users', label: 'Pending Approvals' },
      { view: 'all-listings', label: 'All Listings' },
      { view: 'invitations', label: 'Invitations' },
      { view: 'users', label: 'User Management' },
      { view: 'commodities', label: 'Commodities' },
      { view: 'documents', label: 'Document Queue' },
      { view: 'activity', label: 'Recent Activity' },
      { view: 'search', label: 'Search' }
    ];
  }

  function navigate(view) {
    currentView = view;

    // Update active nav
    document.querySelectorAll('.nav-item').forEach(el => {
      el.classList.toggle('active', el.dataset.view === view);
    });

    const titles = {
      'dashboard': 'Dashboard',
      'my-listings': 'My Listings',
      'create-listing': 'New Listing',
      'profile': 'Profile',
      'pending-users': 'Pending Approvals',
      'all-listings': 'All Listings',
      'invitations': 'Invitations',
      'users': 'User Management',
      'commodities': 'Commodities',
      'documents': 'Document Review Queue',
      'activity': 'Recent Activity',
      'search': 'Search'
    };
    document.getElementById('page-title').textContent = titles[view] || 'Jericho';

    const content = document.getElementById('page-content');
    content.innerHTML = '<div class="text-center text-muted" style="padding:3rem;"><div class="spinner" style="margin:0 auto;"></div></div>';

    // Load the appropriate view
    setTimeout(() => loadView(view, content), 50);
  }

  async function loadView(view, container) {
    try {
      switch (view) {
        case 'dashboard':
          await renderDashboard(container);
          break;
        case 'my-listings':
          await renderMyListings(container);
          break;
        case 'create-listing':
          renderCreateListing(container);
          break;
        case 'profile':
          renderProfile(container);
          break;
        case 'pending-users':
          await renderPendingUsers(container);
          break;
        case 'all-listings':
          await renderAllListings(container);
          break;
        case 'invitations':
          await renderInvitations(container);
          break;
        case 'users':
          await renderUsers(container);
          break;
        case 'commodities':
          await renderCommodities(container);
          break;
        case 'documents':
          await renderDocumentQueue(container);
          break;
        case 'activity':
          await renderActivity(container);
          break;
        case 'search':
          renderSearch(container);
          break;
        default:
          container.innerHTML = '<div class="empty-state"><h3>View not found</h3></div>';
      }
    } catch (err) {
      console.error(err);
      container.innerHTML = `<div class="alert alert-danger">Failed to load view: ${err.message}</div>`;
    }
  }

  // ========== VIEW RENDERERS ==========

  async function renderDashboard(container) {
    const profile = JerichoAuth.getCurrentProfile();
    const isOp = JerichoAuth.isOperator();

    if (isOp) {
      const [pendingUsers, recentListings, activity] = await Promise.all([
        db.collection('users').where('status', '==', 'pending').get(),
        db.collection('listings').orderBy('createdAt', 'desc').limit(5).get(),
        db.collection('activity').orderBy('timestamp', 'desc').limit(8).get()
      ]);

      container.innerHTML = `
        <div class="flex gap-4" style="flex-wrap:wrap; margin-bottom:1.5rem;">
          <div class="card" style="flex:1;min-width:180px;">
            <div class="card-body">
              <div class="text-sm text-muted">Pending Approvals</div>
              <div style="font-size:1.75rem;font-weight:600;">${pendingUsers.size}</div>
            </div>
          </div>
          <div class="card" style="flex:1;min-width:180px;">
            <div class="card-body">
              <div class="text-sm text-muted">Recent Listings</div>
              <div style="font-size:1.75rem;font-weight:600;">${recentListings.size}</div>
            </div>
          </div>
        </div>

        <div class="card mb-4">
          <div class="card-header"><h3>Latest Listings</h3></div>
          <div class="card-body table-wrapper">
            ${renderListingsTable(recentListings.docs.map(d => ({id:d.id, ...d.data()})), true)}
          </div>
        </div>

        <div class="card">
          <div class="card-header"><h3>Recent Activity</h3></div>
          <div class="card-body">
            ${activity.docs.length === 0 ? '<p class="text-muted">No recent activity</p>' :
              activity.docs.map(d => {
                const a = d.data();
                return `<div class="text-sm" style="padding:0.4rem 0;border-bottom:1px solid var(--border-light);">
                  <span class="text-muted">${JerichoUtils.formatDateTime(a.timestamp)}</span> —
                  ${a.type.replace(/_/g, ' ')}
                </div>`;
              }).join('')}
          </div>
        </div>
      `;
    } else {
      const myListings = await JerichoListings.query({ createdBy: JerichoAuth.getCurrentUser().uid, limit: 10 });
      container.innerHTML = `
        <div class="card mb-4">
          <div class="card-header">
            <h3>My Listings</h3>
            <button class="btn btn-primary btn-sm" onclick="JerichoApp.navigate('create-listing')">New Listing</button>
          </div>
          <div class="card-body table-wrapper">
            ${renderListingsTable(myListings, false)}
          </div>
        </div>
      `;
    }
  }

  function renderListingsTable(listings, showIdentity) {
    if (!listings || listings.length === 0) {
      return '<div class="empty-state"><p>No listings yet</p></div>';
    }
    return `
      <table>
        <thead>
          <tr>
            <th>Reference</th>
            <th>Type</th>
            <th>Commodity</th>
            <th>Quantity</th>
            <th>Status</th>
            <th>Created</th>
            ${showIdentity ? '<th>Posted by (UID)</th>' : ''}
          </tr>
        </thead>
        <tbody>
          ${listings.map(l => `
            <tr>
              <td><span class="ref-number">${l.reference || '—'}</span></td>
              <td>${l.type}</td>
              <td>${l.commodity}${l.commodityOther ? ' (' + l.commodityOther + ')' : ''}</td>
              <td>${l.quantity} ${l.unit || ''}</td>
              <td><span class="badge badge-${l.status === 'active' ? 'success' : 'neutral'}">${l.status}</span></td>
              <td>${JerichoUtils.formatDate(l.createdAt)}</td>
              ${showIdentity ? `<td><code style="font-size:0.75rem">${l.createdBy || ''}</code></td>` : ''}
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  }

  async function renderMyListings(container) {
    const listings = await JerichoListings.query({ createdBy: JerichoAuth.getCurrentUser().uid });
    container.innerHTML = `
      <div class="card">
        <div class="card-header">
          <h3>My Listings</h3>
          <button class="btn btn-primary btn-sm" onclick="JerichoApp.navigate('create-listing')">New Listing</button>
        </div>
        <div class="card-body table-wrapper">
          ${renderListingsTable(listings, false)}
        </div>
      </div>
    `;
  }

  function renderCreateListing(container) {
    const commodities = JerichoCommodities.getCached();
    container.innerHTML = `
      <div class="card" style="max-width:640px;">
        <div class="card-header"><h3>Create New Listing</h3></div>
        <div class="card-body">
          <form id="create-listing-form">
            <div class="form-group">
              <label class="form-label">Type <span class="required">*</span></label>
              <select class="form-select" id="listing-type" required>
                <option value="">Select…</option>
                <option value="SELL">Sell Offer</option>
                <option value="BUY">Buy Request</option>
              </select>
            </div>

            <div class="form-group">
              <label class="form-label">Commodity <span class="required">*</span></label>
              <select class="form-select" id="commodity" required>
                <option value="">Select commodity…</option>
                ${commodities.map(c => `<option value="${c.name}">${c.name}</option>`).join('')}
                <option value="__OTHER__">Other…</option>
              </select>
            </div>

            <div class="form-group hidden" id="commodity-other-group">
              <label class="form-label">Specify commodity <span class="required">*</span></label>
              <input class="form-input" type="text" id="commodity-other" />
            </div>

            <div class="form-group" style="display:flex;gap:0.75rem;">
              <div style="flex:2;">
                <label class="form-label">Quantity <span class="required">*</span></label>
                <input class="form-input" type="text" id="quantity" required placeholder="e.g. 5000" />
              </div>
              <div style="flex:1;">
                <label class="form-label">Unit <span class="required">*</span></label>
                <input class="form-input" type="text" id="unit" required placeholder="MT" />
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">Incoterm <span class="required">*</span></label>
              <select class="form-select" id="incoterm" required>
                <option value="">Select…</option>
                <option>FOB</option><option>CIF</option><option>CFR</option>
                <option>EXW</option><option>FCA</option><option>DAP</option><option>DDP</option>
              </select>
            </div>

            <div class="form-group">
              <label class="form-label" id="location-label">Origin / Destination <span class="required">*</span></label>
              <input class="form-input" type="text" id="location" required />
            </div>

            <div class="form-group">
              <label class="form-label">Price basis <span class="required">*</span></label>
              <input class="form-input" type="text" id="price-basis" required placeholder="e.g. USD/MT" />
            </div>

            <div class="form-group">
              <label class="form-label">Remarks</label>
              <textarea class="form-textarea" id="remarks" rows="3"></textarea>
            </div>

            <div class="form-group">
              <label class="form-label">Supporting document <span class="required">*</span></label>
              <input class="form-input" type="file" id="document" required accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.zip" />
              <p class="form-hint">PDF, Word, Excel, Images or ZIP – max 20 MB</p>
            </div>

            <div id="form-alert"></div>

            <button type="submit" class="btn btn-primary" id="submit-listing">Publish Listing</button>
          </form>
        </div>
      </div>
    `;

    // Dynamic location label
    document.getElementById('incoterm').addEventListener('change', (e) => {
      document.getElementById('location-label').innerHTML =
        JerichoUtils.getLocationLabel(e.target.value) + ' <span class="required">*</span>';
    });

    // Other commodity
    document.getElementById('commodity').addEventListener('change', (e) => {
      const group = document.getElementById('commodity-other-group');
      if (e.target.value === '__OTHER__') {
        group.classList.remove('hidden');
        document.getElementById('commodity-other').required = true;
      } else {
        group.classList.add('hidden');
        document.getElementById('commodity-other').required = false;
      }
    });

    document.getElementById('create-listing-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const alertBox = document.getElementById('form-alert');
      const btn = document.getElementById('submit-listing');
      btn.disabled = true;
      btn.textContent = 'Publishing…';

      try {
        const commodityVal = document.getElementById('commodity').value;
        const data = {
          type: document.getElementById('listing-type').value,
          commodity: commodityVal === '__OTHER__' ? 'Other' : commodityVal,
          commodityOther: commodityVal === '__OTHER__' ? document.getElementById('commodity-other').value.trim() : null,
          quantity: document.getElementById('quantity').value.trim(),
          unit: document.getElementById('unit').value.trim(),
          incoterm: document.getElementById('incoterm').value,
          location: document.getElementById('location').value.trim(),
          priceBasis: document.getElementById('price-basis').value.trim(),
          remarks: document.getElementById('remarks').value.trim()
        };

        const listing = await JerichoListings.create(data);

        // Upload document
        const fileInput = document.getElementById('document');
        if (fileInput.files[0]) {
          await JerichoStorage.uploadDocument(fileInput.files[0], listing.id);
        }

        JerichoUtils.showToast('Listing published successfully: ' + listing.reference, 'success');
        navigate('my-listings');
      } catch (err) {
        console.error(err);
        alertBox.innerHTML = `<div class="alert alert-danger">${err.message}</div>`;
        btn.disabled = false;
        btn.textContent = 'Publish Listing';
      }
    });
  }

  function renderProfile(container) {
    const p = JerichoAuth.getCurrentProfile();
    container.innerHTML = `
      <div class="card" style="max-width:480px;">
        <div class="card-header"><h3>My Profile</h3></div>
        <div class="card-body">
          <p><strong>Name:</strong> ${p.firstName} ${p.lastName}</p>
          <p><strong>Company:</strong> ${p.company}</p>
          <p><strong>Country:</strong> ${p.country}</p>
          <p><strong>Email:</strong> ${p.email}</p>
          <p><strong>Telephone:</strong> ${p.telephone}</p>
          <p><strong>Status:</strong> <span class="badge badge-success">${p.status}</span></p>
        </div>
      </div>
    `;
  }

  // Operator views (simplified but functional)
  async function renderPendingUsers(container) {
    const snap = await db.collection('users').where('status', '==', 'pending').get();
    const users = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    container.innerHTML = `
      <div class="card">
        <div class="card-header"><h3>Pending Approvals (${users.length})</h3></div>
        <div class="card-body table-wrapper">
          ${users.length === 0 ? '<p class="text-muted">No pending registrations</p>' : `
            <table>
              <thead><tr><th>Name</th><th>Company</th><th>Email</th><th>Country</th><th>Actions</th></tr></thead>
              <tbody>
                ${users.map(u => `
                  <tr>
                    <td>${u.firstName} ${u.lastName}</td>
                    <td>${u.company}</td>
                    <td>${u.email}</td>
                    <td>${u.country}</td>
                    <td>
                      <button class="btn btn-primary btn-sm" onclick="JerichoApp.approveUser('${u.id}')">Approve</button>
                      <button class="btn btn-danger btn-sm" onclick="JerichoApp.rejectUser('${u.id}')">Reject</button>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          `}
        </div>
      </div>
    `;
  }

  async function approveUser(uid) {
    await db.collection('users').doc(uid).update({
      status: 'approved',
      approvedAt: firebase.firestore.FieldValue.serverTimestamp(),
      approvedBy: JerichoAuth.getCurrentUser().uid
    });
    await db.collection('activity').add({
      type: 'user_approved',
      userId: uid,
      by: JerichoAuth.getCurrentUser().uid,
      timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });
    JerichoUtils.showToast('User approved', 'success');
    navigate('pending-users');
  }

  async function rejectUser(uid) {
    if (!confirm('Reject and disable this user?')) return;
    await db.collection('users').doc(uid).update({
      status: 'rejected',
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    JerichoUtils.showToast('User rejected', 'info');
    navigate('pending-users');
  }

  async function renderAllListings(container) {
    const listings = await JerichoListings.query({ limit: 50 });
    container.innerHTML = `
      <div class="card">
        <div class="card-header"><h3>All Listings</h3></div>
        <div class="card-body table-wrapper">
          ${renderListingsTable(listings, true)}
        </div>
      </div>
    `;
  }

  async function renderInvitations(container) {
    container.innerHTML = `
      <div class="card mb-4" style="max-width:480px;">
        <div class="card-header"><h3>Send Invitation</h3></div>
        <div class="card-body">
          <form id="invite-form">
            <div class="form-group">
              <label class="form-label">Recipient email <span class="required">*</span></label>
              <input class="form-input" type="email" id="invite-email" required />
            </div>
            <div class="form-group">
              <label class="form-label">Recipient name (optional)</label>
              <input class="form-input" type="text" id="invite-name" />
            </div>
            <button type="submit" class="btn btn-primary">Generate & Send Invitation</button>
          </form>
          <div id="invite-result" class="mt-4"></div>
        </div>
      </div>
    `;

    document.getElementById('invite-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('invite-email').value.trim();
      const name = document.getElementById('invite-name').value.trim();
      try {
        const result = await JerichoInvitations.createInvitation(email, name);
        document.getElementById('invite-result').innerHTML = `
          <div class="alert alert-success">
            Invitation sent to ${email}.<br>
            <small>Link: <code style="word-break:break-all;">${result.link}</code></small>
          </div>
        `;
      } catch (err) {
        document.getElementById('invite-result').innerHTML = `<div class="alert alert-danger">${err.message}</div>`;
      }
    });
  }

  async function renderUsers(container) {
    const snap = await db.collection('users').orderBy('createdAt', 'desc').limit(50).get();
    const users = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    container.innerHTML = `
      <div class="card">
        <div class="card-header"><h3>All Users</h3></div>
        <div class="card-body table-wrapper">
          <table>
            <thead><tr><th>Name</th><th>Company</th><th>Email</th><th>Role</th><th>Status</th></tr></thead>
            <tbody>
              ${users.map(u => `
                <tr>
                  <td>${u.firstName} ${u.lastName}</td>
                  <td>${u.company}</td>
                  <td>${u.email}</td>
                  <td>${u.role}</td>
                  <td><span class="badge badge-${u.status === 'approved' ? 'success' : u.status === 'pending' ? 'warning' : 'danger'}">${u.status}</span></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  async function renderCommodities(container) {
    await JerichoCommodities.loadAll();
    const list = JerichoCommodities.getCached();
    container.innerHTML = `
      <div class="card mb-4" style="max-width:420px;">
        <div class="card-header"><h3>Add Commodity</h3></div>
        <div class="card-body">
          <form id="add-commodity-form" class="flex gap-2">
            <input class="form-input" type="text" id="new-commodity" placeholder="Commodity name" required />
            <button class="btn btn-primary" type="submit">Add</button>
          </form>
        </div>
      </div>
      <div class="card">
        <div class="card-header"><h3>Commodity List (${list.length})</h3></div>
        <div class="card-body">
          ${list.length === 0 ? '<p class="text-muted">No commodities yet. Add the first one.</p>' :
            `<ul style="list-style:none;">${list.map(c => `
              <li style="padding:0.5rem 0;border-bottom:1px solid var(--border-light);display:flex;justify-content:space-between;align-items:center;">
                <span>${c.name}</span>
                <button class="btn btn-ghost btn-sm" onclick="JerichoApp.removeCommodity('${c.id}')">Remove</button>
              </li>
            `).join('')}</ul>`}
        </div>
      </div>
    `;

    document.getElementById('add-commodity-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('new-commodity').value;
      try {
        await JerichoCommodities.add(name);
        JerichoUtils.showToast('Commodity added', 'success');
        renderCommodities(container);
      } catch (err) {
        JerichoUtils.showToast(err.message, 'danger');
      }
    });
  }

  async function removeCommodity(id) {
    if (!confirm('Remove this commodity?')) return;
    await JerichoCommodities.remove(id);
    JerichoUtils.showToast('Removed', 'info');
    navigate('commodities');
  }

  async function renderDocumentQueue(container) {
    const snap = await db.collection('documents').where('status', '==', 'pending_review').orderBy('uploadedAt', 'desc').limit(30).get();
    const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    container.innerHTML = `
      <div class="card">
        <div class="card-header"><h3>Document Review Queue</h3></div>
        <div class="card-body table-wrapper">
          ${docs.length === 0 ? '<p class="text-muted">No documents pending review</p>' : `
            <table>
              <thead><tr><th>File</th><th>Listing</th><th>Uploaded</th><th>Size</th><th>Action</th></tr></thead>
              <tbody>
                ${docs.map(d => `
                  <tr>
                    <td>${d.fileName}</td>
                    <td>${d.listingId}</td>
                    <td>${JerichoUtils.formatDateTime(d.uploadedAt)}</td>
                    <td>${(d.size / 1024 / 1024).toFixed(2)} MB</td>
                    <td><a href="${d.downloadURL}" target="_blank" class="btn btn-sm btn-secondary">View</a></td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          `}
        </div>
      </div>
    `;
  }

  async function renderActivity(container) {
    const snap = await db.collection('activity').orderBy('timestamp', 'desc').limit(40).get();
    container.innerHTML = `
      <div class="card">
        <div class="card-header"><h3>Recent Activity</h3></div>
        <div class="card-body">
          ${snap.docs.map(d => {
            const a = d.data();
            return `<div class="text-sm" style="padding:0.45rem 0;border-bottom:1px solid var(--border-light);">
              <span class="text-muted">${JerichoUtils.formatDateTime(a.timestamp)}</span> — ${a.type.replace(/_/g, ' ')}
            </div>`;
          }).join('') || '<p class="text-muted">No activity yet</p>'}
        </div>
      </div>
    `;
  }

  function renderSearch(container) {
    container.innerHTML = `
      <div class="card mb-4">
        <div class="card-body">
          <div class="flex gap-2">
            <input class="form-input" type="search" id="search-input" placeholder="Search by reference, commodity, location…" />
            <button class="btn btn-primary" id="search-btn">Search</button>
          </div>
        </div>
      </div>
      <div id="search-results"></div>
    `;

    const doSearch = async () => {
      const term = document.getElementById('search-input').value.trim();
      const results = await JerichoListings.query({ search: term, limit: 50 });
      document.getElementById('search-results').innerHTML = `
        <div class="card">
          <div class="card-header"><h3>Results (${results.length})</h3></div>
          <div class="card-body table-wrapper">
            ${renderListingsTable(results, true)}
          </div>
        </div>
      `;
    };

    document.getElementById('search-btn').addEventListener('click', doSearch);
    document.getElementById('search-input').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') doSearch();
    });
  }

  // Public API
  return {
    init,
    navigate,
    approveUser,
    rejectUser,
    removeCommodity
  };
})();
