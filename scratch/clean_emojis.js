const fs = require('fs');
const path = 'public_html/data/products.json';
let content = fs.readFileSync(path, 'utf8');

// List of emojis to remove
const emojis = ['✨', '📍', '❄️', '⏱️', '💝', '🍓', '🧺', '📖', '💎', '🍫', '☯️', '💖', '🤍'];

emojis.forEach(emoji => {
    // Remove emoji and a following space if it exists
    const regex = new RegExp(emoji + ' ?', 'g');
    content = content.replace(regex, '');
});

fs.writeFileSync(path, content);
console.log('Emojis removed successfully');
