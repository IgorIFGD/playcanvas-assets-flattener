#!/usr/bin/env node

import fs from "fs";
import path from "path";

const args = process.argv.slice(2);

const options = {
    buildRoot: ".",
    filesFolderName: "files",
    assetsFolderName: "assets",
    configFileName: "config.json",
    settingsFileName: "__settings__.js",
    dryRun: false
};

for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === "--dry-run" || arg === "-d") {
        options.dryRun = true;
    } else if (arg === "--build-root" || arg === "-b") {
        options.buildRoot = args[++i];
    } else if (arg === "--files-folder") {
        options.filesFolderName = args[++i];
    } else if (arg === "--assets-folder") {
        options.assetsFolderName = args[++i];
    } else if (arg === "--config") {
        options.configFileName = args[++i];
    } else if (arg === "--settings") {
        options.settingsFileName = args[++i];
    } else if (arg === "--help" || arg === "-h") {
        printHelp();
        process.exit(0);
    } else {
        console.error(`Unknown argument: ${arg}`);
        printHelp();
        process.exit(1);
    }
}

function printHelp() {
    console.log(`
Usage:
  node flatten-playcanvas-assets.mjs [options]

Options:
  --build-root, -b      Path to PlayCanvas build root. Default: .
  --files-folder        Files folder name. Default: files
  --assets-folder       Assets folder name. Default: assets
  --config              Config file name. Default: config.json
  --settings            Settings file name. Default: __settings__.js
  --dry-run, -d         Print changes without modifying files
  --help, -h            Show help

Examples:
  node flatten-playcanvas-assets.mjs
  node flatten-playcanvas-assets.mjs --dry-run
  node flatten-playcanvas-assets.mjs --build-root "C:/my-build"
`);
}

function normalizeUrlPath(value) {
    return value.replace(/\\/g, "/");
}

