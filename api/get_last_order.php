<?php
/**
 * Sollu - Get Last Order API (/api/get_last_order.php)
 * Fetches the customer's most recent order to support the "Same as last time" 1-click reorder feature.
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');

require_once __DIR__ . '/../config/db.php';

$phone  = preg_replace('/\D/', '', trim($_GET['phone'] ?? ''));
$shopId = intval($_GET['shop_id'] ?? 1);

if (strlen($phone) < 10) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'error'   => 'Please provide a valid 10-digit phone number'
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

try {
    $pdo = getDBConnection();

    // 1. Find customer
    $stmtCust = $pdo->prepare("SELECT id FROM customers WHERE phone = :phone");
    $stmtCust->execute([':phone' => $phone]);
    $customer = $stmtCust->fetch();

    if (!$customer) {
        echo json_encode([
            'success'   => false,
            'has_order' => false,
            'message'   => 'No previous orders found for this phone number.'
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }

    // 2. Find most recent order for this customer and shop
    $stmtOrder = $pdo->prepare("
        SELECT id, total_amount, status, created_at, transcript_raw 
        FROM orders 
        WHERE customer_id = :cust_id AND shop_id = :shop_id 
        ORDER BY id DESC 
        LIMIT 1
    ");
    $stmtOrder->execute([
        ':cust_id' => $customer['id'],
        ':shop_id' => $shopId
    ]);
    $order = $stmtOrder->fetch();

    if (!$order) {
        echo json_encode([
            'success'   => false,
            'has_order' => false,
            'message'   => 'No previous orders found for this phone number.'
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }

    // 3. Fetch items in that order
    $stmtItems = $pdo->prepare("
        SELECT oi.id, oi.catalog_id, oi.quantity, oi.unit_price, oi.confidence_score,
               c.name, c.unit, c.price as current_catalog_price, c.is_active
        FROM order_items oi
        JOIN catalog c ON oi.catalog_id = c.id
        WHERE oi.order_id = :order_id
    ");
    $stmtItems->execute([':order_id' => $order['id']]);
    $rawItems = $stmtItems->fetchAll();

    $items = [];
    $total = 0.00;

    foreach ($rawItems as $item) {
        $qty = (float)$item['quantity'];
        // Use active catalog price if available
        $price = (float)$item['current_catalog_price'];
        $lineTotal = round($qty * $price, 2);
        $total += $lineTotal;

        $items[] = [
            'catalog_id'       => (int)$item['catalog_id'],
            'name'             => $item['name'],
            'unit'             => $item['unit'],
            'quantity'         => $qty,
            'unit_price'       => $price,
            'line_total'       => $lineTotal,
            'confidence_score' => 1.0, // Previous order items are 100% verified
            'is_confident'     => true
        ];
    }

    echo json_encode([
        'success'        => true,
        'has_order'      => true,
        'order_id'       => (int)$order['id'],
        'order_date'     => $order['created_at'],
        'transcript_raw' => $order['transcript_raw'],
        'items'          => $items,
        'total'          => round($total, 2)
    ], JSON_UNESCAPED_UNICODE);

} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error'   => 'Error retrieving last order: ' . $e->getMessage()
    ], JSON_UNESCAPED_UNICODE);
}
