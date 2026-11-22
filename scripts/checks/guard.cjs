const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

// Resolve config from the script's directory
const configPath = path.join(__dirname, 'guard.config.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

// Parse command line arguments for --base override
let baseRef = config.base;
for (const arg of process.argv) {
  if (arg.startsWith('--base=')) {
    baseRef = arg.slice(7);
    break;
  }
}

// Helper to run git commands safely
function runGit(args) {
  try {
    return execFileSync('git', args, {
      cwd: process.cwd(),
      maxBuffer: 64 * 1024 * 1024, // 64MB
      encoding: 'utf8'
    }).trim();
  } catch (err) {
    process.stderr.write(err.stderr || err.message);
    process.exit(2);
  }
}

// Collect all violations here
const violations = [];

// --- (a) Check protected files ---
const changedPaths = new Set();

// Get modified files in working tree compared to base
try {
  const diffOutput = runGit(['diff', '--name-only', baseRef]);
  if (diffOutput) {
    diffOutput.split('\n').forEach(p => changedPaths.add(p));
  }
} catch (e) {
  // If git diff fails, we might still want to check untracked files, 
  // but usually failure here implies a bad base ref which is handled by runGit exit 2.
}

// Get untracked files
const untrackedOutput = runGit(['ls-files', '--others', '--exclude-standard']);
if (untrackedOutput) {
  untrackedOutput.split('\n').forEach(p => changedPaths.add(p));
}

// Check against protected files list
config.protectedFiles.forEach(protectedFile => {
  if (changedPaths.has(protectedFile)) {
    violations.push(`protected file changed: ${protectedFile}`);
  }
});

// --- (b) Check saved-game keys ---
const keyRegex = new RegExp(config.keyPattern, 'g');

// Helper to extract keys from a string content
function extractKeys(content) {
  const keys = new Set();
  let match;
  while ((match = keyRegex.exec(content)) !== null) {
    keys.add(match[1]);
  }
  return keys;
}

// Helper to get keys from git tree for specific paths
// Keys are tracked per file (file -> Set of keys): a key still present in
// another file must not hide a rename or removal in the file that had it.
function getKeysFromGit(paths) {
  const byFile = new Map();
  paths.forEach(filePath => {
    byFile.set(filePath, extractKeys(runGit(['show', `${baseRef}:${filePath}`])));
  });
  return byFile;
}

// Helper to get keys from disk by walking directories
function getKeysFromDisk(dirs) {
  const byFile = new Map();
  
  function walk(currentDir) {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))) {
        try {
          const content = fs.readFileSync(fullPath, 'utf8');
          // Same path style as git (forward slashes, relative to the repo root)
          const rel = path.relative(process.cwd(), fullPath).split(path.sep).join('/');
          byFile.set(rel, extractKeys(content));
        } catch (e) {
          // Ignore read errors
        }
      }
    }
  }

  dirs.forEach(dir => {
    if (fs.existsSync(dir)) {
      walk(dir);
    }
  });
  return byFile;
}

// Get base keys
const basePaths = [];
config.keyDirs.forEach(dir => {
  try {
    // Use git ls-tree to get files in the base ref for these directories
    const treeOutput = runGit(['ls-tree', '-r', '--name-only', baseRef, dir]);
    if (treeOutput) {
      treeOutput.split('\n').forEach(file => {
        if (file.endsWith('.ts') || file.endsWith('.tsx')) {
          basePaths.push(file);
        }
      });
    }
  } catch (e) {
    // Ignore errors
  }
});

const baseByFile = getKeysFromGit(basePaths);

// Get working tree keys
const workingByFile = getKeysFromDisk(config.keyDirs);

// A base key is missing if some file that had it no longer does
const baseKeys = new Set();
const missingSet = new Set();
baseByFile.forEach((keys, file) => {
  const now = workingByFile.get(file) || new Set();
  keys.forEach(key => {
    baseKeys.add(key);
    if (!now.has(key)) {
      missingSet.add(key);
    }
  });
});
const missingKeys = Array.from(missingSet);

// Sort alphabetically
missingKeys.sort();

// Add violations
missingKeys.forEach(key => {
  violations.push(`saved-game key removed or renamed: ${key}`);
});

// --- (c) Check PLAYER_KEYS ---
function extractPlayerKeys(content) {
  const keys = [];
  const lines = content.split('\n');
  let inBlock = false;
  
  for (const line of lines) {
    if (line.includes('const PLAYER_KEYS = [')) {
      inBlock = true;
      continue;
    }
    if (inBlock) {
      if (line.trim() === '];') {
        break;
      }
      // Extract single-quoted string
      const match = line.match(/'([^']+)'/);
      if (match) {
        keys.push(match[1]);
      }
    }
  }
  return new Set(keys);
}

// Get base PLAYER_KEYS
let basePlayerKeys = new Set();
try {
  const baseContent = runGit(['show', `${baseRef}:${config.playerKeysFile}`]);
  basePlayerKeys = extractPlayerKeys(baseContent);
} catch (e) {
  // Ignore errors
}

// Get working tree PLAYER_KEYS
let workingTreePlayerKeys = new Set();
try {
  const wtPath = path.join(process.cwd(), config.playerKeysFile);
  if (fs.existsSync(wtPath)) {
    const wtContent = fs.readFileSync(wtPath, 'utf8');
    workingTreePlayerKeys = extractPlayerKeys(wtContent);
  }
} catch (e) {
  // Ignore errors
}

// Find missing PLAYER_KEYS entries
const missingPlayerKeys = [];
basePlayerKeys.forEach(key => {
  if (!workingTreePlayerKeys.has(key)) {
    missingPlayerKeys.push(key);
  }
});

// Sort alphabetically
missingPlayerKeys.sort();

// Add violations
missingPlayerKeys.forEach(key => {
  violations.push(`PLAYER_KEYS entry removed: ${key}`);
});

// --- Output Results ---
if (violations.length > 0) {
  // Print each violation on its own line
  violations.forEach(v => console.log(v));
  console.log(`guard: ${violations.length} problem(s)`);
  process.exit(1);
} else {
  const changedCount = changedPaths.size;
  const baseKeyCount = baseKeys.size;
  console.log(`guard: OK (${changedCount} changed files, ${baseKeyCount} saved-game keys kept)`);
  process.exit(0);
}
