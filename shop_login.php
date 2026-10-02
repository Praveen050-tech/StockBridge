<?php
/**
 * Sollu - Shopkeeper Login (shop_login.php)
 * Authenticates shopkeepers using phone number + 4-digit PIN.
 */

session_start();
require_once __DIR__ . '/config/db.php';

$error = '';
$phone = '';

// Handle Logout
if (isset($_GET['action']) && $_GET['action'] === 'logout') {
    $_SESSION = [];
    if (ini_get("session.use_cookies")) {
        $params = session_get_cookie_params();
        setcookie(session_name(), '', time() - 42000,
            $params["path"], $params["domain"],
            $params["secure"], $params["httponly"]
        );
    }
    session_destroy();
    header("Location: shop_login.php");
    exit;
}

// Redirect if already logged in
if (!empty($_SESSION['shop_id'])) {
    header("Location: shop_dashboard.php");
    exit;
}

// Process Login Form Submission
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $phone = preg_replace('/\D/', '', trim($_POST['phone'] ?? ''));
    $pin   = trim($_POST['pin'] ?? '');

    if (empty($phone) || empty($pin)) {
        $error = 'கடை மொபைல் எண் மற்றும் PIN உள்ளிடவும் (Please enter phone & PIN).';
    } else {
        try {
            $pdo = getDBConnection();
            $stmt = $pdo->prepare("SELECT id, name, pin, upi_id FROM shops WHERE phone = :phone LIMIT 1");
            $stmt->execute([':phone' => $phone]);
            $shop = $stmt->fetch();

            if ($shop && (string)$shop['pin'] === (string)$pin) {
                // Set session
                $_SESSION['shop_id']   = (int)$shop['id'];
                $_SESSION['shop_name'] = $shop['name'];
                $_SESSION['shop_upi']  = $shop['upi_id'];
                header("Location: shop_dashboard.php");
                exit;
            } else {
                $error = 'தவறான மொபைல் எண் அல்லது PIN (Invalid phone number or PIN).';
            }
        } catch (Throwable $e) {
            $error = 'Database error: ' . $e->getMessage();
        }
    }
}
?>
<!DOCTYPE html>
<html lang="ta">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>கடை உள்நுழைவு (Shop Login) - Vaaimozhi</title>
    <!-- Bootstrap 5 CSS -->
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
    <!-- Bootstrap Icons -->
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css">
    <!-- Custom Warm Grocery Styles -->
    <link rel="stylesheet" href="assets/css/style.css">
</head>
<body class="d-flex flex-column min-vh-100 justify-content-center py-4">

    <div class="container" style="max-width: 440px;">
        <div class="text-center mb-4">
            <a href="customer.php" class="text-decoration-none">
                <div class="d-inline-flex align-items-center justify-content-center bg-warning text-white rounded-circle shadow p-3 mb-2" style="width: 70px; height: 70px;">
                    <i class="bi bi-shop fs-1"></i>
                </div>
                <h2 class="fw-bold text-dark mb-0">வாய்மொழி <small class="text-muted fs-4">Vaaimozhi</small></h2>
                <div class="badge bg-warning text-dark px-3 py-1 rounded-pill mt-1">கடைக்காரர் போர்ட்டல் (Shopkeeper Portal)</div>
            </a>
        </div>

        <div class="card border-0 shadow-lg rounded-4 p-4 bg-white">
            <h4 class="fw-bold text-dark text-center mb-3">கடை உள்நுழைவு (Sign In)</h4>

            <?php if (!empty($error)): ?>
                <div class="alert alert-danger d-flex align-items-center rounded-3 py-2 small" role="alert">
                    <i class="bi bi-exclamation-triangle-fill me-2 fs-5"></i>
                    <div><?= htmlspecialchars($error) ?></div>
                </div>
            <?php endif; ?>

            <form method="POST" action="shop_login.php">
                <div class="mb-3">
                    <label for="phone" class="form-label fw-bold text-dark">
                        <i class="bi bi-telephone-fill text-warning me-1"></i> கடை மொபைல் எண் (Shop Phone)
                    </label>
                    <div class="input-group input-group-lg">
                        <span class="input-group-text bg-light">+91</span>
                        <input type="tel" class="form-control fw-bold" id="phone" name="phone" 
                            placeholder="9876543210" value="<?= htmlspecialchars($phone ?: '9876543210') ?>" required autofocus>
                    </div>
                </div>

                <div class="mb-4">
                    <label for="pin" class="form-label fw-bold text-dark">
                        <i class="bi bi-lock-fill text-warning me-1"></i> 4-இலக்க PIN (4-Digit PIN)
                    </label>
                    <input type="password" class="form-control form-control-lg text-center fw-bolder letter-spacing-2" 
                        id="pin" name="pin" maxlength="4" placeholder="••••" value="1234" required>
                </div>

                <div class="d-grid mb-3">
                    <button type="submit" class="btn btn-action-primary py-3">
                        <i class="bi bi-box-arrow-in-right me-1"></i> உள்நுழை (Login to Dashboard)
                    </button>
                </div>
            </form>

            <!-- Demo Helper Box -->
            <div class="p-3 bg-light rounded-3 border text-muted small">
                <strong class="text-dark"><i class="bi bi-key-fill text-warning me-1"></i> Demo Credentials:</strong><br>
                <span>Phone: <code>9876543210</code></span><br>
                <span>PIN: <code>1234</code></span>
            </div>
        </div>

        <div class="text-center mt-3">
            <a href="customer.php" class="text-muted text-decoration-none small">
                <i class="bi bi-arrow-left"></i> வாடிக்கையாளர் பக்கத்திற்கு செல் (Back to Customer Page)
            </a>
        </div>
    </div>

    <!-- Bootstrap JS Bundle -->
    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js"></script>
</body>
</html>
