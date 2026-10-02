<?php
/**
 * Sollu (Voice-to-Shop) - Customer Ordering Page
 * Main customer interface supporting Tamil, Hindi, and English voice input.
 */
?>
<!DOCTYPE html>
<html lang="ta">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>வாய்மொழி (Vaaimozhi) - Voice-to-Shop Kirana</title>
    <!-- Bootstrap 5 CSS -->
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
    <!-- Bootstrap Icons -->
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css">
    <!-- Custom Warm Grocery Styles -->
    <link rel="stylesheet" href="assets/css/style.css">
</head>
<body>

    <!-- Header Navbar -->
    <nav class="navbar sollu-navbar sticky-top">
        <div class="container d-flex justify-content-between align-items-center">
            <a class="navbar-brand sollu-brand" href="customer.php">
                <i class="bi bi-mic-fill"></i>
                <span>வாய்மொழி <small class="fw-normal fs-6">Vaaimozhi</small></span>
                <span class="sollu-badge">Voice-to-Shop</span>
            </a>
            <a href="shop_login.php" class="btn btn-sm btn-outline-light rounded-pill px-3">
                <i class="bi bi-shop me-1"></i> கடை (Shop)
            </a>
        </div>
    </nav>

    <div class="container py-3" style="max-width: 640px;">

        <!-- 3-Icon "How it works" Strip -->
        <div class="how-it-works-strip">
            <div class="row g-1 align-items-center text-center">
                <div class="col-4 step-card">
                    <div class="step-icon-bubble">
                        <i class="bi bi-mic"></i>
                    </div>
                    <div class="step-title">1. பேசுங்கள்<br><span class="text-muted small">Speak</span></div>
                </div>
                <div class="col-4 step-card">
                    <div class="step-icon-bubble">
                        <i class="bi bi-card-checklist"></i>
                    </div>
                    <div class="step-title">2. சரிபாருங்கள்<br><span class="text-muted small">Review</span></div>
                </div>
                <div class="col-4 step-card">
                    <div class="step-icon-bubble">
                        <i class="bi bi-box-seam"></i>
                    </div>
                    <div class="step-title">3. பெறுங்கள்<br><span class="text-muted small">Delivered</span></div>
                </div>
            </div>
        </div>

        <!-- ========================================== -->
        <!-- SCREEN 1: Speech-to-Text Input (Main View) -->
        <!-- ========================================== -->
        <div id="sectionSpeech">
            <!-- Language Selector Card -->
            <div class="card border-0 shadow-sm rounded-4 mb-3 p-3 bg-white">
                <div class="d-flex align-items-center justify-content-between">
                    <label for="langSelect" class="form-label fw-bold mb-0 text-dark">
                        <i class="bi bi-translate text-warning-emphasis me-1"></i> மொழி / Language:
                    </label>
                    <select id="langSelect" class="form-select form-select-lg fw-bold border-2 border-warning" style="max-width: 220px;">
                        <option value="ta-IN" selected>தமிழ் (Tamil)</option>
                        <option value="hi-IN">हिन्दी (Hindi)</option>
                        <option value="en-IN">English (India)</option>
                    </select>
                </div>
            </div>

            <!-- Large Thumb-Friendly Mic Section -->
            <div class="mic-section mb-3">
                <div class="text-muted small text-uppercase fw-bold letter-spacing-1">Voice Order Recording</div>
                
                <div class="mic-button-wrapper">
                    <button type="button" id="micButton" class="btn-mic" aria-label="Start Voice Recording">
                        <i id="micIcon" class="bi bi-mic-fill"></i>
                    </button>
                </div>

                <div id="micStatus" class="mic-status-label">மைக் தட்டவும் (Tap mic to speak)</div>
                
                <!-- Trust Note -->
                <div class="trust-note">
                    <i class="bi bi-shield-lock-fill text-success"></i>
                    <span>Your voice note is only used to create this order</span>
                </div>
            </div>

            <!-- Live Editable Transcript Box -->
            <div class="transcript-card mb-3">
                <div class="d-flex justify-content-between align-items-center mb-2">
                    <label for="transcriptInput" class="form-label fw-bold mb-0 text-dark">
                        <i class="bi bi-pencil-square me-1 text-primary"></i> நீங்கள் கூறியது (Your Order Text):
                    </label>
                    <button type="button" id="clearTranscriptBtn" class="btn btn-sm btn-link text-danger text-decoration-none">
                        <i class="bi bi-x-circle"></i> Clear
                    </button>
                </div>
                
                <textarea id="transcriptInput" class="form-control transcript-textarea" rows="4" 
                    placeholder="உதாரணம்: 2 கிலோ பொன்னி அரிசி, ஒரு பாக்கெட் ஆவின் பால், அரை கிலோ சர்க்கரை..."></textarea>
                
                <div class="form-text text-muted mt-1 small">
                    <i class="bi bi-info-circle me-1"></i> உச்சரிப்பு தவறாக இருந்தால் எழுத்துக்களை இங்கேயே மாற்றலாம் (Edit text if words are misheard).
                </div>
            </div>

            <!-- Action Buttons -->
            <div class="d-grid gap-2 mb-3">
                <button type="button" id="btnSubmitOrder" class="btn btn-action-primary" disabled>
                    <span id="btnSubmitText">
                        <i class="bi bi-arrow-right-circle-fill me-2"></i> Submit Order (பொருட்களை சரிபார்க்கவும்)
                    </span>
                </button>

                <!-- 1-Click Reorder Button -->
                <button type="button" id="btnLoadPreviousOrder" class="btn btn-same-as-last mt-1">
                    <i class="bi bi-arrow-repeat me-1"></i> Same as last time (முந்தைய ஆர்டர்)
                </button>
            </div>

            <!-- Loading Spinner -->
            <div id="parseLoading" class="text-center py-4 d-none">
                <div class="spinner-border text-warning" role="status" style="width: 3rem; height: 3rem;"></div>
                <div class="mt-2 fw-bold text-dark fs-5">பொருட்களை பொருத்துகிறோம்... (Matching items with shop catalog)</div>
            </div>
        </div>


        <!-- ========================================== -->
        <!-- SCREEN 2: Order Review & Editing Screen    -->
        <!-- ========================================== -->
        <div id="sectionReview" class="d-none">
            <div class="d-flex align-items-center justify-content-between mb-3">
                <h4 class="fw-bold mb-0 text-dark">
                    <i class="bi bi-card-checklist text-success me-2"></i> உங்கள் பட்டியல் (Review Order)
                </h4>
                <button type="button" id="btnBackToSpeech" class="btn btn-outline-secondary btn-sm rounded-pill px-3">
                    <i class="bi bi-arrow-left"></i> Re-speak
                </button>
            </div>

            <!-- Unmatched Spoken Words Alert -->
            <div id="unmatchedAlert" class="alert alert-warning border-warning d-none mb-3">
                <div class="fw-bold mb-1"><i class="bi bi-exclamation-triangle-fill me-1"></i> சில வார்த்தைகள் கடையில் கிடைக்கவில்லை (Unmatched Items):</div>
                <span id="unmatchedTextList" class="badge bg-light text-dark border p-2 text-wrap"></span>
            </div>

            <!-- List of recognized items -->
            <div id="reviewItemsList" class="mb-3">
                <!-- Dynamically rendered by customer.js -->
            </div>

            <!-- Total Card -->
            <div class="card border-0 shadow-sm rounded-4 p-3 bg-white mb-3">
                <div class="d-flex justify-content-between align-items-center">
                    <div>
                        <span class="fs-5 text-muted">மொத்த தொகை (Total Amount):</span>
                        <div class="small text-muted">Prices subject to shop confirmation</div>
                    </div>
                    <div id="reviewGrandTotal" class="fs-2 fw-bolder text-success">₹0.00</div>
                </div>
            </div>

            <!-- Customer Mobile Input (No account needed) -->
            <div class="card border-0 shadow-sm rounded-4 p-3 bg-white mb-3">
                <label for="customerPhoneInput" class="form-label fw-bold text-dark">
                    <i class="bi bi-telephone-fill text-success me-1"></i> உங்கள் மொபைல் எண் (Mobile Number for Delivery):
                </label>
                <div class="input-group input-group-lg">
                    <span class="input-group-text bg-light fw-bold">+91</span>
                    <input type="tel" id="customerPhoneInput" class="form-control fw-bold" placeholder="9876543210" maxlength="10">
                </div>
                <div class="form-text small text-muted">கடையில் இருந்து உறுதிப்படுத்த இந்த எண் தேவை (Used by the shopkeeper to deliver).</div>
            </div>

            <!-- Confirm Order Button -->
            <div class="d-grid gap-2">
                <button type="button" id="btnConfirmFinalOrder" class="btn btn-action-primary">
                    <i class="bi bi-check-circle-fill me-2"></i> Confirm & Pay (ஆர்டரை உறுதிசெய்)
                </button>
            </div>
        </div>


        <!-- ========================================== -->
        <!-- SCREEN 3: Order Confirmed & UPI QR Code   -->
        <!-- ========================================== -->
        <div id="sectionSuccess" class="d-none">
            <div class="upi-qr-card text-center mb-3">
                <div class="text-success mb-2">
                    <i class="bi bi-check-circle-fill" style="font-size: 3.5rem;"></i>
                </div>
                <h3 class="fw-bold text-dark mb-1">ஆர்டர் பதிவு செய்யப்பட்டது!</h3>
                <p class="text-muted">Order Placed Successfully</p>

                <div class="badge bg-success-subtle text-success fs-6 px-3 py-2 rounded-pill mb-3">
                    Order ID: <span id="successOrderId" class="fw-bold">#101</span>
                </div>

                <div class="fs-4 text-muted mb-1">செலுத்த வேண்டிய தொகை (Payable Amount):</div>
                <div id="successTotal" class="display-6 fw-bold text-success mb-3">₹0.00</div>

                <!-- UPI QR Code Container -->
                <div class="qr-container mb-3">
                    <div id="qrContainer"></div>
                </div>

                <p class="small text-muted mb-3">
                    <i class="bi bi-qr-code-scan me-1"></i> Scan with any UPI app (GPay / PhonePe / Paytm)
                </p>

                <!-- UPI Deep Link Button for mobile apps -->
                <div class="d-grid gap-2 mb-3">
                    <a id="btnUpiPay" href="#" class="btn btn-success btn-lg fw-bold rounded-pill py-3">
                        <i class="bi bi-wallet2 me-2"></i> Pay with UPI App (GPay / PhonePe)
                    </a>
                </div>

                <div class="alert alert-light border small text-muted text-start mb-0">
                    <i class="bi bi-info-circle-fill text-primary me-1"></i>
                    கடைக்காரர் ஆர்டரை சரிபார்த்து உறுதி செய்ததும் பொருட்கள் அனுப்பி வைக்கப்படும்.
                </div>
            </div>

            <!-- Follow-up Actions -->
            <div class="d-grid gap-2">
                <button type="button" id="btnSameAsLast" class="btn btn-same-as-last">
                    <i class="bi bi-arrow-repeat me-1"></i> Same as last time (மீண்டும் இதே பொருட்களை வாங்க)
                </button>
                <button type="button" id="btnNewOrder" class="btn btn-outline-secondary rounded-pill py-2">
                    <i class="bi bi-plus-circle me-1"></i> புதிய ஆர்டர் (Place Another Order)
                </button>
            </div>
        </div>

    </div>

    <!-- QR Code Generator Library via CDN -->
    <script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"></script>
    <!-- Bootstrap JS Bundle -->
    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js"></script>
    <!-- Sollu Custom JavaScript Modules -->
    <script src="assets/js/speech.js"></script>
    <script src="assets/js/customer.js"></script>
</body>
</html>
