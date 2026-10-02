/**
 * Sollu - Shopkeeper Dashboard Controller
 * Real-time 5-second polling, Web Audio chime alerts, order status updates, item editing, and catalog management.
 */

document.addEventListener('DOMContentLoaded', () => {
    const shopId = window.SOLLU_SHOP_ID || 1;
    let knownPendingOrderIds = new Set();
    let currentOrders = [];
    let isInitialFetch = true;
    let editingOrder = null;

    // Elements
    const ordersListContainer = document.getElementById('ordersListContainer');
    const pendingBadgeCount = document.getElementById('pendingBadgeCount');
    const lastUpdatedTime = document.getElementById('lastUpdatedTime');
    const audioToggleBtn = document.getElementById('audioToggleBtn');
    let soundEnabled = true;

    // Web Audio API Synthesizer for Bell Chime (no external files needed)
    function playChimeNotification() {
        if (!soundEnabled) return;
        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (!AudioContext) return;
            const ctx = new AudioContext();

            // Two-tone grocery bell
            const playTone = (freq, start, duration) => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(freq, ctx.currentTime + start);

                gain.gain.setValueAtTime(0.3, ctx.currentTime + start);
                gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + duration);

                osc.connect(gain);
                gain.connect(ctx.destination);

                osc.start(ctx.currentTime + start);
                osc.stop(ctx.currentTime + start + duration);
            };

            playTone(880, 0, 0.4);      // A5
            playTone(1174.66, 0.15, 0.6); // D6
        } catch (e) {
            console.warn('Audio playback error:', e);
        }
    }

    if (audioToggleBtn) {
        audioToggleBtn.addEventListener('click', () => {
            soundEnabled = !soundEnabled;
            audioToggleBtn.innerHTML = soundEnabled 
                ? '<i class="bi bi-volume-up-fill text-success"></i> Sound On'
                : '<i class="bi bi-volume-mute-fill text-danger"></i> Muted';
        });
    }

    // 1. Fetch Orders via Polling (every 5 seconds)
    async function fetchOrders() {
        try {
            const res = await fetch(`api/get_orders.php?shop_id=${shopId}&t=${Date.now()}`);
            const data = await res.json();

            if (!data.success) {
                console.error('Failed to fetch orders:', data.error);
                return;
            }

            currentOrders = data.orders || [];
            if (pendingBadgeCount) {
                pendingBadgeCount.textContent = data.pending_count || 0;
            }
            if (lastUpdatedTime) {
                const now = new Date();
                lastUpdatedTime.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
            }

            // Detect newly arrived pending orders
            let newOrderFound = false;
            const currentPendingIds = new Set();

            currentOrders.forEach(o => {
                if (o.status === 'pending') {
                    currentPendingIds.add(o.id);
                    if (!isInitialFetch && !knownPendingOrderIds.has(o.id)) {
                        newOrderFound = true;
                    }
                }
            });

            if (newOrderFound) {
                playChimeNotification();
            }

            knownPendingOrderIds = currentPendingIds;
            isInitialFetch = false;

            renderOrdersList();

        } catch (err) {
            console.error('Polling error:', err);
        }
    }

    // Render Orders in Tab
    function renderOrdersList() {
        if (!ordersListContainer) return;

        const activeFilter = document.querySelector('.order-filter-btn.active')?.dataset.filter || 'all';
        const filtered = currentOrders.filter(o => {
            if (activeFilter === 'all') return true;
            return o.status === activeFilter;
        });

        if (filtered.length === 0) {
            ordersListContainer.innerHTML = `
                <div class="text-center py-5 bg-white rounded-4 border p-4">
                    <i class="bi bi-inbox fs-1 text-muted d-block mb-2"></i>
                    <h5 class="text-muted fw-bold">ஆர்டர்கள் எதுவும் இல்லை (No orders found)</h5>
                    <p class="small text-muted mb-0">New voice orders placed by customers will appear here automatically every 5 seconds.</p>
                </div>
            `;
            return;
        }

        ordersListContainer.innerHTML = filtered.map(order => {
            const isPending = order.status === 'pending';
            const isAccepted = order.status === 'accepted';
            const isRejected = order.status === 'rejected';

            let highlightClass = isPending ? 'pending-highlight' : (isAccepted ? 'accepted-highlight' : 'rejected-highlight');
            let badgeClass = isPending ? 'order-badge-pending' : (isAccepted ? 'order-badge-accepted' : 'order-badge-rejected');
            let statusText = isPending ? 'Pending (புதியது)' : (isAccepted ? 'Accepted (ஏற்றுக்கொள்ளப்பட்டது)' : (isRejected ? 'Rejected (நிராகரிக்கப்பட்டது)' : 'Completed'));

            let itemsListHtml = order.items.map(it => `
                <li class="list-group-item d-flex justify-content-between align-items-center py-2 px-3 border-0 bg-transparent">
                    <div>
                        <span class="fw-bold text-dark">${it.name}</span>
                        <span class="badge bg-light text-dark border ms-1">${it.quantity} ${it.unit}</span>
                    </div>
                    <div class="fw-semibold text-muted">₹${it.line_total.toFixed(2)}</div>
                </li>
            `).join('');

            let rawSpeechSnippet = order.transcript_raw ? `
                <div class="mt-2 p-2 bg-light rounded text-muted small border-start border-3 border-warning">
                    <strong><i class="bi bi-chat-quote-fill me-1"></i> வாடிக்கையாளர் குரல் குறிப்பு (Voice note):</strong>
                    <div class="fst-italic">"${escapeHtml(order.transcript_raw)}"</div>
                </div>
            ` : '';

            // Action Buttons
            let actionButtons = '';
            if (isPending) {
                actionButtons = `
                    <div class="d-flex gap-2 flex-wrap justify-content-end mt-3 pt-2 border-top">
                        <button class="btn btn-outline-secondary btn-sm px-3 py-2 rounded-pill btn-edit-order" data-id="${order.id}">
                            <i class="bi bi-pencil-square"></i> Edit Items
                        </button>
                        <button class="btn btn-outline-danger btn-sm px-3 py-2 rounded-pill btn-reject-order" data-id="${order.id}">
                            <i class="bi bi-x-circle"></i> Reject
                        </button>
                        <button class="btn btn-success btn-sm px-4 py-2 rounded-pill fw-bold btn-accept-order" data-id="${order.id}">
                            <i class="bi bi-check-circle-fill"></i> Accept Order
                        </button>
                    </div>
                `;
            } else if (isAccepted) {
                actionButtons = `
                    <div class="d-flex gap-2 justify-content-end mt-3 pt-2 border-top">
                        <span class="text-success fw-bold me-auto align-self-center"><i class="bi bi-truck me-1"></i> Order Accepted</span>
                        <button class="btn btn-outline-success btn-sm rounded-pill btn-complete-order" data-id="${order.id}">
                            <i class="bi bi-check2-all"></i> Mark Completed
                        </button>
                    </div>
                `;
            }

            return `
                <div class="order-card ${highlightClass}">
                    <div class="d-flex justify-content-between align-items-start mb-2">
                        <div>
                            <div class="d-flex align-items-center gap-2">
                                <span class="fs-5 fw-bolder text-dark">Order #${order.id}</span>
                                <span class="badge ${badgeClass} px-2 py-1 rounded-pill">${statusText}</span>
                            </div>
                            <div class="order-timestamp mt-1">
                                <i class="bi bi-clock me-1"></i> ${new Date(order.created_at).toLocaleString()}
                            </div>
                        </div>
                        <div class="text-end">
                            <div class="fs-4 fw-bolder text-success">₹${order.total_amount.toFixed(2)}</div>
                            <a href="tel:${order.customer_phone}" class="btn btn-sm btn-outline-dark rounded-pill mt-1">
                                <i class="bi bi-telephone-fill me-1 text-success"></i> ${order.customer_phone}
                            </a>
                        </div>
                    </div>

                    <!-- Items List -->
                    <ul class="list-group list-group-flush border rounded-3 bg-white my-2">
                        ${itemsListHtml}
                    </ul>

                    ${rawSpeechSnippet}
                    ${actionButtons}
                </div>
            `;
        }).join('');

        attachOrderActionListeners();
    }

    // Attach click listeners for Accept, Reject, Edit, Complete
    function attachOrderActionListeners() {
        document.querySelectorAll('.btn-accept-order').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const orderId = parseInt(e.currentTarget.dataset.id);
                await updateOrderStatus(orderId, 'accepted');
            });
        });

        document.querySelectorAll('.btn-reject-order').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const orderId = parseInt(e.currentTarget.dataset.id);
                if (confirm('Are you sure you want to reject this order?')) {
                    await updateOrderStatus(orderId, 'rejected');
                }
            });
        });

        document.querySelectorAll('.btn-complete-order').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const orderId = parseInt(e.currentTarget.dataset.id);
                await updateOrderStatus(orderId, 'completed');
            });
        });

        document.querySelectorAll('.btn-edit-order').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const orderId = parseInt(e.currentTarget.dataset.id);
                openEditOrderModal(orderId);
            });
        });
    }

    // Update order status API call
    async function updateOrderStatus(orderId, newStatus, updatedItems = null) {
        try {
            const payload = {
                order_id: orderId,
                status: newStatus
            };
            if (updatedItems) {
                payload.items = updatedItems;
            }

            const res = await fetch('api/update_order_status.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const data = await res.json();
            if (data.success) {
                await fetchOrders();
            } else {
                alert('Error updating order: ' + data.error);
            }
        } catch (err) {
            console.error('Update status error:', err);
            alert('Failed to update status');
        }
    }

    // Edit Order Modal
    const editOrderModalEl = document.getElementById('editOrderModal');
    const editOrderModal = editOrderModalEl ? new bootstrap.Modal(editOrderModalEl) : null;
    const editOrderItemsContainer = document.getElementById('editOrderItemsContainer');
    const editModalOrderTotal = document.getElementById('editModalOrderTotal');
    const btnSaveAndAcceptOrder = document.getElementById('btnSaveAndAcceptOrder');

    function openEditOrderModal(orderId) {
        editingOrder = currentOrders.find(o => o.id === orderId);
        if (!editingOrder) return;

        // Clone items array
        editingOrder.tempItems = JSON.parse(JSON.stringify(editingOrder.items));
        renderEditModalItems();
        editOrderModal.show();
    }

    function renderEditModalItems() {
        if (!editOrderItemsContainer) return;
        editOrderItemsContainer.innerHTML = '';

        if (editingOrder.tempItems.length === 0) {
            editOrderItemsContainer.innerHTML = '<div class="text-danger p-2">All items removed.</div>';
            btnSaveAndAcceptOrder.disabled = true;
            return;
        }

        btnSaveAndAcceptOrder.disabled = false;
        let runningTotal = 0;

        editingOrder.tempItems.forEach((item, idx) => {
            const lineTotal = item.quantity * item.unit_price;
            runningTotal += lineTotal;

            const row = document.createElement('div');
            row.className = 'd-flex justify-content-between align-items-center p-2 mb-2 bg-light rounded border';
            row.innerHTML = `
                <div>
                    <div class="fw-bold text-dark">${item.name}</div>
                    <div class="small text-muted">₹${item.unit_price} / ${item.unit}</div>
                </div>
                <div class="d-flex align-items-center gap-2">
                    <div class="input-group input-group-sm" style="width: 120px;">
                        <input type="number" step="0.25" min="0.25" class="form-control text-center fw-bold edit-item-qty" 
                            data-index="${idx}" value="${item.quantity}">
                        <span class="input-group-text">${item.unit}</span>
                    </div>
                    <div class="fw-bold text-success" style="min-width: 60px;">₹${lineTotal.toFixed(2)}</div>
                    <button type="button" class="btn btn-outline-danger btn-sm rounded-circle btn-delete-edit-item" data-index="${idx}">
                        <i class="bi bi-trash"></i>
                    </button>
                </div>
            `;
            editOrderItemsContainer.appendChild(row);
        });

        editModalOrderTotal.textContent = '₹' + runningTotal.toFixed(2);

        // Events inside modal
        document.querySelectorAll('.edit-item-qty').forEach(input => {
            input.addEventListener('input', (e) => {
                const idx = parseInt(e.target.dataset.index);
                const val = parseFloat(e.target.value) || 0;
                editingOrder.tempItems[idx].quantity = val;
                renderEditModalItems();
            });
        });

        document.querySelectorAll('.btn-delete-edit-item').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const idx = parseInt(e.currentTarget.dataset.index);
                editingOrder.tempItems.splice(idx, 1);
                renderEditModalItems();
            });
        });
    }

    if (btnSaveAndAcceptOrder) {
        btnSaveAndAcceptOrder.addEventListener('click', async () => {
            if (!editingOrder) return;
            await updateOrderStatus(editingOrder.id, 'accepted', editingOrder.tempItems);
            editOrderModal.hide();
        });
    }

    // Filter Buttons (All, Pending, Accepted, Completed)
    document.querySelectorAll('.order-filter-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.order-filter-btn').forEach(b => b.classList.remove('active', 'btn-warning', 'btn-success', 'btn-secondary'));
            e.currentTarget.classList.add('active');
            renderOrdersList();
        });
    });

    // 2. Manage Catalog Section Operations
    const catalogTableBody = document.getElementById('catalogTableBody');
    const catalogItemModalEl = document.getElementById('catalogItemModal');
    const catalogItemModal = catalogItemModalEl ? new bootstrap.Modal(catalogItemModalEl) : null;
    const catalogForm = document.getElementById('catalogForm');
    const btnOpenAddCatalogModal = document.getElementById('btnOpenAddCatalogModal');

    async function loadCatalog() {
        if (!catalogTableBody) return;
        try {
            const res = await fetch(`api/manage_catalog.php?shop_id=${shopId}&t=${Date.now()}`);
            const data = await res.json();
            if (!data.success) return;

            renderCatalogTable(data.catalog || []);
        } catch (err) {
            console.error('Catalog load error:', err);
        }
    }

    function renderCatalogTable(catalogItems) {
        if (!catalogTableBody) return;
        if (catalogItems.length === 0) {
            catalogTableBody.innerHTML = `<tr><td colspan="6" class="text-center py-4 text-muted">No items in catalog.</td></tr>`;
            return;
        }

        catalogTableBody.innerHTML = catalogItems.map(item => `
            <tr>
                <td class="fw-bold text-dark">${item.name}</td>
                <td><small class="text-muted">${item.aliases || '—'}</small></td>
                <td><span class="badge bg-light text-dark border">${item.unit}</span></td>
                <td class="fw-bold text-success">₹${parseFloat(item.price).toFixed(2)}</td>
                <td>
                    ${parseInt(item.is_active) === 1 
                        ? '<span class="badge bg-success">Active</span>' 
                        : '<span class="badge bg-secondary">Inactive</span>'}
                </td>
                <td class="text-end">
                    <button class="btn btn-sm btn-outline-primary me-1 btn-edit-catalog" data-item='${JSON.stringify(item)}'>
                        <i class="bi bi-pencil"></i>
                    </button>
                    <button class="btn btn-sm btn-outline-danger btn-delete-catalog" data-id="${item.id}">
                        <i class="bi bi-trash"></i>
                    </button>
                </td>
            </tr>
        `).join('');

        // Attach edit/delete listeners
        document.querySelectorAll('.btn-edit-catalog').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const item = JSON.parse(e.currentTarget.dataset.item);
                document.getElementById('catalogModalTitle').textContent = 'Edit Item (பொருளை திருத்து)';
                document.getElementById('catalogAction').value = 'update';
                document.getElementById('catalogItemId').value = item.id;
                document.getElementById('catalogName').value = item.name;
                document.getElementById('catalogAliases').value = item.aliases || '';
                document.getElementById('catalogUnit').value = item.unit;
                document.getElementById('catalogPrice').value = item.price;
                catalogItemModal.show();
            });
        });

        document.querySelectorAll('.btn-delete-catalog').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const id = parseInt(e.currentTarget.dataset.id);
                if (confirm('Delete or deactivate this catalog item?')) {
                    const res = await fetch('api/manage_catalog.php', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ action: 'delete', id: id, shop_id: shopId })
                    });
                    const d = await res.json();
                    if (d.success) loadCatalog();
                    else alert(d.error);
                }
            });
        });
    }

    if (btnOpenAddCatalogModal) {
        btnOpenAddCatalogModal.addEventListener('click', () => {
            document.getElementById('catalogModalTitle').textContent = 'Add New Item (புதிய பொருள் சேர்க்க)';
            document.getElementById('catalogAction').value = 'create';
            document.getElementById('catalogItemId').value = '';
            catalogForm.reset();
            catalogItemModal.show();
        });
    }

    if (catalogForm) {
        catalogForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const action = document.getElementById('catalogAction').value;
            const payload = {
                action: action,
                shop_id: shopId,
                id: document.getElementById('catalogItemId').value,
                name: document.getElementById('catalogName').value.trim(),
                aliases: document.getElementById('catalogAliases').value.trim(),
                unit: document.getElementById('catalogUnit').value,
                price: parseFloat(document.getElementById('catalogPrice').value) || 0
            };

            try {
                const res = await fetch('api/manage_catalog.php', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                const data = await res.json();
                if (data.success) {
                    catalogItemModal.hide();
                    loadCatalog();
                } else {
                    alert('Error saving catalog item: ' + data.error);
                }
            } catch (err) {
                console.error(err);
                alert('Save failed');
            }
        });
    }

    // Tab Switching: Orders vs Catalog
    const tabCatalogBtn = document.getElementById('tab-catalog');
    if (tabCatalogBtn) {
        tabCatalogBtn.addEventListener('shown.bs.tab', () => {
            loadCatalog();
        });
    }

    function escapeHtml(str) {
        return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
    }

    // Start 5-second polling loop
    fetchOrders();
    setInterval(fetchOrders, 5000);
});
