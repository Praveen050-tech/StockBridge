<?php
/**
 * Sollu - Create Order API (/api/create_order.php)
 * Accepts: items (array), phone (string), shop_id (int), transcript_raw (string optional)
 * Inserts order and items, returns order ID and UPI deep link string.
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once __DIR__ . '/../config/db.php';

$rawInput = file_get_contents('php://input');
$data = json_decode($rawInput, true) ?: $_POST;

$phone         = preg_replace('/\D/', '', trim($data['phone'] ?? ''));
$shopId        = intval($data['shop_id'] ?? 1);
$transcriptRaw = trim($data['transcript_raw'] ?? '');
$items         = $data['items'] ?? [];

// Basic validation
if (strlen($phone) < 10) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'error'   => 'Please provide a valid 10-digit mobile number.'
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

if (empty($items) || !is_array($items)) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'error'   => 'No items in order to confirm.'
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

try {
    $pdo = getDBConnection();
    $pdo->beginTransaction();

    // 1. Fetch Shop details for UPI ID and shop name
    $shopStmt = $pdo->prepare("SELECT id, name, upi_id FROM shops WHERE id = :id");
    $shopStmt->execute([':id' => $shopId]);
    $shop = $shopStmt->fetch();

    if (!$shop) {
        // Fallback default shop if DB not yet initialized with seed
        $shop = [
            'id'     => 1,
            'name'   => 'Lakshmi Kirana & General Store',
            'upi_id' => 'lakshmistore@upi'
        ];
    }

    // 2. Find or create customer by phone (no accounts needed)
    $custStmt = $pdo->prepare("SELECT id FROM customers WHERE phone = :phone");
    $custStmt->execute([':phone' => $phone]);
    $customer = $custStmt->fetch();

    if ($customer) {
        $customerId = (int)$customer['id'];
    } else {
        $insertCust = $pdo->prepare("INSERT INTO customers (phone, name) VALUES (:phone, NULL)");
        $insertCust->execute([':phone' => $phone]);
        $customerId = (int)$pdo->lastInsertId();
    }

    // 3. Calculate accurate total amount from catalog/items
    $totalAmount = 0.00;
    $validItems = [];

    // Pre-fetch catalog prices for validation
    $catIds = array_filter(array_map(fn($it) => intval($it['catalog_id'] ?? 0), $items));
    $catalogPrices = [];
    if (!empty($catIds)) {
        $inQuery = implode(',', array_fill(0, count($catIds), '?'));
        $stmtCat = $pdo->prepare("SELECT id, price FROM catalog WHERE id IN ($inQuery)");
        $stmtCat->execute(array_values($catIds));
        while ($row = $stmtCat->fetch()) {
            $catalogPrices[(int)$row['id']] = (float)$row['price'];
        }
    }

    foreach ($items as $item) {
        $catId = intval($item['catalog_id'] ?? 0);
        $qty   = max(0.25, floatval($item['quantity'] ?? 1));
        // Use verified DB catalog price if available, else provided price
        $unitPrice = isset($catalogPrices[$catId]) ? $catalogPrices[$catId] : floatval($item['unit_price'] ?? 0.00);
        $confidence = floatval($item['confidence_score'] ?? 1.0);

        if ($catId > 0 && $unitPrice >= 0) {
            $lineTotal = round($qty * $unitPrice, 2);
            $totalAmount += $lineTotal;

            $validItems[] = [
                'catalog_id'       => $catId,
                'quantity'         => $qty,
                'unit_price'       => $unitPrice,
                'confidence_score' => $confidence
            ];
        }
    }

    if (empty($validItems)) {
        $pdo->rollBack();
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'No valid catalog items found in order.']);
        exit;
    }

    // 4. Insert into orders table
    $orderInsert = $pdo->prepare("
        INSERT INTO orders (shop_id, customer_id, status, total_amount, transcript_raw, created_at) 
        VALUES (:shop_id, :customer_id, 'pending', :total_amount, :transcript_raw, NOW())
    ");
    $orderInsert->execute([
        ':shop_id'        => $shopId,
        ':customer_id'    => $customerId,
        ':total_amount'   => $totalAmount,
        ':transcript_raw' => $transcriptRaw
    ]);
    $orderId = (int)$pdo->lastInsertId();

    // 5. Insert order_items
    $itemInsert = $pdo->prepare("
        INSERT INTO order_items (order_id, catalog_id, quantity, unit_price, confidence_score) 
        VALUES (:order_id, :catalog_id, :quantity, :unit_price, :confidence_score)
    ");

    foreach ($validItems as $vi) {
        $itemInsert->execute([
            ':order_id'         => $orderId,
            ':catalog_id'       => $vi['catalog_id'],
            ':quantity'         => $vi['quantity'],
            ':unit_price'       => $vi['unit_price'],
            ':confidence_score' => $vi['confidence_score']
        ]);
    }

    $pdo->commit();

    // 6. Generate UPI deep link string as specified:
    // upi://pay?pa={shop_upi_id}&pn={shop_name}&am={total}&cu=INR
    $encodedShopName = urlencode($shop['name']);
    $formattedTotal  = number_format($totalAmount, 2, '.', '');
    $upiLink = "upi://pay?pa={$shop['upi_id']}&pn={$encodedShopName}&am={$formattedTotal}&cu=INR";

    echo json_encode([
        'success'      => true,
        'order_id'     => $orderId,
        'shop_name'    => $shop['name'],
        'shop_upi'     => $shop['upi_id'],
        'total_amount' => (float)$formattedTotal,
        'upi_link'     => $upiLink,
        'customer_id'  => $customerId
    ], JSON_UNESCAPED_UNICODE);

} catch (Throwable $e) {
    if (isset($pdo) && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error'   => 'Could not place order: ' . $e->getMessage()
    ], JSON_UNESCAPED_UNICODE);
}