function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getSafeFlatName(relativeAssetPath) {
    const relative = normalizeUrlPath(relativeAssetPath);

    // Example:
    // 278789706/1/somefile.json
    // -> 278789706_1_somefile.json
    return relative.replace(/\//g, "_");
}

function getAllFilesRecursive(rootDir) {
    const result = [];

    function walk(currentDir) {
        const entries = fs.readdirSync(currentDir, { withFileTypes: true });

        for (const entry of entries) {
            const fullPath = path.join(currentDir, entry.name);

            if (entry.isDirectory()) {
                walk(fullPath);
            } else if (entry.isFile()) {
                result.push(fullPath);
            }
        }
    }

    walk(rootDir);

    return result;
}

function removeEmptyDirectoriesRecursive(rootDir) {
    const entries = fs.readdirSync(rootDir, { withFileTypes: true });

    for (const entry of entries) {
        if (!entry.isDirectory()) {
            continue;
        }

        const fullPath = path.join(rootDir, entry.name);

        removeEmptyDirectoriesRecursive(fullPath);

        const remaining = fs.readdirSync(fullPath);

        if (remaining.length === 0) {
            fs.rmdirSync(fullPath);
        }
    }
}

function replaceAllLiteral(text, from, to) {
    return text.replace(new RegExp(escapeRegExp(from), "g"), to);
}

function ensureExists(targetPath, description) {
    if (!fs.existsSync(targetPath)) {
        throw new Error(`${description} not found: ${targetPath}`);
    }
}

function isNestedAssetFile(filePath, assetsRoot) {
    const relative = path.relative(assetsRoot, filePath);
    const relativeUrl = normalizeUrlPath(relative);

    // Direct files like files/assets/foo.png are already flat.
    // Nested files like files/assets/278789706/1/foo.png should be flattened.
    return relativeUrl.includes("/");
}

function backupFile(filePath, dryRun) {
    const backupPath = `${filePath}.bak`;

    if (dryRun) {
        console.log(`Would create backup: ${backupPath}`);
        return;
    }

    if (!fs.existsSync(backupPath)) {
        fs.copyFileSync(filePath, backupPath);
        console.log(`Created backup: ${backupPath}`);
    } else {
        console.log(`Backup already exists, leaving it untouched: ${backupPath}`);
    }
}

function patchTextWithRenameMap(text, renameMap, options) {
    let patchedText = text;
    let patchCount = 0;
    const missing = [];

    const filesAssetsPrefix = `${options.filesFolderName}/${options.assetsFolderName}/`;

    for (const [oldUrl, newUrl] of renameMap.entries()) {
        // Supports these variants:
        //
        // Full:
        // files/assets/278789706/1/somefile.json
        //
        // Without files:
        // assets/278789706/1/somefile.json
        //
        // Without files/assets:
        // 278789706/1/somefile.json

        const oldWithoutFiles = oldUrl.substring(options.filesFolderName.length + 1);
        const newWithoutFiles = newUrl.substring(options.filesFolderName.length + 1);

        const oldWithoutFilesAssets = oldUrl.substring(filesAssetsPrefix.length);
        const newWithoutFilesAssets = newUrl.substring(filesAssetsPrefix.length);

        const before = patchedText;

        patchedText = replaceAllLiteral(patchedText, oldUrl, newUrl);
        patchedText = replaceAllLiteral(patchedText, oldWithoutFiles, newWithoutFiles);
        patchedText = replaceAllLiteral(patchedText, oldWithoutFilesAssets, newWithoutFilesAssets);

        if (before !== patchedText) {
            patchCount++;
        } else {
            missing.push(oldUrl);
        }
    }

    return {
        patchedText,
        patchCount,
        missing
    };
}

function patchFile(filePath, description, renameMap, options) {
    if (!fs.existsSync(filePath)) {
        console.warn(`${description} not found, skipping: ${filePath}`);
        return {
            exists: false,
            patchCount: 0,
            missing: []
        };
    }

    const originalText = fs.readFileSync(filePath, "utf8");

    const result = patchTextWithRenameMap(originalText, renameMap, options);

    console.log(`${description} URL entries patched for ${result.patchCount} file(s).`);

    if (!options.dryRun) {
        fs.writeFileSync(filePath, result.patchedText, "utf8");
        console.log(`Patched ${description}`);
    } else {
        console.log(`Would patch ${description}`);
    }

    return {
        exists: true,
        patchCount: result.patchCount,
        missing: result.missing
    };
}

const buildRoot = path.resolve(options.buildRoot);
const filesRoot = path.join(buildRoot, options.filesFolderName);
const assetsRoot = path.join(filesRoot, options.assetsFolderName);
const configPath = path.join(buildRoot, options.configFileName);
const settingsPath = path.join(buildRoot, options.settingsFileName);

ensureExists(filesRoot, "Files folder");
ensureExists(assetsRoot, "Assets folder");
ensureExists(configPath, "Config file");

console.log(`Build root:    ${buildRoot}`);
console.log(`Files root:    ${filesRoot}`);
console.log(`Assets root:   ${assetsRoot}`);
console.log(`Config file:   ${configPath}`);
console.log(`Settings file: ${settingsPath}`);

if (options.dryRun) {
    console.log("DRY RUN MODE: no files will be changed.");
}

backupFile(configPath, options.dryRun);

if (fs.existsSync(settingsPath)) {
    backupFile(settingsPath, options.dryRun);
} else {
    console.warn(`Settings file not found, skipping backup: ${settingsPath}`);
}

const allAssetFiles = getAllFilesRecursive(assetsRoot);

const nestedAssetFiles = allAssetFiles.filter((filePath) => {
    return isNestedAssetFile(filePath, assetsRoot);
});

if (nestedAssetFiles.length === 0) {
    console.log("No nested asset files found. Nothing to flatten.");
    process.exit(0);
}

console.log(`Found ${nestedAssetFiles.length} nested asset file(s).`);

// Build rename map.
//
// Physical:
// ROOT/files/assets/278789706/1/somefile.json
// -> ROOT/files/assets/278789706_1_somefile.json
//
// URL:
// files/assets/278789706/1/somefile.json
// -> files/assets/278789706_1_somefile.json

const renameMap = new Map();
const targetUrls = new Set();

for (const filePath of nestedAssetFiles) {
    const relativePath = path.relative(assetsRoot, filePath);
    const relativeUrl = normalizeUrlPath(relativePath);

    const oldUrl = `${options.filesFolderName}/${options.assetsFolderName}/${relativeUrl}`;
    const flatName = getSafeFlatName(relativeUrl);
    const newUrl = `${options.filesFolderName}/${options.assetsFolderName}/${flatName}`;

    if (renameMap.has(oldUrl)) {
        throw new Error(`Duplicate old URL detected: ${oldUrl}`);
    }

    if (targetUrls.has(newUrl)) {
        throw new Error(`Flat filename collision detected for target: ${newUrl}`);
    }

    targetUrls.add(newUrl);

    const targetPath = path.join(assetsRoot, flatName);

    if (fs.existsSync(targetPath) && path.resolve(filePath) !== path.resolve(targetPath)) {
        throw new Error(`Target file already exists, refusing to overwrite: ${targetPath}`);
    }

    renameMap.set(oldUrl, newUrl);
}

// Patch config.json and __settings__.js

const configPatchResult = patchFile(
    configPath,
    "config.json",
    renameMap,
    options
);

const settingsPatchResult = patchFile(
    settingsPath,
    "__settings__.js",
    renameMap,
    options
);

if (configPatchResult.missing.length > 0) {
    console.warn(`Warning: ${configPatchResult.missing.length} moved file(s) were not found in config.json.`);
}

if (settingsPatchResult.exists && settingsPatchResult.patchCount > 0) {
    console.log("__settings__.js patched successfully. This should cover PRELOAD_MODULES wasm/glue/fallback URLs.");
}

// Move files

for (const filePath of nestedAssetFiles) {
    const relativePath = path.relative(assetsRoot, filePath);
    const relativeUrl = normalizeUrlPath(relativePath);

    const oldUrl = `${options.filesFolderName}/${options.assetsFolderName}/${relativeUrl}`;
    const newUrl = renameMap.get(oldUrl);

    const filesAssetsPrefix = `${options.filesFolderName}/${options.assetsFolderName}/`;
    const flatName = newUrl.substring(filesAssetsPrefix.length);

    const targetPath = path.join(assetsRoot, flatName);

    console.log(`${oldUrl} -> ${newUrl}`);

    if (!options.dryRun) {
        fs.renameSync(filePath, targetPath);
    }
}

// Remove empty folders inside ROOT/files/assets

if (!options.dryRun) {
    removeEmptyDirectoriesRecursive(assetsRoot);
    console.log("Removed empty asset folders.");
} else {
    console.log("Would remove empty asset folders.");
}

// Write manifest

const manifestPath = path.join(buildRoot, "flattened-assets-manifest.json");

const manifest = {
    generatedAt: new Date().toISOString(),
    buildRoot,
    filesFolder: options.filesFolderName,
    assetsFolder: `${options.filesFolderName}/${options.assetsFolderName}`,
    configFile: options.configFileName,
    settingsFile: options.settingsFileName,
    dryRun: options.dryRun,
    configPatchedFiles: configPatchResult.patchCount,
    settingsPatchedFiles: settingsPatchResult.patchCount,
    files: Array.from(renameMap.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([oldUrl, newUrl]) => ({
            oldUrl,
            newUrl
        }))
};

if (!options.dryRun) {
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), "utf8");
    console.log(`Wrote manifest: ${manifestPath}`);
} else {
    console.log(`Would write manifest: ${manifestPath}`);
}

console.log("");
console.log("Done.");

if (configPatchResult.missing.length > 0) {
    console.log("");
    console.log("Files not found in config.json:");

    for (const item of configPatchResult.missing) {
        console.log(`  ${item}`);
    }
}