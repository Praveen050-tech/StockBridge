/**
 * Notification Service for StockBridge
 * Dispatches simulated & webhook-ready alerts for WhatsApp and Email.
 */

async function sendLowStockAlert({ recipientPhone, recipientEmail, shopName, productName, currentStock, unit, threshold }) {
  const timestamp = new Date().toLocaleTimeString();
  const alertMsg = `⚠️ [StockBridge Low Stock Alert] ${shopName}: Product "${productName}" is critically low! Current: ${currentStock} ${unit} (Reorder threshold: ${threshold} ${unit}).`;

  console.log(`\n======================================================`);
  console.log(`📱 [WHATSAPP DISPATCH] To: ${recipientPhone || 'N/A'}`);
  console.log(`✉️ [EMAIL DISPATCH]    To: ${recipientEmail || 'N/A'}`);
  console.log(`🕒 Time: ${timestamp}`);
  console.log(`💬 Message: ${alertMsg}`);
  console.log(`======================================================\n`);

  return {
    success: true,
    channel: 'whatsapp_and_email',
    message: alertMsg,
    timestamp
  };
}

async function sendOrderConfirmation({ recipientPhone, recipientEmail, orderId, status, itemsCount, totalAmount }) {
  const timestamp = new Date().toLocaleTimeString();
  const orderMsg = `📦 [StockBridge Order #${orderId}] Status updated to: ${status.toUpperCase()}. Total: ₹${totalAmount} (${itemsCount} items).`;

  console.log(`\n======================================================`);
  console.log(`📱 [WHATSAPP DISPATCH] To: ${recipientPhone || 'N/A'}`);
  console.log(`✉️ [EMAIL DISPATCH]    To: ${recipientEmail || 'N/A'}`);
  console.log(`🕒 Time: ${timestamp}`);
  console.log(`💬 Message: ${orderMsg}`);
  console.log(`======================================================\n`);

  return {
    success: true,
    channel: 'whatsapp_and_email',
    message: orderMsg,
    timestamp
  };
}

module.exports = {
  sendLowStockAlert,
  sendOrderConfirmation
};
