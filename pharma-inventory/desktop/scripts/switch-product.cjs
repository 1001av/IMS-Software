const fs = require("fs");
const path = require("path");

const DESKTOP_DIR = path.resolve(__dirname, "..");
const TAURI_DIR = path.resolve(DESKTOP_DIR, "src-tauri");

const PRODUCTS = {
  agro: {
    id: "agro",
    productName: "Agro Kendra IMS",
    cargoName: "agro-kendra-ims",
    identifier: "com.agrokendra.desktop",
  },
  kirana: {
    id: "kirana",
    productName: "Kirana Store IMS",
    cargoName: "kirana-store-ims",
    identifier: "com.kiranastore.desktop",
  },
  pharma: {
    id: "pharma",
    productName: "Pharma IMS",
    cargoName: "pharma-ims",
    identifier: "com.pharma.desktop",
  },
};

const key = process.argv[2] || "agro";
const product = PRODUCTS[key];
if (!product) {
  console.error(`Invalid product key '${key}'. Choose one of: agro, kirana, pharma`);
  process.exit(1);
}

// 1. Update tauri.conf.json
const confPath = path.join(TAURI_DIR, "tauri.conf.json");
const conf = JSON.parse(fs.readFileSync(confPath, "utf-8"));
conf.productName = product.productName;
conf.identifier = product.identifier;
if (conf.app && conf.app.windows && conf.app.windows[0]) {
  conf.app.windows[0].title = product.productName;
}
if (conf.plugins && conf.plugins.updater) {
  conf.plugins.updater.endpoints = [
    `https://ims-software-one-theta.vercel.app/api/updates?target={{target}}&current_version={{current_version}}&product=${product.id}`,
    `https://github.com/1001av/IMS-Software/releases/latest/download/latest-${product.id}.json`,
  ];
  conf.plugins.updater.dangerousInsecureTransport = true;
}
fs.writeFileSync(confPath, JSON.stringify(conf, null, 2), "utf-8");

// 2. Update Cargo.toml
const cargoPath = path.join(TAURI_DIR, "Cargo.toml");
let cargo = fs.readFileSync(cargoPath, "utf-8");
cargo = cargo.replace(/name\s*=\s*"[^"]+"/, `name = "${product.cargoName}"`);
fs.writeFileSync(cargoPath, cargo, "utf-8");

// 3. Update index.html
const htmlPath = path.join(DESKTOP_DIR, "index.html");
let html = fs.readFileSync(htmlPath, "utf-8");
html = html.replace(/<title>.*?<\/title>/, `<title>${product.productName}</title>`);
fs.writeFileSync(htmlPath, html, "utf-8");

console.log(`✓ Active product successfully switched to: ${product.productName} (${product.id})`);
