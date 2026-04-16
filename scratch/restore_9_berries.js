const fs = require('fs');

const path = './public_html/data/products.json';
const data = JSON.parse(fs.readFileSync(path, 'utf8'));

const infoBlock = "Информация:\n• Срок годности: 24 часа с с момента изготовления заказа\n• Изготовление: 30-60 минут до выдачи";

const standardVariantsWith9 = [
  { "id": "9-berries", "name": "9 ягод", "price": 55, "weight": "9 ягод" },
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
    if (standardSetsIds.includes(product.id)) {
        // Restore 9-berry option
        product.price = 55;
        product.weight = "9 ягод";
        product.variants = standardVariantsWith9;

        // Clean description and add the 9-berry line at the start
        let desc = product.description;
        // Remove old info block to re-add it correctly later
        desc = desc.replace(/Информация:[\s\S]*$/i, '').trim();
        desc = desc.replace(/Срок годности[\s\S]*$/i, '').trim();
        
        // Remove any existing "9 ягод" line to avoid duplication
        desc = desc.replace(/^9 ягод в стандартной коробке - 55 BYN\n\n/i, '');
        
        // Construct new description
        product.description = "9 ягод в стандартной коробке - 55 BYN\n\n" + desc + "\n\n" + infoBlock;
    }

    // Ensure double "с" in logistics
    if (product.description) {
        product.description = product.description.replace(/с момента/g, 'с с момента');
        product.description = product.description.replace(/с с с момента/g, 'с с момента');
    }
});

fs.writeFileSync(path, JSON.stringify(data, null, 2), 'utf8');
console.log('Restored 9-berry option and indicated "9 ягод в стандартной коробке" in descriptions.');
