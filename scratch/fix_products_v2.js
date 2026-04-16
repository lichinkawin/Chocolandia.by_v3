const fs = require('fs');

const path = './public_html/data/products.json';
const data = JSON.parse(fs.readFileSync(path, 'utf8'));

const infoBlock = "Информация:\n• Срок годности: 24 часа с с момента изготовления заказа\n• Изготовление: 30-60 минут до выдачи";

const standardVariantsNo9 = [
  { "id": "12-berries", "name": "12 ягод", "price": 70, "weight": "12 ягод" },
  { "id": "16-berries", "name": "16 ягод", "price": 90, "weight": "16 ягод" },
  { "id": "25-berries", "name": "25 ягод", "price": 135, "weight": "25 ягод" }
];

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
    let desc = product.description;
    
    // 1. Remove the variation text from descriptions
    // Patterns to remove (multiline):
    // 1. 9 ягод в стандартной коробке... Choose size
    desc = desc.replace(/^9 ягод в стандартной коробке - 55 BYN\n\nЭтот вариант может быть:\n12 ягод - 70 BYN\n16 ягод - 90 BYN\n25 ягод - 135 BYN\n\nВыберите размер\n\n/i, '');
    
    // 2. Just the "Этот вариант может быть" block
    desc = desc.replace(/Этот вариант может быть:[\s\S]*?Выберите размер\n\n/i, '');
    desc = desc.replace(/Этот вариант может быть:[\s\S]*?Выберите размер/i, '');
    
    // Clean up any remaining "Выберите размер" at the start or middle
    desc = desc.replace(/Выберите размер\n\n/i, '');
    desc = desc.replace(/Выберите размер/i, '');

    // 3. Fix the 9-berry discrepancy for standard sets
    if (standardSetsIds.includes(product.id)) {
        product.price = 70;
        product.weight = "12 ягод";
        product.variants = standardVariantsNo9;
    }
    
    // 4. Ensure Info block is correct and at the end (standardize if it was messed up)
    desc = desc.replace(/Информация:[\s\S]*$/i, '').trim();
    desc = desc.replace(/Срок годности[\s\S]*$/i, '').trim();
    
    product.description = desc + "\n\n" + infoBlock;
    
    // Restore phrasing just in case
    product.description = product.description.replace(/с момента/g, 'с с момента');
    product.description = product.description.replace(/с с с момента/g, 'с с момента');
});

fs.writeFileSync(path, JSON.stringify(data, null, 2), 'utf8');
console.log('Fixed products.json and removed variation text from descriptions.');
