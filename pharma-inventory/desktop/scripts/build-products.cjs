const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const ROOT_DIR = path.resolve(__dirname, "../..");
const DESKTOP_DIR = path.resolve(ROOT_DIR, "desktop");
const TAURI_DIR = path.resolve(DESKTOP_DIR, "src-tauri");
const RELEASE_BUILDS_DIR = path.resolve(ROOT_DIR, "release-builds");

const PRODUCTS = {
  agro: {
    id: "agro",
    productName: "Agro Kendra IMS",
    cargoName: "agro-kendra-ims",
    identifier: "com.agrokendra.desktop",
    folder: "Agro-Kendra-IMS",
    iconDir: "icons-agro",
  },
  kirana: {
    id: "kirana",
    productName: "Kirana Store IMS",
    cargoName: "kirana-store-ims",
    identifier: "com.kiranastore.desktop",
    folder: "Kirana-Store-IMS",
    iconDir: "icons-kirana",
  },
  pharma: {
    id: "pharma",
    productName: "Pharma IMS",
    cargoName: "pharma-ims",
    identifier: "com.pharma.desktop",
    folder: "Pharma-IMS",
    iconDir: "icons-pharma",
  },
};

function copyFile(src, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

function stopRunningProcesses() {
  try {
    execSync(
      'powershell -Command "Get-Process -Name \'pharma-inventory\', \'agro-kendra-ims\', \'kirana-store-ims\', \'pharma-ims\' -ErrorAction SilentlyContinue | Stop-Process -Force"',
      { stdio: "ignore" }
    );
  } catch (e) {}
}

function updateCargoToml(cargoName) {
  const cargoPath = path.join(TAURI_DIR, "Cargo.toml");
  let content = fs.readFileSync(cargoPath, "utf-8");
  content = content.replace(/name\s*=\s*"[^"]+"/, `name = "${cargoName}"`);
  fs.writeFileSync(cargoPath, content, "utf-8");
}

function updateIndexHtml(productName) {
  const htmlPath = path.join(DESKTOP_DIR, "index.html");
  let html = fs.readFileSync(htmlPath, "utf-8");
  html = html.replace(/<title>.*?<\/title>/, `<title>${productName}</title>`);
  fs.writeFileSync(htmlPath, html, "utf-8");
}

function updateTauriConf(product) {
  const confPath = path.join(TAURI_DIR, "tauri.conf.json");
  const conf = JSON.parse(fs.readFileSync(confPath, "utf-8"));
  conf.productName = product.productName;
  conf.identifier = product.identifier;
  if (conf.app && conf.app.windows && conf.app.windows[0]) {
    conf.app.windows[0].title = product.productName;
  }
  if (conf.plugins && conf.plugins.updater) {
    conf.plugins.updater.pubkey = "dW50cnVzdGVkIGNvbW1lbnQ6IG1pbmlzaWduIHB1YmxpYyBrZXk6IDZCN0Q4OURFNzg4RjkzRjEKUldUeGs0OTQzb2w5YTVQK000Z3p6bTVWV3JQWXpJRzNWYWZ5WmQ3NzEvL0VRYUtFMjY1YVhaUjgK";
    conf.plugins.updater.endpoints = [
      `https://ims-software-one-theta.vercel.app/api/updates?target={{target}}&current_version={{current_version}}&product=${product.id}`,
      `https://github.com/1001av/IMS-Software/releases/latest/download/latest-${product.id}.json`
    ];
    conf.plugins.updater.dangerousInsecureTransport = true;
  }
  fs.writeFileSync(confPath, JSON.stringify(conf, null, 2), "utf-8");
}

function syncIcons(iconSubdir) {
  const srcIcons = path.join(TAURI_DIR, iconSubdir);
  const destIcons = path.join(TAURI_DIR, "icons");
  const publicDir = path.join(DESKTOP_DIR, "public");

  if (!fs.existsSync(srcIcons)) {
    throw new Error(`Icon source folder does not exist: ${srcIcons}`);
  }

  // Copy into src-tauri/icons
  for (const f of ["32x32.png", "128x128.png", "128x128@2x.png", "icon.ico"]) {
    copyFile(path.join(srcIcons, f), path.join(destIcons, f));
  }

  // Copy into desktop/public
  copyFile(path.join(srcIcons, "app-icon.png"), path.join(publicDir, "app-icon.png"));
  copyFile(path.join(srcIcons, "icon.ico"), path.join(publicDir, "favicon.ico"));
}

function buildProduct(key) {
  const product = PRODUCTS[key];
  if (!product) {
    throw new Error(`Unknown product key: ${key}. Valid keys: agro, kirana, pharma`);
  }

  console.log(`\n======================================================`);
  console.log(`🔨 BUILDING PRODUCT: ${product.productName} (${product.id})`);
  console.log(`======================================================`);

  stopRunningProcesses();

  console.log(`1. Synchronizing ${product.productName} icons...`);
  syncIcons(product.iconDir);

  console.log(`2. Updating Tauri configuration and HTML title...`);
  updateTauriConf(product);
  updateIndexHtml(product.productName);

  console.log(`3. Updating Cargo.toml package name -> ${product.cargoName}...`);
  updateCargoToml(product.cargoName);

  console.log(`4. Building frontend with VITE_PRODUCT_VERTICAL=${product.id}...`);
  execSync("npm run build", {
    cwd: DESKTOP_DIR,
    stdio: "inherit",
    env: { ...process.env, VITE_PRODUCT_VERTICAL: product.id },
  });

  console.log(`5. Building Tauri release binary and Windows NSIS installer...`);
  execSync("npx tauri build", {
    cwd: DESKTOP_DIR,
    stdio: "inherit",
    env: { ...process.env, VITE_PRODUCT_VERTICAL: product.id },
  });

  console.log(`6. Exporting release artifacts to release-builds/${product.folder}...`);
  const targetReleaseDir = path.join(TAURI_DIR, "target", "release");
  const nsisDir = path.join(targetReleaseDir, "bundle", "nsis");
  const outDir = path.join(RELEASE_BUILDS_DIR, product.folder);
  fs.mkdirSync(outDir, { recursive: true });

  // 1. Standalone executable
  const srcExe = path.join(targetReleaseDir, `${product.cargoName}.exe`);
  const destExe = path.join(outDir, `${product.productName}.exe`);
  if (fs.existsSync(srcExe)) {
    copyFile(srcExe, destExe);
    console.log(`   ✓ Standalone Executable: ${destExe}`);
  } else {
    console.warn(`   ⚠️ Could not find expected exe at: ${srcExe}`);
  }

  // 2. NSIS setup installer
  if (fs.existsSync(nsisDir)) {
    const installers = fs
      .readdirSync(nsisDir)
      .filter((f) => f.startsWith(product.productName) && f.endsWith("-setup.exe"));
    for (const inst of installers) {
      const srcInst = path.join(nsisDir, inst);
      const destInst = path.join(outDir, inst);
      copyFile(srcInst, destInst);
      console.log(`   ✓ Windows NSIS Installer: ${destInst}`);
    }
  }

  console.log(`🎉 ${product.productName} successfully built and packaged!\n`);
}

function main() {
  const target = process.argv[2] || "all";
  if (target === "all") {
    console.log("Starting full multi-product build suite for Agro, Kirana, and Pharma...");
    buildProduct("agro");
    buildProduct("kirana");
    buildProduct("pharma");
    // Restore default active product configuration back to agro
    updateTauriConf(PRODUCTS.agro);
    updateCargoToml(PRODUCTS.agro.cargoName);
    updateIndexHtml(PRODUCTS.agro.productName);
    syncIcons(PRODUCTS.agro.iconDir);

    console.log("\n======================================================");
    console.log("✨ ALL THREE PRODUCTS BUILT AND PACKAGED SUCCESSFULLY!");
    console.log(`📁 Artifacts located at: ${RELEASE_BUILDS_DIR}`);
    console.log("======================================================\n");
  } else {
    buildProduct(target);
  }
}

main();
