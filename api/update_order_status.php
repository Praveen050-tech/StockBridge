<?php
/**
 * Sollu - Update Order Status & Items API (/api/update_order_status.php)
 * Accepts order_id, new status, and (if edited) an updated items array.
 * Updates the DB and recalculates the total if items changed.
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

$orderId = intval($data['order_id'] ?? 0);
$status  = trim($data['status'] ?? '');
$items   = $data['items'] ?? null; // optional updated items array

$allowedStatuses = ['pending', 'accepted', 'rejected', 'completed'];

if ($orderId <= 0) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Invalid order ID']);
    exit;
}

if (!empty($status) && !in_array($status, $allowedStatuses)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Invalid status provided']);
    exit;
}

try {
    $pdo = getDBConnection();
    $pdo->beginTransaction();

    // Check if order exists
    $checkStmt = $pdo->prepare("SELECT id, shop_id, total_amount, status FROM orders WHERE id = :id");
    $checkStmt->execute([':id' => $orderId]);
    $currentOrder = $checkStmt->fetch();

    if (!$currentOrder) {
        $pdo->rollBack();
        http_response_code(404);
        echo json_encode(['success' => false, 'error' => 'Order not found']);
        exit;
    }

    $newTotal = (float)$currentOrder['total_amount'];

    // 1. If shopkeeper or customer adjusted items, update order_items and recalculate total
    if (is_array($items)) {
        // Remove existing items and re-insert edited list
        $delStmt = $pdo->prepare("DELETE FROM order_items WHERE order_id = :order_id");
        $delStmt->execute([':order_id' => $orderId]);

        $newTotal = 0.00;
        $insertItemStmt = $pdo->prepare("
            INSERT INTO order_items (order_id, catalog_id, quantity, unit_price, confidence_score) 
            VALUES (:order_id, :catalog_id, :quantity, :unit_price, 1.00)
        ");

        foreach ($items as $item) {
            $catId = intval($item['catalog_id'] ?? 0);
            $qty   = floatval($item['quantity'] ?? 0);
            $price = floatval($item['unit_price'] ?? 0);

            if ($catId > 0 && $qty > 0) {
                $lineTotal = round($qty * $price, 2);
                $newTotal += $lineTotal;

                $insertItemStmt->execute([
                    ':order_id'   => $orderId,
                    ':catalog_id' => $catId,
                    ':quantity'   => $qty,
                    ':unit_price' => $price
                ]);
            }
        }
    }

    // 2. Update status and total
    $finalStatus = !empty($status) ? $status : $currentOrder['status'];

    $updateOrder = $pdo->prepare("
        UPDATE orders 
        SET status = :status, total_amount = :total 
        WHERE id = :id
    ");
    $updateOrder->execute([
        ':status' => $finalStatus,
        ':total'  => $newTotal,
        ':id'     => $orderId
    ]);

    $pdo->commit();

    echo json_encode([
        'success'      => true,
        'order_id'     => $orderId,
        'status'       => $finalStatus,
        'total_amount' => round($newTotal, 2)
    ], JSON_UNESCAPED_UNICODE);

} catch (Throwable $e) {
    if (isset($pdo) && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error'   => 'Failed to update order: ' . $e->getMessage()
    ], JSON_UNESCAPED_UNICODE);
}
