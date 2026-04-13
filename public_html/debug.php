<?php
$env_path = dirname(__DIR__) . '/.env';
echo "<h1>Diagnostic Tool</h1>";
echo "<b>Checking .env location:</b> " . htmlspecialchars($env_path) . "<br>";
echo "<b>File exists:</b> " . (file_exists($env_path) ? '<span style="color:green">YES</span>' : '<span style="color:red">NO</span>') . "<br>";

if (file_exists($env_path)) {
    $lines = file($env_path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    echo "<b>Lines found:</b> " . count($lines) . "<br>";
    foreach ($lines as $line) {
        if (strpos($line, '=') !== false) {
            list($key, $val) = explode('=', $line, 2);
            $masked = substr($val, 0, 4) . "..." . substr($val, -4);
            echo "- <b>$key:</b> $masked<br>";
        }
    }
} else {
    echo "<p style='color:orange'>Please ensure the .env file is in the parent directory of public_html.</p>";
}
?>
