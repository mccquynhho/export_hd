#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Script đơn giản để tạo icon placeholder
// Trong thực tế, bạn nên sử dụng ImageMagick hoặc tool khác để convert SVG sang PNG

function createIconPlaceholder(size) {
  // Tạo một file PNG đơn giản (base64 encoded)
  // Đây chỉ là placeholder, trong thực tế cần convert từ SVG
  const base64Icon = `iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==`;
  
  const iconPath = path.join(__dirname, `../public/icons/${size}.png`);
  const buffer = Buffer.from(base64Icon, 'base64');
  fs.writeFileSync(iconPath, buffer);
  console.log(`Created placeholder icon: ${size}.png`);
}

function main() {
  const sizes = [16, 48, 128];
  
  console.log('Creating icon placeholders...');
  
  sizes.forEach(size => {
    createIconPlaceholder(size);
  });
  
  console.log('Icon placeholders created successfully!');
  console.log('Note: These are placeholder icons. For production, convert the SVG icon to proper PNG files.');
}

// Chạy script nếu được gọi trực tiếp
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { createIconPlaceholder };
