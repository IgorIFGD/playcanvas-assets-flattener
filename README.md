# PlayCanvas Build Asset Flattener

A small Node.js utility that post-processes an exported PlayCanvas build by flattening the generated asset folder structure.

PlayCanvas builds usually export assets like this:

```text
ROOT/files/assets/278789706/1/somefile.json
ROOT/files/assets/278792347/1/basis.wasm.wasm
ROOT/files/assets/278792346/1/basis.wasm.js
```

This tool moves those files into a single flat `files/assets/` folder and renames them using their original path parts:

```text
ROOT/files/assets/278789706_1_somefile.json
ROOT/files/assets/278792347_1_basis.wasm.wasm
ROOT/files/assets/278792346_1_basis.wasm.js
```

It also patches asset URLs in:

```text
config.json
__settings__.js
```

This is useful for hosting environments that limit the total number of folders or files per project.

---

## What it does

The script:

1. Finds all nested files inside:

```text
ROOT/files/assets/
```

2. Renames nested asset files from:

```text
files/assets/278789706/1/somefile.json
```

to:

```text
files/assets/278789706_1_somefile.json
```

3. Moves them directly into:

```text
ROOT/files/assets/
```

4. Replaces matching URLs in:

```text
config.json
__settings__.js
```

5. Removes empty asset subfolders.

6. Writes a debug manifest:

```text
flattened-assets-manifest.json
```

7. Creates backups before patching:

```text
config.json.bak
__settings__.js.bak
```

---

## Example

Before:

```text
my-build/
  config.json
  __settings__.js
  files/
    assets/
      278789706/
        1/
          somefile.json
      278792347/
        1/
          basis.wasm.wasm
      278792346/
        1/
          basis.wasm.js
```

After:

```text
my-build/
  config.json
  config.json.bak
  __settings__.js
  __settings__.js.bak
  flattened-assets-manifest.json
  files/
    assets/
      278789706_1_somefile.json
      278792347_1_basis.wasm.wasm
      278792346_1_basis.wasm.js
```

And URLs such as:

```js
window.PRELOAD_MODULES = [
    {
        moduleName: 'BASIS',
        glueUrl: 'files/assets/278792346/1/basis.wasm.js',
        wasmUrl: 'files/assets/278792347/1/basis.wasm.wasm',
        fallbackUrl: 'files/assets/278792345/1/basis.js',
        preload: false
    }
];
```

become:

```js
window.PRELOAD_MODULES = [
    {
        moduleName: 'BASIS',
        glueUrl: 'files/assets/278792346_1_basis.wasm.js',
        wasmUrl: 'files/assets/278792347_1_basis.wasm.wasm',
        fallbackUrl: 'files/assets/278792345_1_basis.js',
        preload: false
    }
];
```

---

## Installation

Clone or download this repository.

No npm packages are required. The script only uses built-in Node.js modules.

Requirements:

```text
Node.js 18+
```

Older Node.js versions may also work, but Node.js 18 or newer is recommended.

---

## Usage

Run the script from the root of an exported PlayCanvas build:

```bash
node flatten-playcanvas-assets.mjs
```

Example:

```text
my-build/
  config.json
  __settings__.js
  files/
    assets/
```

From inside `my-build/`:

```bash
node ../flatten-playcanvas-assets.mjs
```

Or pass the build root explicitly:

```bash
node flatten-playcanvas-assets.mjs --build-root "C:/path/to/playcanvas-build"
```

---

## Dry run

Always test with `--dry-run` first:

```bash
node flatten-playcanvas-assets.mjs --dry-run
```

Dry run mode prints what would be changed without modifying files.

---

## Options

```text
--build-root, -b      Path to the PlayCanvas build root. Default: .
--files-folder        Files folder name. Default: files
--assets-folder       Assets folder name. Default: assets
--config              Config file name. Default: config.json
--settings            Settings file name. Default: __settings__.js
--dry-run, -d         Print changes without modifying files
--help, -h            Show help
```

Examples:

```bash
node flatten-playcanvas-assets.mjs --dry-run
```

```bash
node flatten-playcanvas-assets.mjs --build-root "./dist"
```

```bash
node flatten-playcanvas-assets.mjs --build-root "./dist" --config "config.json" --settings "__settings__.js"
```

---

## Why this is needed

Some hosting platforms have strict limits on the number of folders or total files allowed in a project.

A standard PlayCanvas export may create many folders like:

