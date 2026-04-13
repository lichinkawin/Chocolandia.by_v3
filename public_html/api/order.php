<?php
/**
 * Chocolandia.by — Order Handler (Telegram Bridge)
 *
 * Acts as a secure proxy between the frontend and Telegram Bot API.
 * The bot token is NEVER sent to the browser.
 *
 * Endpoint: POST /api/order.php
 */

// ─── CORS ──────────────────────────────────────────────────────────────────
$allowed_origins = ['https://chocolandia.by', 'http://localhost:8080'];
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if (in_array($origin, $allowed_origins, true)) {
    header('Access-Control-Allow-Origin: ' . $origin);
}
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Content-Type: application/json; charset=utf-8');

// ─── Pre-flight ──────────────────────────────────────────────────────────────
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

// ─── Method guard ────────────────────────────────────────────────────────────
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['ok' => false, 'error' => 'Method Not Allowed']);
    exit;
}

// ─── Config ──────────────────────────────────────────────────────────────────
// Load from ABOVE public_html so the token is never web-accessible
$config_path = dirname(__DIR__) . '/telegram_config.php';
if (!file_exists($config_path)) {
    // Fallback: try sibling path on shared hosting
    $config_path = __DIR__ . '/../../telegram_config.php';
}

if (!file_exists($config_path)) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => 'Server configuration missing']);
    exit;
}
require_once $config_path;

// ─── Parse body ──────────────────────────────────────────────────────────────
$raw = file_get_contents('php://input');
$body = json_decode($raw, true);

if (!is_array($body)) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'Invalid JSON body']);
    exit;
}

// ─── Sanitise helper ─────────────────────────────────────────────────────────
function clean(string $value, int $max = 500): string {
    $v = strip_tags(trim($value));
    return mb_substr($v, 0, $max);
}

// ─── Validate required fields ────────────────────────────────────────────────
$name    = clean($body['name']    ?? '', 100);
$phone   = clean($body['phone']   ?? '', 30);
$address = clean($body['address'] ?? '', 300);
$comment = clean($body['comment'] ?? '', 500);
$items   = $body['items']         ?? [];  // array of { name, weight, qty, lineTotal }
$total   = clean((string)($body['total'] ?? ''), 20);

if ($name === '' || $phone === '' || $address === '') {
    http_response_code(422);
    echo json_encode(['ok' => false, 'error' => 'Заполните обязательные поля (имя, телефон, адрес)']);
    exit;
}

if (!is_array($items) || count($items) === 0) {
    http_response_code(422);
    echo json_encode(['ok' => false, 'error' => 'Корзина пуста']);
    exit;
}

// ─── Build Telegram message ───────────────────────────────────────────────────
$lines = [];
foreach ($items as $item) {
    $iname  = clean((string)($item['name']      ?? ''), 200);
    $weight = clean((string)($item['weight']    ?? ''), 50);
    $qty    = (int)($item['qty']                ?? 1);
    $price  = clean((string)($item['lineTotal'] ?? ''), 20);
    $url    = filter_var($item['url'] ?? '', FILTER_VALIDATE_URL) ? $item['url'] : '';
    
    $suffix = $weight !== '' ? " ({$weight})" : '';
    $link   = $url !== '' ? " (<a href=\"{$url}\">ссылка</a>)" : '';
    $lines[] = "• <b>{$iname}</b>{$suffix}{$link} × {$qty} = {$price} BYN";
}

$items_html = implode("\n", $lines);

$message = "🛍 <b>НОВЫЙ ЗАКАЗ — Chocolandia.by</b>\n\n"
         . "👤 <b>Имя:</b> {$name}\n"
         . "📞 <b>Телефон:</b> {$phone}\n"
         . "📍 <b>Адрес:</b> {$address}\n"
         . ($comment !== '' ? "💬 <b>Комментарий:</b> {$comment}\n" : '')
         . "\n🍰 <b>СОСТАВ ЗАКАЗА:</b>\n{$items_html}\n"
         . "\n💰 <b>ИТОГО:</b> {$total} BYN";

// ─── Send to Telegram ─────────────────────────────────────────────────────────
$api_url = 'https://api.telegram.org/bot' . TELEGRAM_BOT_TOKEN . '/sendMessage';

$payload = json_encode([
    'chat_id'    => TELEGRAM_CHAT_ID,
    'text'       => $message,
    'parse_mode' => 'HTML',
]);

$ch = curl_init($api_url);
curl_setopt_array($ch, [
    CURLOPT_POST           => true,
    CURLOPT_POSTFIELDS     => $payload,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT        => 10,
    CURLOPT_HTTPHEADER     => ['Content-Type: application/json'],
    CURLOPT_SSL_VERIFYPEER => true,
]);

$response      = curl_exec($ch);
$curl_error    = curl_error($ch);
$http_code     = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

if ($curl_error) {
    http_response_code(502);
    echo json_encode(['ok' => false, 'error' => 'Network error: ' . $curl_error]);
    exit;
}

$tg_response = json_decode($response, true);

if ($http_code !== 200 || !($tg_response['ok'] ?? false)) {
    $tg_desc = $tg_response['description'] ?? 'Unknown Telegram error';
    http_response_code(502);
    echo json_encode(['ok' => false, 'error' => 'Telegram API error: ' . $tg_desc]);
    exit;
}

// ─── Success ─────────────────────────────────────────────────────────────────
http_response_code(200);
echo json_encode(['ok' => true, 'message' => 'Заказ успешно отправлен!']);
