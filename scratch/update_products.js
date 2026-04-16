const fs = require('fs');

const path = './public_html/data/products.json';
const data = JSON.parse(fs.readFileSync(path, 'utf8'));

const infoBlock = "Информация:\n• Срок годности: 24 часа с с момента изготовления заказа\n• Изготовление: 30-60 минут до выдачи";

const standardVariants = [
  { "id": "9-berries", "name": "9 ягод", "price": 55, "weight": "9 ягод" },
  { "id": "12-berries", "name": "12 ягод", "price": 70, "weight": "12 ягод" },
  { "id": "16-berries", "name": "16 ягод", "price": 90, "weight": "16 ягод" },
  { "id": "25-berries", "name": "25 ягод", "price": 135, "weight": "25 ягод" }
];

const standardDescriptionPrefix = "9 ягод в стандартной коробке - 55 BYN\n\nЭтот вариант может быть:\n12 ягод - 70 BYN\n16 ягод - 90 BYN\n25 ягод - 135 BYN\n\nВыберите размер\n\n";

const standardSetsIds = [
    'shokoladny-blyuz',
    'molochny-shokolad-set',
    'malinovy-shejk',
    'shokoladnaya-feeriya',
    'naslazhdenie',
    'malinovy-rassvet',
    'dva-shokolada',
    'malinovy-bum',
    'shokoladnaya-klassika',
    'assorti-premium'
];

data.products.forEach(product => {
    // 1. Restore Information block everywhere
    // First, remove any existing variation of this block to standardize
    // We look for patterns like "Информация:", "Срок годности", etc.
    
    // We'll clean up the existing description from trailing info
    let desc = product.description;
    
    // Remove variations of info block if they exist
    desc = desc.replace(/Информация:[\s\S]*$/i, '').trim();
    desc = desc.replace(/Срок годности[\s\S]*$/i, '').trim();
    
    // 2. Apply standard variations for specific sets
    if (standardSetsIds.includes(product.id)) {
        // Clean up existing variation text if any
        desc = desc.replace(/^9 ягод в стандартной коробке[\s\S]*?Выберите размер/i, '').trim();
        desc = desc.replace(/^Этот вариант может быть[\s\S]*?Выберите размер/i, '').trim();
        
        // Construct new description
        product.description = standardDescriptionPrefix + desc + "\n\n" + infoBlock;
        
        // Update price and variants
        product.price = 55;
        product.weight = "9 ягод";
        product.variants = standardVariants;
    } else {
        // For other products, just ensure they have the info block
        product.description = desc + "\n\n" + infoBlock;
        
        // Ensure "Выберите размер" is added where "Этот вариант может быть:" exists
        if (product.description.includes("Этот вариант может быть:") && !product.description.includes("Выберите размер")) {
            product.description = product.description.replace("Этот вариант может быть:", "Этот вариант может быть:").replace(/\n(Размер|12 ягод|9 ягод|9-berries)/, (match) => "\n" + match); 
            // Better way:
            product.description = product.description.replace(/Этот вариант может быть:\n([\s\S]+?)\n\n/i, "Этот вариант может быть:\n$1\n\nВыберите размер\n\n");
            // If the above regex is too fragile, let's do simple replacement
            if (!product.description.includes("Выберите размер")) {
                const parts = product.description.split("Этот вариант может быть:");
                if (parts.length > 1) {
                    // Try to find where the list ends
                    const subparts = parts[1].split("\n\n");
                    subparts[0] = subparts[0] + "\n\nВыберите размер";
                    product.description = parts[0] + "Этот вариант может быть:" + subparts.join("\n\n");
                }
            }
        }
    }
    
    // Fix punctuation in specific formulations if they appear anywhere else
    product.description = product.description.replace(/с момента/g, 'с с момента');
    // Remove duplicate "с с с момента" if my script runs twice or something
    product.description = product.description.replace(/с с с момента/g, 'с с момента');
});

// Final cleanup: fix "and" in ingredients
data.products.forEach(p => {
    if (p.ingredients) p.ingredients = p.ingredients.replace(/ and /g, ' и ');
});

fs.writeFileSync(path, JSON.stringify(data, null, 2), 'utf8');
console.log('Updated products.json successfully');
