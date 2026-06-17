const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const IMAGES_DIR = path.join(__dirname, '..', 'assets', 'images');

const assetsToGenerate = [
  {
    src: 'icon.svg',
    dest: 'icon.png',
    size: '1024 1024'
  },
  {
    src: 'leaf-foreground.svg',
    dest: 'android-icon-foreground.png',
    size: '1024 1024'
  },
  {
    src: 'gradient-background.svg',
    dest: 'android-icon-background.png',
    size: '1024 1024'
  },
  {
    src: 'leaf-monochrome.svg',
    dest: 'android-icon-monochrome.png',
    size: '1024 1024'
  },
  {
    src: 'bingent-logo.svg',
    dest: 'splash-icon.png',
    size: '1024 1024'
  },
  {
    src: 'bingent-logo.svg',
    dest: 'favicon.png',
    size: '196 196'
  }
];

function main() {
  console.log('--- Generating Bingent App Assets using sharp-cli ---');
  
  for (const asset of assetsToGenerate) {
    const srcPath = path.join(IMAGES_DIR, asset.src);
    const destPath = path.join(IMAGES_DIR, asset.dest);
    
    if (!fs.existsSync(srcPath)) {
      console.warn(`Warning: Source file ${asset.src} does not exist. Skipping...`);
      continue;
    }
    
    console.log(`Generating ${asset.dest} from ${asset.src} (size: ${asset.size})...`);
    try {
      const cmd = `npx sharp-cli -i "${srcPath}" -o "${destPath}" resize ${asset.size}`;
      execSync(cmd, { stdio: 'inherit' });
      console.log(`✓ Successfully generated ${asset.dest}`);
    } catch (error) {
      console.error(`✗ Failed to generate ${asset.dest}:`, error.message);
    }
  }
  
  console.log('--- Asset Generation Complete ---');
}

main();
