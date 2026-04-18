const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const baseDir = 'public_html/assets/images';

async function processDir(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            await processDir(fullPath);
            continue;
        }

        if (file.toLowerCase().endsWith('.png') || file.toLowerCase().endsWith('.jpg') || file.toLowerCase().endsWith('.jpeg')) {
            const fileName = path.parse(file).name;
            const outputPath = path.join(dir, fileName + '.webp');
            
            try {
                // Skip if webp already exists and is newer than source
                if (fs.existsSync(outputPath)) {
                    const sourceStat = fs.statSync(fullPath);
                    const targetStat = fs.statSync(outputPath);
                    if (targetStat.mtime > sourceStat.mtime) {
                        // console.log(`Skipping ${file} (already optimized)`);
                        continue;
                    }
                }

                const metadata = await sharp(fullPath).metadata();
                const pipeline = sharp(fullPath);
                
                if (metadata.width > 1200) {
                    pipeline.resize(1200);
                }
                
                await pipeline
                    .webp({ quality: 80 })
                    .toFile(outputPath);
                
                const statsIn = fs.statSync(fullPath);
                const statsOut = fs.statSync(outputPath);
                console.log(`Optimized ${fullPath}: ${(statsIn.size / 1024 / 1024).toFixed(2)}MB -> ${(statsOut.size / 1024).toFixed(2)}KB`);
                
            } catch (err) {
                console.error(`Error processing ${file}:`, err);
            }
        }
    }
}

async function run() {
    console.log('Starting recursive image optimization...');
    await processDir(baseDir);
    console.log('Optimization complete.');
}

run();
