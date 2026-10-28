import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const hashWasmBundle = await readFile(path.resolve("node_modules/hash-wasm/dist/index.esm.js"), "utf8");
const openNextRoot = path.resolve(".open-next");
const modules = ["argon2", "blake2b"];

await mkdir(openNextRoot, { recursive: true });
for (const name of modules) {
  const nameMatch = hashWasmBundle.match(new RegExp(`var name\\$(\\w+) = \\"${name}\\";`));
  const match = nameMatch && hashWasmBundle.match(new RegExp(`var data\\$${nameMatch[1]} = \\"([^\\"]+)\\";`));
  if (!match) throw new Error(`Embedded hash-wasm module not found: ${name}`);
  await writeFile(path.join(openNextRoot, `${name}.wasm`), Buffer.from(match[1], "base64"));
}

const worker = path.join(openNextRoot, "worker.js");
const workerSource = await readFile(worker, "utf8");
const importBlock = [
  'import hashWasmArgon2 from "./argon2.wasm";',
  'import hashWasmBlake2b from "./blake2b.wasm";',
  'globalThis.__HASH_WASM_MODULES = new Map([["argon2", hashWasmArgon2], ["blake2b", hashWasmBlake2b]]);',
  "",
].join("\n");

if (!workerSource.includes("__HASH_WASM_MODULES")) {
  await writeFile(worker, `${importBlock}${workerSource}`);
}

console.log("Copied hash-wasm Argon2/BLAKE2b modules and added the precompiled Worker bindings.");
