/**
 * Sollu - Customer Ordering Application Logic
 * Voice recognition, transcript editing, LLM parsing review, UPI QR rendering, and re-order.
 */

document.addEventListener('DOMContentLoaded', () => {
    // State management
    const state = {
        lang: 'ta-IN',
        shopId: 1,
        isRecording: false,
        rawTranscript: '',
        parsedItems: [],
        unmatchedItems: [],
        catalogOptions: [],
        orderTotal: 0.00,
        confirmedOrderId: null,
        upiLink: '',
        customerPhone: localStorage.getItem('sollu_phone') || ''
    };

    // DOM Elements
    const langSelect = document.getElementById('langSelect');
    const micButton = document.getElementById('micButton');
    const micIcon = document.getElementById('micIcon');
    const micStatus = document.getElementById('micStatus');
    const transcriptInput = document.getElementById('transcriptInput');
    const clearTranscriptBtn = document.getElementById('clearTranscriptBtn');
    const btnSubmitOrder = document.getElementById('btnSubmitOrder');
    const parseLoading = document.getElementById('parseLoading');

    // Sections
    const sectionSpeech = document.getElementById('sectionSpeech');
    const sectionReview = document.getElementById('sectionReview');
    const sectionSuccess = document.getElementById('sectionSuccess');

    // Review Screen Elements
    const reviewItemsList = document.getElementById('reviewItemsList');
    const unmatchedAlert = document.getElementById('unmatchedAlert');
    const unmatchedTextList = document.getElementById('unmatchedTextList');
    const reviewGrandTotal = document.getElementById('reviewGrandTotal');
    const customerPhoneInput = document.getElementById('customerPhoneInput');
    const btnConfirmFinalOrder = document.getElementById('btnConfirmFinalOrder');
    const btnBackToSpeech = document.getElementById('btnBackToSpeech');

    // Success Screen Elements
    const successOrderId = document.getElementById('successOrderId');
    const successTotal = document.getElementById('successTotal');
    const qrContainer = document.getElementById('qrContainer');
    const btnUpiPay = document.getElementById('btnUpiPay');
    const btnNewOrder = document.getElementById('btnNewOrder');
    const btnSameAsLast = document.getElementById('btnSameAsLast');
    const btnLoadPreviousOrder = document.getElementById('btnLoadPreviousOrder');

    // Set saved phone if available
    if (state.customerPhone && customerPhoneInput) {
        customerPhoneInput.value = state.customerPhone;
    }

    // Multilingual helper texts
    const langPlaceholders = {
        'ta-IN': 'உதாரணம்: 2 கிலோ பொன்னி அரிசி, ஒரு பாக்கெட் ஆவின் பால், அரை கிலோ சர்க்கரை...',
        'hi-IN': 'उदाहरण: 2 किलो चावल, 1 पैकेट दूध, आधा किलो चीनी...',
        'en-IN': 'Example: 2 kg ponni rice, 1 packet milk, 500g sugar, 1 sunflower oil...'
    };

    // Initialize Speech Recognizer
    const speech = new SolluSpeechRecognizer({
        lang: state.lang,
        onStatusChange: (status) => {
            state.isRecording = status.isRecording;
            if (status.isRecording) {
                micButton.classList.add('recording');
                micIcon.className = 'bi bi-stop-fill';
                micStatus.textContent = status.message;
            } else {
                micButton.classList.remove('recording');
                micIcon.className = 'bi bi-mic-fill';
                micStatus.textContent = 'மைக் தட்டவும் (Tap mic to speak)';
            }
        },
        onInterimResult: ({ finalText, interimText }) => {
            transcriptInput.value = finalText + (interimText ? ' ' + interimText : '');
            btnSubmitOrder.disabled = transcriptInput.value.trim().length === 0;
        },
        onFinalResult: (finalText) => {
            transcriptInput.value = finalText;
            state.rawTranscript = finalText;
            btnSubmitOrder.disabled = finalText.trim().length === 0;
        },
        onError: (err) => {
            micStatus.textContent = err.message;
            micButton.classList.remove('recording');
            micIcon.className = 'bi bi-mic-fill';
        }
    });

    // Language Change
    langSelect.addEventListener('change', (e) => {
        state.lang = e.target.value;
        speech.setLanguage(state.lang);
        transcriptInput.placeholder = langPlaceholders[state.lang] || langPlaceholders['en-IN'];
    });

    // Mic Button Click
    micButton.addEventListener('click', () => {
        // Sync any manual edits made in textarea before toggling speech
        speech.setFinalTranscript(transcriptInput.value);
        speech.toggle();
    });

    // Textarea input monitoring
    transcriptInput.addEventListener('input', () => {
        state.rawTranscript = transcriptInput.value;
        speech.setFinalTranscript(transcriptInput.value);
        btnSubmitOrder.disabled = transcriptInput.value.trim().length === 0;
    });

    clearTranscriptBtn.addEventListener('click', () => {
        transcriptInput.value = '';
        state.rawTranscript = '';
        speech.setFinalTranscript('');
        btnSubmitOrder.disabled = true;
    });

    // Step 1 -> Step 2: Submit to /api/parse.php
    btnSubmitOrder.addEventListener('click', async () => {
        if (state.isRecording) {
            speech.stop();
        }

        const text = transcriptInput.value.trim();
        if (!text) {
            alert('Please speak or type your grocery order first.');
            return;
        }

        state.rawTranscript = text;
        setParseLoading(true);

        try {
            const response = await fetch('api/parse.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    transcript: text,
                    shop_id: state.shopId
                })
            });

            const data = await response.json();
            if (!data.success) {
                throw new Error(data.error || 'Failed to parse order');
            }

            state.parsedItems = data.items || [];
            state.unmatchedItems = data.unmatched || [];
            state.catalogOptions = data.catalog_options || [];
            state.orderTotal = data.total || 0.00;

            renderReviewScreen();
            showSection('review');
        } catch (err) {
            console.error('Parsing error:', err);
            alert('Could not match items: ' + err.message + '\nYou can edit the text and try again.');
        } finally {
            setParseLoading(false);
        }
    });

    // Back to recording screen
    btnBackToSpeech.addEventListener('click', () => {
        showSection('speech');
    });

    // Render Review Screen with Items & Confidence indicators
    function renderReviewScreen() {
        reviewItemsList.innerHTML = '';

        if (state.parsedItems.length === 0) {
            reviewItemsList.innerHTML = `
                <div class="text-center py-4 text-muted">
                    <i class="bi bi-basket3 fs-1 d-block mb-2"></i>
                    <p class="fs-5">No catalog items recognized. Try speaking items like <em>"2 kg rice, 1 packet milk"</em>.</p>
                </div>
            `;
            btnConfirmFinalOrder.disabled = true;
        } else {
            btnConfirmFinalOrder.disabled = false;
        }

        state.parsedItems.forEach((item, index) => {
            const itemRow = document.createElement('div');
            itemRow.className = 'review-item-row';
            itemRow.id = `item-row-${index}`;

            const isConfident = (item.confidence_score >= 0.70);
            const lineTotal = (item.quantity * item.unit_price).toFixed(2);

            let confidenceBadge = isConfident
                ? `<span class="confidence-pill confidence-high"><i class="bi bi-check-circle-fill"></i> Matched (${Math.round(item.confidence_score * 100)}%)</span>`
                : `<span class="confidence-pill confidence-low"><i class="bi bi-question-circle-fill"></i> Check Item (${Math.round(item.confidence_score * 100)}%)</span>`;

            // "Did you mean?" dropdown if confidence is low
            let didYouMeanSelect = '';
            if (!isConfident && state.catalogOptions.length > 0) {
                let optionsHtml = state.catalogOptions.map(opt => `
                    <option value="${opt.id}" ${opt.id === item.catalog_id ? 'selected' : ''}>
                        ${opt.name} (₹${opt.price}/${opt.unit})
                    </option>
                `).join('');

                didYouMeanSelect = `
                    <div class="mt-2 p-2 bg-light rounded border border-warning">
                        <label class="form-label small fw-bold text-dark mb-1">
                            <i class="bi bi-arrow-return-right"></i> Did you mean this item? (இதை கேட்டீர்களா?)
                        </label>
                        <select class="form-select form-select-sm did-you-mean-dropdown" data-index="${index}">
                            ${optionsHtml}
                        </select>
                    </div>
                `;
            }

            itemRow.innerHTML = `
                <div class="d-flex justify-content-between align-items-start mb-2">
                    <div>
                        <div class="fw-bold fs-5 item-display-name text-dark">${item.name}</div>
                        <div class="text-muted small">₹${item.unit_price.toFixed(2)} / ${item.unit}</div>
                    </div>
                    <div class="text-end">
                        ${confidenceBadge}
                        <div class="fw-bold fs-5 text-success mt-1 item-line-total">₹${lineTotal}</div>
                    </div>
                </div>

                ${didYouMeanSelect}

                <div class="d-flex justify-content-between align-items-center mt-3 pt-2 border-top">
                    <!-- Quantity Stepper -->
                    <div class="qty-stepper">
                        <button type="button" class="qty-btn btn-qty-minus" data-index="${index}" aria-label="Decrease quantity">−</button>
                        <span class="qty-display" id="qty-val-${index}">${item.quantity}</span>
                        <span class="small text-muted pe-2">${item.unit}</span>
                        <button type="button" class="qty-btn btn-qty-plus" data-index="${index}" aria-label="Increase quantity">+</button>
                    </div>

                    <!-- Delete button -->
                    <button type="button" class="btn btn-outline-danger btn-sm rounded-pill px-3 py-2 btn-remove-item" data-index="${index}">
                        <i class="bi bi-trash3"></i> Remove
                    </button>
                </div>
            `;

            reviewItemsList.appendChild(itemRow);
        });

        // Unmatched words alert
        if (state.unmatchedItems && state.unmatchedItems.length > 0) {
            unmatchedAlert.classList.remove('d-none');
            unmatchedTextList.textContent = state.unmatchedItems.join(', ');
        } else {
            unmatchedAlert.classList.add('d-none');
        }

        recalculateTotals();
        attachReviewRowEvents();
    }

    // Attach row events (plus, minus, did you mean, remove)
    function attachReviewRowEvents() {
        // Plus quantity
        document.querySelectorAll('.btn-qty-plus').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const idx = parseInt(e.currentTarget.dataset.index);
                state.parsedItems[idx].quantity += 1;
                updateItemDisplay(idx);
            });
        });

        // Minus quantity
        document.querySelectorAll('.btn-qty-minus').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const idx = parseInt(e.currentTarget.dataset.index);
                if (state.parsedItems[idx].quantity > 1) {
                    state.parsedItems[idx].quantity -= 1;
                    updateItemDisplay(idx);
                } else if (state.parsedItems[idx].quantity > 0.25) {
                    state.parsedItems[idx].quantity = 0.5;
                    updateItemDisplay(idx);
                }
            });
        });

        // Remove item
        document.querySelectorAll('.btn-remove-item').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const idx = parseInt(e.currentTarget.dataset.index);
                state.parsedItems.splice(idx, 1);
                renderReviewScreen();
            });
        });

        // "Did you mean?" dropdown selection change
        document.querySelectorAll('.did-you-mean-dropdown').forEach(sel => {
            sel.addEventListener('change', (e) => {
                const idx = parseInt(e.target.dataset.index);
                const selectedCatId = parseInt(e.target.value);
                const catalogMatch = state.catalogOptions.find(c => c.id === selectedCatId);

                if (catalogMatch) {
                    state.parsedItems[idx].catalog_id = catalogMatch.id;
                    state.parsedItems[idx].name = catalogMatch.name;
                    state.parsedItems[idx].unit = catalogMatch.unit;
                    state.parsedItems[idx].unit_price = catalogMatch.price;
                    state.parsedItems[idx].confidence_score = 1.0; // User explicitly selected it
                    state.parsedItems[idx].is_confident = true;
                    renderReviewScreen();
                }
            });
        });
    }

    function updateItemDisplay(idx) {
        const item = state.parsedItems[idx];
        const qtyDisplay = document.getElementById(`qty-val-${idx}`);
        if (qtyDisplay) qtyDisplay.textContent = item.quantity;

        const row = document.getElementById(`item-row-${idx}`);
        if (row) {
            const lineTotalEl = row.querySelector('.item-line-total');
            if (lineTotalEl) {
                lineTotalEl.textContent = '₹' + (item.quantity * item.unit_price).toFixed(2);
            }
        }
        recalculateTotals();
    }

    function recalculateTotals() {
        state.orderTotal = state.parsedItems.reduce((acc, it) => acc + (it.quantity * it.unit_price), 0);
        reviewGrandTotal.textContent = '₹' + state.orderTotal.toFixed(2);
    }

    // Step 2 -> Step 3: Confirm Order and Generate UPI Link / QR
    btnConfirmFinalOrder.addEventListener('click', async () => {
        const phone = customerPhoneInput.value.replace(/\D/g, '').trim();
        if (phone.length < 10) {
            alert('Please enter your 10-digit mobile number so the shopkeeper can deliver.');
            customerPhoneInput.focus();
            return;
        }

        if (state.parsedItems.length === 0) {
            alert('No items in the order to confirm.');
            return;
        }

        // Save phone to localStorage for convenience
        localStorage.setItem('sollu_phone', phone);
        state.customerPhone = phone;

        btnConfirmFinalOrder.disabled = true;
        btnConfirmFinalOrder.innerHTML = `<span class="spinner-border spinner-border-sm me-2"></span>Confirming Order...`;

        try {
            const response = await fetch('api/create_order.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    shop_id: state.shopId,
                    phone: phone,
                    items: state.parsedItems,
                    transcript_raw: state.rawTranscript
                })
            });

            const data = await response.json();
            if (!data.success) {
                throw new Error(data.error || 'Failed to place order');
            }

            state.confirmedOrderId = data.order_id;
            state.upiLink = data.upi_link;
            state.orderTotal = data.total_amount;

            // Render Success & QR Code
            renderSuccessScreen();
            showSection('success');

        } catch (err) {
            console.error('Order creation error:', err);
            alert('Error creating order: ' + err.message);
        } finally {
            btnConfirmFinalOrder.disabled = false;
            btnConfirmFinalOrder.innerHTML = `<i class="bi bi-check-circle-fill me-2"></i>Confirm & Pay`;
        }
    });

    // Render QR Code and UPI details
    function renderSuccessScreen() {
        successOrderId.textContent = '#' + state.confirmedOrderId;
        successTotal.textContent = '₹' + Number(state.orderTotal).toFixed(2);

        // Render QR Code using qrcode.js CDN library
        qrContainer.innerHTML = '';
        if (window.QRCode && state.upiLink) {
            new QRCode(qrContainer, {
                text: state.upiLink,
                width: 210,
                height: 210,
                colorDark: "#1b5e20",
                colorLight: "#ffffff",
                correctLevel: QRCode.CorrectLevel.M
            });
        }

        // Deep link for mobile UPI intent apps (GPay, PhonePe, Paytm)
        btnUpiPay.href = state.upiLink;
    }

    // "Same as last time" Reorder Handler
    async function loadPreviousOrder() {
        const phone = (customerPhoneInput.value || state.customerPhone || '').replace(/\D/g, '').trim();
        if (phone.length < 10) {
            alert('Please enter your 10-digit mobile number to fetch your previous order.');
            if (customerPhoneInput) customerPhoneInput.focus();
            return;
        }

        setParseLoading(true);

        try {
            const res = await fetch(`api/get_last_order.php?phone=${phone}&shop_id=${state.shopId}`);
            const data = await res.json();

            if (!data.success || !data.has_order) {
                alert('No past orders found for mobile: ' + phone);
                return;
            }

            state.parsedItems = data.items || [];
            state.unmatchedItems = [];
            state.orderTotal = data.total || 0;
            state.rawTranscript = data.transcript_raw || 'Repeat previous order';

            // Fetch catalog options if not already cached
            if (state.catalogOptions.length === 0) {
                try {
                    const catRes = await fetch('api/manage_catalog.php?shop_id=' + state.shopId);
                    const catData = await catRes.json();
                    if (catData.success) state.catalogOptions = catData.catalog;
                } catch (e) { /* non-blocking */ }
            }

            renderReviewScreen();
            showSection('review');

        } catch (err) {
            console.error('Error fetching previous order:', err);
            alert('Failed to load past order: ' + err.message);
        } finally {
            setParseLoading(false);
        }
    }

    if (btnSameAsLast) {
        btnSameAsLast.addEventListener('click', loadPreviousOrder);
    }
    if (btnLoadPreviousOrder) {
        btnLoadPreviousOrder.addEventListener('click', loadPreviousOrder);
    }

    btnNewOrder.addEventListener('click', () => {
        transcriptInput.value = '';
        state.rawTranscript = '';
        speech.setFinalTranscript('');
        btnSubmitOrder.disabled = true;
        showSection('speech');
    });

    // Helper: Screen switching
    function showSection(name) {
        sectionSpeech.classList.add('d-none');
        sectionReview.classList.add('d-none');
        sectionSuccess.classList.add('d-none');

        if (name === 'speech') sectionSpeech.classList.remove('d-none');
        if (name === 'review') sectionReview.classList.remove('d-none');
        if (name === 'success') sectionSuccess.classList.remove('d-none');

        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    function setParseLoading(isLoading) {
        if (isLoading) {
            parseLoading.classList.remove('d-none');
            btnSubmitOrder.disabled = true;
        } else {
            parseLoading.classList.add('d-none');
            btnSubmitOrder.disabled = transcriptInput.value.trim().length === 0;
        }
    }
});
