
// Script largely inspired by:
// - https://gist.github.com/silassare/cc3db860edeea07298cb03f64738c997
// - https://github.com/dsblv/string-replace-async/blob/7a7b1c6c5db728c298ac12df05c4eaf7e0ec8805/index.js

const fs = require('fs');
const path = require('path');

const { resolve, dirname, relative, extname } = path;
const { readFile, writeFile, stat, opendir } = fs.promises;

const fileExists = async (filePath) => {
  try {
    return (await stat(filePath)).isFile();
  } catch (err) {
    return false;
  }
};

const stringReplace = async (string, searchValue, replacer) => {
  const promises = [];
  String.prototype.replace.call(string, searchValue, function () {
    promises.push(replacer.apply(undefined, arguments));
    return '';
  });
  const values = await Promise.all(promises);
  return String.prototype.replace.call(string, searchValue, function () {
    return values.shift();
  });
};

const walkDir = async function* (dir) {
  for await (const entryStat of await opendir(dir)) {
    const entry = resolve(dir, entryStat.name);
    if (entryStat.isDirectory()) {
      yield* walkDir(entry);
    } else if (entryStat.isFile()) {
      yield entry;
    }
  }
};

const resolveImportPath = async (sourceFile, importPath) => {
  const root = dirname(sourceFile);
  if (importPath.match(/^\.\.?\//)) {
    const importPathAbs = resolve(root, importPath);
    let possiblePath = [
      resolve(importPathAbs, './index.js'),
      importPathAbs + '.js',
    ];
    if (possiblePath.length) {
      for (let i = 0; i < possiblePath.length; i++) {
        let entry = possiblePath[i];
        if (await fileExists(entry)) {
          const resolved = relative(root, entry);
          if (!resolved.startsWith('.')) {
            return './' + resolved;
          }
          return resolved;
        }
      }
    }
  }
  return null;
};

const replace = async (filePath, outFilePath) => {
  const code = await readFile(filePath, 'utf8');
  const newCode = await stringReplace(code,
    /(import|export) (.+?) from ('[^\n']+'|"[^\n"]+");/gs,
    async (found, action, imported, from) => {
      const importPath = from.slice(1, -1);
      const resolvedPath = await resolveImportPath(filePath, importPath);
      if (resolvedPath) {
        return `${action} ${imported} from '${resolvedPath}';`;
      }
      return found;
    });
  if (code !== newCode) {
    await writeFile(outFilePath, newCode);
  }
};

(async () => {
  const sourceDir = resolve(process.cwd(), process.argv[2] || '.');
  for await (const entry of walkDir(sourceDir)) {
    const ext = extname(entry);
    if (ext === '.js' || ext === '.mjs') {
      await replace(entry, entry);
    }
  }
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