```text
files/assets/123456789/1/
files/assets/123456790/1/
files/assets/123456791/1/
```

For large projects, this can quickly become a problem.

This script keeps all asset files inside one folder:

```text
files/assets/
```

while preserving unique filenames by encoding the original folder path into the filename.

---

## What gets patched

The script patches literal asset URLs in:

### `config.json`

For normal PlayCanvas asset registry URLs.

Example:

```json
"url": "files/assets/278789706/1/somefile.json"
```

becomes:

```json
"url": "files/assets/278789706_1_somefile.json"
```

### `__settings__.js`

For hardcoded module preload URLs, such as Basis / WASM module paths.

Example:

```js
glueUrl: 'files/assets/278792346/1/basis.wasm.js'
wasmUrl: 'files/assets/278792347/1/basis.wasm.wasm'
fallbackUrl: 'files/assets/278792345/1/basis.js'
```

becomes:

```js
glueUrl: 'files/assets/278792346_1_basis.wasm.js'
wasmUrl: 'files/assets/278792347_1_basis.wasm.wasm'
fallbackUrl: 'files/assets/278792345_1_basis.js'
```

The script also supports common URL variants during replacement:

```text
files/assets/278789706/1/file.png
assets/278789706/1/file.png
278789706/1/file.png
```

---

## Backups

Before modifying files, the script creates backups:

```text
config.json.bak
__settings__.js.bak
```

Existing backup files are not overwritten.

---

## Manifest

After a successful run, the script writes:

```text
flattened-assets-manifest.json
```

Example:

```json
{
  "generatedAt": "2026-05-11T10:00:00.000Z",
  "buildRoot": "C:/project/build",
  "filesFolder": "files",
  "assetsFolder": "files/assets",
  "configFile": "config.json",
  "settingsFile": "__settings__.js",
  "dryRun": false,
  "configPatchedFiles": 120,
  "settingsPatchedFiles": 3,
  "files": [
    {
      "oldUrl": "files/assets/278789706/1/somefile.json",
      "newUrl": "files/assets/278789706_1_somefile.json"
    }
  ]
}
```

This can help with debugging, verification, or rollback.

---

## Important limitations

This script patches `config.json` and `__settings__.js`.

It does not automatically patch arbitrary custom code files.

If your own game scripts contain hardcoded paths like:

```js
fetch("files/assets/278789706/1/data.json")
```

you must patch those manually or extend the script to process your own files.

Also check carefully if your project uses files that reference other files internally by relative path, for example:

```text
.gltf files referencing external .bin files
CSS files referencing images
HTML files referencing images or scripts
custom JSON files referencing other assets
```

For most standard PlayCanvas assets loaded through the asset registry, patching `config.json` is enough.

---

## Recommended workflow

1. Export your PlayCanvas build.
2. Copy the build to a safe test folder.
3. Run:

```bash
node flatten-playcanvas-assets.mjs --build-root "./my-build" --dry-run
```

4. Review the output.
5. Run:

```bash
node flatten-playcanvas-assets.mjs --build-root "./my-build"
```

6. Test the build locally.
7. Upload the processed build to your hosting platform.

---

## Local testing

After processing the build, test it with a local HTTP server.

For example:

```bash
npx serve ./my-build
```

or:

```bash
npx http-server ./my-build
```

Then open the local URL in a browser and check the console/network tab for missing files.

---

## Troubleshooting

### Some files were not found in `config.json`

The script may print something like:

```text
Warning: 3 moved file(s) were not found in config.json.
```

This is not always an error.

Some files may only be referenced from `__settings__.js`, from another file, or from custom code.

Check the generated manifest and browser network tab if something fails to load.

### Browser shows 404 errors

Open DevTools → Network and look for missing files.

If the browser requests old paths like:

```text
files/assets/278789706/1/somefile.json
```

then that path was probably hardcoded somewhere outside `config.json` or `__settings__.js`.

Search your exported build for the old path and patch it manually, or extend the script to patch more files.

### The build works locally but not on hosting

Check whether your hosting platform:

- is case-sensitive
- has file extension restrictions
- blocks `.wasm` files
- serves `.wasm` with the correct MIME type
- has caching enabled for old files

---

## License

MIT

---

## Disclaimer

This is a post-processing tool for exported PlayCanvas builds. It is not an official PlayCanvas tool.

Always keep an original copy of your exported build before running any build-processing script.
