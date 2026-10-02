<?php
/**
 * Sollu - Catalog Management API (/api/manage_catalog.php)
 * Handles CRUD operations for shop catalog:
 * - GET: list items
 * - POST action=create: add item
 * - POST action=update: edit item
 * - POST action=delete: remove item
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

session_start();
require_once __DIR__ . '/../config/db.php';

$shopId = intval($_SESSION['shop_id'] ?? $_REQUEST['shop_id'] ?? 1);

try {
    $pdo = getDBConnection();

    // GET Request: list catalog items
    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        $stmt = $pdo->prepare("SELECT id, shop_id, name, aliases, unit, price, is_active FROM catalog WHERE shop_id = :shop_id ORDER BY id DESC");
        $stmt->execute([':shop_id' => $shopId]);
        $items = $stmt->fetchAll();

        echo json_encode([
            'success' => true,
            'catalog' => $items
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }

    // POST Request: Create / Update / Delete
    $rawInput = file_get_contents('php://input');
    $data = json_decode($rawInput, true) ?: $_POST;
    $action = trim($data['action'] ?? 'create');

    if ($action === 'create') {
        $name    = trim($data['name'] ?? '');
        $aliases = trim($data['aliases'] ?? '');
        $unit    = trim($data['unit'] ?? 'kg');
        $price   = floatval($data['price'] ?? 0);

        if (empty($name)) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Item name is required']);
            exit;
        }

        $stmt = $pdo->prepare("INSERT INTO catalog (shop_id, name, aliases, unit, price, is_active) VALUES (:shop_id, :name, :aliases, :unit, :price, 1)");
        $stmt->execute([
            ':shop_id' => $shopId,
            ':name'    => $name,
            ':aliases' => $aliases,
            ':unit'    => $unit,
            ':price'   => $price
        ]);

        echo json_encode([
            'success' => true,
            'id'      => (int)$pdo->lastInsertId(),
            'message' => 'Item added to catalog'
        ], JSON_UNESCAPED_UNICODE);
        exit;

    } elseif ($action === 'update') {
        $id      = intval($data['id'] ?? 0);
        $name    = trim($data['name'] ?? '');
        $aliases = trim($data['aliases'] ?? '');
        $unit    = trim($data['unit'] ?? 'kg');
        $price   = floatval($data['price'] ?? 0);
        $isActive = isset($data['is_active']) ? intval($data['is_active']) : 1;

        if ($id <= 0 || empty($name)) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Valid ID and Item name are required']);
            exit;
        }

        $stmt = $pdo->prepare("UPDATE catalog SET name = :name, aliases = :aliases, unit = :unit, price = :price, is_active = :is_active WHERE id = :id AND shop_id = :shop_id");
        $stmt->execute([
            ':name'      => $name,
            ':aliases'   => $aliases,
            ':unit'      => $unit,
            ':price'     => $price,
            ':is_active' => $isActive,
            ':id'        => $id,
            ':shop_id'   => $shopId
        ]);

        echo json_encode(['success' => true, 'message' => 'Item updated successfully']);
        exit;

    } elseif ($action === 'delete') {
        $id = intval($data['id'] ?? 0);

        if ($id <= 0) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Valid ID is required']);
            exit;
        }

        // Check if item is used in orders
        $checkStmt = $pdo->prepare("SELECT COUNT(*) as cnt FROM order_items WHERE catalog_id = :id");
        $checkStmt->execute([':id' => $id]);
        $usedCount = (int)$checkStmt->fetch()['cnt'];

        if ($usedCount > 0) {
            // Soft delete to avoid breaking foreign key constraints on historical orders
            $stmt = $pdo->prepare("UPDATE catalog SET is_active = 0 WHERE id = :id AND shop_id = :shop_id");
            $stmt->execute([':id' => $id, ':shop_id' => $shopId]);
            echo json_encode(['success' => true, 'message' => 'Item deactivated from catalog (preserved in order history)']);
        } else {
            // Hard delete
            $stmt = $pdo->prepare("DELETE FROM catalog WHERE id = :id AND shop_id = :shop_id");
            $stmt->execute([':id' => $id, ':shop_id' => $shopId]);
            echo json_encode(['success' => true, 'message' => 'Item deleted from catalog']);
        }
        exit;
    }

    echo json_encode(['success' => false, 'error' => 'Unknown action']);

} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error'   => 'Catalog action failed: ' . $e->getMessage()
    ], JSON_UNESCAPED_UNICODE);
}
