const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const dir = 'public_html/assets/images';
const files = fs.readdirSync(dir);

async function optimize() {
    console.log('Starting image optimization...');
    for (const file of files) {
        if (file.toLowerCase().endsWith('.png') || file.toLowerCase().endsWith('.jpg') || file.toLowerCase().endsWith('.jpeg')) {
            const inputPath = path.join(dir, file);
            const fileName = path.parse(file).name;
            const outputPath = path.join(dir, fileName + '.webp');
            
            try {
                const metadata = await sharp(inputPath).metadata();
                const pipeline = sharp(inputPath);
                
                if (metadata.width > 1200) {
                    pipeline.resize(1200);
                }
                
                await pipeline
                    .webp({ quality: 75 })
                    .toFile(outputPath);
                
                const statsIn = fs.statSync(inputPath);
                const statsOut = fs.statSync(outputPath);
                console.log(`Optimized ${file}: ${(statsIn.size / 1024 / 1024).toFixed(2)}MB -> ${(statsOut.size / 1024).toFixed(2)}KB`);
                
                // Keep original for fallback or delete? 
                // The user said "optimize", I'll keep them for now but update JSON to use .webp.
            } catch (err) {
                console.error(`Error processing ${file}:`, err);
            }
        }
    }
    console.log('Optimization complete.');
}

optimize();
