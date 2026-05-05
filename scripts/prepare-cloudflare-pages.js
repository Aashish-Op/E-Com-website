const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const outputDir = path.join(root, '.cloudflare-pages-output');

function remove(target) {
  fs.rmSync(target, { recursive: true, force: true });
}

function ensureDir(target) {
  fs.mkdirSync(target, { recursive: true });
}

function copyDir(source, target) {
  ensureDir(target);
  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    const sourcePath = path.join(source, entry.name);
    const targetPath = path.join(target, entry.name);
    if (entry.isDirectory()) {
      copyDir(sourcePath, targetPath);
    } else if (entry.isFile()) {
      fs.copyFileSync(sourcePath, targetPath);
    }
  }
}

function copyFile(source, target) {
  ensureDir(path.dirname(target));
  fs.copyFileSync(source, target);
}

function assertExists(target, label) {
  if (!fs.existsSync(target)) {
    throw new Error(`${label} missing at ${target}`);
  }
}

remove(outputDir);
ensureDir(outputDir);

const pagesDir = path.join(root, 'src', 'pages');
const cssDir = path.join(root, 'src', 'css');
const jsDir = path.join(root, 'src', 'js');
const imagesDir = path.join(root, 'src', 'assets', 'images');
const adminDistDir = path.join(root, 'admin', 'dist');
const workerPath = path.join(root, 'cloudflare-pages', '_worker.js');
const assetsIgnorePath = path.join(root, 'cloudflare-pages', '.assetsignore');

assertExists(pagesDir, 'Storefront pages directory');
assertExists(cssDir, 'CSS directory');
assertExists(jsDir, 'JavaScript directory');
assertExists(imagesDir, 'Images directory');
assertExists(adminDistDir, 'Admin build directory');
assertExists(workerPath, 'Cloudflare Pages worker');
assertExists(assetsIgnorePath, 'Cloudflare assets ignore file');

copyDir(pagesDir, outputDir);
copyDir(cssDir, path.join(outputDir, 'css'));
copyDir(jsDir, path.join(outputDir, 'js'));
copyDir(imagesDir, path.join(outputDir, 'assets', 'images'));
copyDir(imagesDir, outputDir);
copyDir(adminDistDir, path.join(outputDir, 'admin'));
copyFile(workerPath, path.join(outputDir, '_worker.js'));
copyFile(assetsIgnorePath, path.join(outputDir, '.assetsignore'));

console.log(`Cloudflare Pages bundle prepared at ${path.relative(root, outputDir)}`);
