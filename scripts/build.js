#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Script để build extension và tạo các file cần thiết

function createIcons() {
  const iconSizes = [16, 48, 128];
  const iconDir = path.join(__dirname, '../public/icons');
  
  // Tạo thư mục icons nếu chưa có
  if (!fs.existsSync(iconDir)) {
    fs.mkdirSync(iconDir, { recursive: true });
  }

  // Tạo các file icon PNG từ SVG (cần ImageMagick hoặc tool khác)
  // Tạm thời tạo file placeholder
  iconSizes.forEach(size => {
    const iconPath = path.join(iconDir, `${size}.png`);
    if (!fs.existsSync(iconPath)) {
      // Tạo file placeholder
      fs.writeFileSync(iconPath, '');
      console.log(`Created placeholder icon: ${size}.png`);
    }
  });
}

function copyManifest() {
  const srcManifest = path.join(__dirname, '../public/manifest.json');
  const distManifest = path.join(__dirname, '../dist/manifest.json');
  
  if (fs.existsSync(srcManifest)) {
    fs.copyFileSync(srcManifest, distManifest);
    console.log('Copied manifest.json to dist/');
  }
}

function copyIcons() {
  const srcIconsDir = path.join(__dirname, '../public/icons');
  const distIconsDir = path.join(__dirname, '../dist/icons');
  
  if (fs.existsSync(srcIconsDir)) {
    if (!fs.existsSync(distIconsDir)) {
      fs.mkdirSync(distIconsDir, { recursive: true });
    }
    
    const files = fs.readdirSync(srcIconsDir);
    files.forEach(file => {
      const srcPath = path.join(srcIconsDir, file);
      const distPath = path.join(distIconsDir, file);
      fs.copyFileSync(srcPath, distPath);
    });
    
    console.log('Copied icons to dist/icons/');
  }
}

function copyLocales() {
  const srcLocalesDir = path.join(__dirname, '../public/_locales');
  const distLocalesDir = path.join(__dirname, '../dist/_locales');
  
  if (fs.existsSync(srcLocalesDir)) {
    if (!fs.existsSync(distLocalesDir)) {
      fs.mkdirSync(distLocalesDir, { recursive: true });
    }
    
    // Copy recursively
    function copyRecursive(src, dest) {
      const files = fs.readdirSync(src);
      files.forEach(file => {
        const srcPath = path.join(src, file);
        const destPath = path.join(dest, file);
        
        if (fs.statSync(srcPath).isDirectory()) {
          if (!fs.existsSync(destPath)) {
            fs.mkdirSync(destPath, { recursive: true });
          }
          copyRecursive(srcPath, destPath);
        } else {
          fs.copyFileSync(srcPath, destPath);
        }
      });
    }
    
    copyRecursive(srcLocalesDir, distLocalesDir);
    console.log('Copied locales to dist/_locales/');
  }
}

function main() {
  console.log('Building extension...');
  
  // Tạo thư mục dist nếu chưa có
  const distDir = path.join(__dirname, '../dist');
  if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir, { recursive: true });
  }
  
  // Tạo icons
  createIcons();
  
  // Copy các file cần thiết
  copyManifest();
  copyIcons();
  copyLocales();
  
  console.log('Extension build completed!');
  console.log('You can now load the extension from the dist/ folder in Chrome.');
}

// Chạy script nếu được gọi trực tiếp
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { createIcons, copyManifest, copyIcons, copyLocales };
