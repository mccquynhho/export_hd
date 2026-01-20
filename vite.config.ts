import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { crx } from '@crxjs/vite-plugin';
import manifest from './src/manifest.json';
import path from 'path';
import { copyFileSync, mkdirSync, existsSync, readdirSync, statSync } from 'fs';

// Plugin to copy _locales folder and CSS files
function copyAssetsPlugin() {
  return {
    name: 'copy-assets',
    writeBundle() {
      // Copy _locales folder
      const srcLocales = path.resolve(__dirname, 'src/_locales');
      const distLocales = path.resolve(__dirname, 'dist/_locales');
      
      if (existsSync(srcLocales)) {
        function copyRecursive(src: string, dest: string) {
          if (!existsSync(dest)) {
            mkdirSync(dest, { recursive: true });
          }
          
          const entries = readdirSync(src, { withFileTypes: true });
          
          for (const entry of entries) {
            const srcPath = path.join(src, entry.name);
            const destPath = path.join(dest, entry.name);
            
            if (entry.isDirectory()) {
              copyRecursive(srcPath, destPath);
            } else {
              copyFileSync(srcPath, destPath);
            }
          }
        }
        
        copyRecursive(srcLocales, distLocales);
        console.log('✓ Copied _locales folder');
      }

      // Copy CSS files referenced in manifest
      const cssFiles = [
        'src/content/index.css',
      ];

      for (const cssFile of cssFiles) {
        const srcPath = path.resolve(__dirname, cssFile);
        const distPath = path.resolve(__dirname, 'dist', cssFile);
        
        if (existsSync(srcPath)) {
          const distDir = path.dirname(distPath);
          if (!existsSync(distDir)) {
            mkdirSync(distDir, { recursive: true });
          }
          copyFileSync(srcPath, distPath);
          console.log(`✓ Copied ${cssFile}`);
        }
      }
    },
  };
}

export default defineConfig({
  plugins: [
    react(),
    crx({ manifest }),
    copyAssetsPlugin(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    rollupOptions: {
      input: {
        popup: 'src/popup/index.html',
        print: 'src/print/index.html',
      },
    },
  },
});
