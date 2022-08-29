
// Script largely inspired by https://gist.github.com/silassare/cc3db860edeea07298cb03f64738c997

const fs = require('fs');
const path = require('path');

const SRC_DIR = path.resolve(__dirname, 'dist', 'esm');

const fileExists = async (filePath) => {
  try {
    const stat = await fs.promises.stat(filePath);
    return stat.isFile();
  } catch (err) {
    return false;
  }
};

const walk = async function* (dir) {
  for await (const entryStat of await fs.promises.opendir(dir)) {
    const entry = path.resolve(dir, entryStat.name);
    if (entryStat.isDirectory()) {
      yield* walk(entry);
    } else if (entryStat.isFile()) {
      yield entry;
    }
  }
};

const resolveImportPath = async (sourceFile, importPath) => {
  const sourceFileAbs = path.resolve(process.cwd(), sourceFile);
  const root = path.dirname(sourceFileAbs);
  if (!path.isAbsolute(importPath) && !importPath.startsWith('@') && !importPath.endsWith('.js')) {
    const importPathAbs = path.resolve(root, importPath);
    let possiblePath = [
      path.resolve(importPathAbs, './index.js'),
      importPathAbs + '.js',
    ];
    if (possiblePath.length) {
      for (let i = 0; i < possiblePath.length; i++) {
        let entry = possiblePath[i];
        if (await fileExists(entry)) {
          const resolved = path.relative(root, entry);
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
  const code = await fs.promises.readFile(filePath, 'utf8');
  const newCode = code.replace(
    /(import) (.+?) from ('[^\n']+'|"[^\n"]+");/gs,
    function (found, action, imported, from) {
      const importPath = from.slice(1, -1);
      const resolvedPath = resolveImportPath(filePath, importPath);
      if (resolvedPath) {
        console.log('\t', importPath, resolvedPath);
        return `${action} ${imported} from '${resolvedPath}';`;
      }
      return found;
    });
  if (code !== newCode) {
    await fs.promises.writeFile(outFilePath, newCode);
  }
};

const main = async () => {
  for await (const entry of walk(SRC_DIR)) {
    if (path.extname(entry) === '.js') {
      console.log(entry);
      await replace(entry, entry);
    }
  }
};

(async () => await main())().catch((err) => {
  console.error(err);
  process.exit(1);
});
