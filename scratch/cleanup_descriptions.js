const fs = require('fs');

const path = './public_html/data/products.json';
const data = JSON.parse(fs.readFileSync(path, 'utf8'));

data.products.forEach(product => {
    if (product.description) {
        // Find the "Этот вариант может быть:" section and remove it until it reaches the main description text.
        // Also remove "Выберите размер" text if present.
        
        // Strategy: 
        // 1. Split by "Информация:" to preserve the end block.
        // 2. In the first part, look for "Этот вариант может быть:" and everything following it until "Выберите размер" or the start of the actual item description.
        
        let parts = product.description.split("Информация:");
        let topPart = parts[0];
        let infoPart = parts[1] ? "Информация:" + parts[1] : "";

        // Remove the variants list block
        // Regex to catch "Этот вариант может быть:" until "Выберите размер" or double newline
        topPart = topPart.replace(/Этот вариант может быть:[\s\S]*?(Выберите размер|$)/g, '');
        
        // Remove extra newlines and clean up
        topPart = topPart.trim();
        
        product.description = topPart + (topPart ? "\n\n" : "") + infoPart;
        
        // Minor formatting cleanups
        product.description = product.description.replace(/\n{3,}/g, '\n\n');
    }
});

fs.writeFileSync(path, JSON.stringify(data, null, 2), 'utf8');
console.log('Removed redundant variation text from all product descriptions.');
