<?php
/**
 * Chocolandia.by — Secure Order Handler
 * Role: Senior Full-stack Developer / DevOps Engineer Implementation
 */

// 1. Origin Check (Security Hardening)
$allowed_origins = ['https://chocolandia.by', 'http://localhost:8080'];
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if (in_array($origin, $allowed_origins, true)) {
    header('Access-Control-Allow-Origin: ' . $origin);
} else {
    // If no origin (direct request), allow only if strictly necessary, but better to restrict
    // header('Access-Control-Allow-Origin: https://chocolandia.by');
}

header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

// 2. Load Environment Variables from .env (Security)
function loadEnv($path) {
    if (!file_exists($path)) return [];
    $lines = file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    $env = [];
    foreach ($lines as $line) {
        if (strpos(trim($line), '#') === 0) continue;
        list($name, $value) = explode('=', $line, 2);
        $env[trim($name)] = trim($value);
    }
    return $env;
}

$env = loadEnv(dirname(__DIR__) . '/.env');
$bot_token = isset($env['TELEGRAM_BOT_TOKEN']) ? (string)$env['TELEGRAM_BOT_TOKEN'] : '';
$chat_id   = isset($env['CHAT_ID']) ? (string)$env['CHAT_ID'] : '';

// Ensure CHAT_ID preserves its string representation (important for large IDs and negative group IDs)
if ($bot_token === '' || $chat_id === '') {
    http_response_code(500);
    echo json_encode(['status' => 'error', 'message' => 'Server configuration error: Missing Token or Chat ID']);
    exit;
}

// 3. Parse and Sanitize Input
$raw = file_get_contents('php://input');
$body = json_decode($raw, true);

if (!$body) {
    http_response_code(400);
    echo json_encode(['status' => 'error', 'message' => 'Invalid request']);
    exit;
}

function sanitize($data) {
    if (is_array($data)) {
        return array_map('sanitize', $data);
    }
    return htmlspecialchars(strip_tags(trim($data)), ENT_QUOTES, 'UTF-8');
}

$name    = sanitize($body['name']    ?? 'N/A');
$phone   = sanitize($body['phone']   ?? 'N/A');
$address = sanitize($body['address'] ?? 'N/A');
$comment = sanitize($body['comment'] ?? '');
$items   = $body['items']            ?? [];
$total   = sanitize($body['total']   ?? '0');

// 4. Build Formatted HTML Message
$items_html = "";
foreach ($items as $item) {
    $iname  = sanitize($item['name']  ?? 'Unknown');
    $iqty   = (int)($item['qty']       ?? 1);
    $iprice = sanitize($item['lineTotal'] ?? '0');
    $iurl   = filter_var($item['url'] ?? '', FILTER_VALIDATE_URL) ? $item['url'] : '';
    
    $link = $iurl ? " (<a href=\"{$iurl}\">ссылка</a>)" : "";
    $items_html .= "• <b>{$iname}</b>{$link} x {$iqty} = {$iprice} BYN\n";
}

$message = "🛍 <b>НОВЫЙ ЗАКАЗ — Chocolandia.by</b>\n\n"
         . "👤 <b>Клиент:</b> {$name}\n"
         . "📞 <b>Тел:</b> {$phone}\n"
         . "📍 <b>Адрес:</b> {$address}\n"
         . ($comment ? "💬 <b>Коммент:</b> {$comment}\n" : "")
         . "\n📦 <b>СОСТАВ:</b>\n{$items_html}\n"
         . "💰 <b>ИТОГО:</b> {$total} BYN";

// 5. Send to Telegram API
$api_url = "https://api.telegram.org/bot{$bot_token}/sendMessage";
$ch = curl_init($api_url);
curl_setopt_array($ch, [
    CURLOPT_POST           => true,
    CURLOPT_POSTFIELDS     => json_encode([
        'chat_id'    => $chat_id,
        'text'       => $message,
        'parse_mode' => 'HTML'
    ]),
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HTTPHEADER     => ['Content-Type: application/json'],
    CURLOPT_TIMEOUT        => 10,
    CURLOPT_SSL_VERIFYPEER => true
]);

$result = curl_exec($ch);
$http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

if ($http_code === 200) {
    echo json_encode(['status' => 'success']);
} else {
    echo json_encode(['status' => 'error', 'message' => 'Failed to notify Telegram']);
}
