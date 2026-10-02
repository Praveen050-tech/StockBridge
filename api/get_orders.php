<?php
/**
 * Sollu - Get Orders API for Shop Dashboard Polling (/api/get_orders.php)
 * Returns recent orders newest first with customer phone, items, and status.
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');

session_start();
require_once __DIR__ . '/../config/db.php';

$shopId = intval($_SESSION['shop_id'] ?? $_GET['shop_id'] ?? 1);

try {
    $pdo = getDBConnection();

    // 1. Fetch Orders for this shop (newest first)
    $stmt = $pdo->prepare("
        SELECT o.id, o.shop_id, o.customer_id, o.status, o.total_amount, 
               o.transcript_raw, o.created_at,
               c.phone AS customer_phone, c.name AS customer_name
        FROM orders o
        JOIN customers c ON o.customer_id = c.id
        WHERE o.shop_id = :shop_id
        ORDER BY o.id DESC
        LIMIT 60
    ");
    $stmt->execute([':shop_id' => $shopId]);
    $orders = $stmt->fetchAll();

    if (empty($orders)) {
        echo json_encode([
            'success'       => true,
            'orders'        => [],
            'pending_count' => 0
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }

    $orderIds = array_map(fn($o) => (int)$o['id'], $orders);
    $inClause = implode(',', array_fill(0, count($orderIds), '?'));

    // 2. Fetch all items for these orders in one single efficient query
    $itemStmt = $pdo->prepare("
        SELECT oi.id, oi.order_id, oi.catalog_id, oi.quantity, oi.unit_price, oi.confidence_score,
               c.name AS item_name, c.unit
        FROM order_items oi
        JOIN catalog c ON oi.catalog_id = c.id
        WHERE oi.order_id IN ($inClause)
        ORDER BY oi.id ASC
    ");
    $itemStmt->execute($orderIds);
    $allItems = $itemStmt->fetchAll();

    // Group items by order_id
    $itemsByOrder = [];
    foreach ($allItems as $item) {
        $ordId = (int)$item['order_id'];
        if (!isset($itemsByOrder[$ordId])) {
            $itemsByOrder[$ordId] = [];
        }
        $qty = (float)$item['quantity'];
        $unitPrice = (float)$item['unit_price'];
        $itemsByOrder[$ordId][] = [
            'id'               => (int)$item['id'],
            'catalog_id'       => (int)$item['catalog_id'],
            'name'             => $item['item_name'],
            'unit'             => $item['unit'],
            'quantity'         => $qty,
            'unit_price'       => $unitPrice,
            'line_total'       => round($qty * $unitPrice, 2),
            'confidence_score' => (float)$item['confidence_score']
        ];
    }

    $pendingCount = 0;
    $formattedOrders = [];

    foreach ($orders as $ord) {
        $ordId = (int)$ord['id'];
        $status = $ord['status'];
        if ($status === 'pending') {
            $pendingCount++;
        }

        $formattedOrders[] = [
            'id'             => $ordId,
            'status'         => $status,
            'customer_phone' => $ord['customer_phone'],
            'customer_name'  => $ord['customer_name'],
            'total_amount'   => (float)$ord['total_amount'],
            'transcript_raw' => $ord['transcript_raw'],
            'created_at'     => $ord['created_at'],
            'items'          => $itemsByOrder[$ordId] ?? []
        ];
    }

    echo json_encode([
        'success'       => true,
        'orders'        => $formattedOrders,
        'pending_count' => $pendingCount
    ], JSON_UNESCAPED_UNICODE);

} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error'   => 'Failed to fetch orders: ' . $e->getMessage()
    ], JSON_UNESCAPED_UNICODE);
}
