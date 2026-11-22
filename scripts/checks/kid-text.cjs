const fs = require('fs');
const path = require('path');

// Parse args
let maxWords = 14;
let reportOnly = false;
const args = process.argv.slice(2);
for (const arg of args) {
  if (arg.startsWith('--max-words=')) {
    maxWords = parseInt(arg.split('=')[1], 10);
  } else if (arg === '--report') {
    reportOnly = true;
  }
}

// Load banned words
const bannedPath = path.join(__dirname, 'kid-text-banned.txt');
let bannedEntries = [];
try {
  const content = fs.readFileSync(bannedPath, 'utf8');
  bannedEntries = content.split('\n').map(s => s.trim()).filter(s => s.length > 0);
} catch (e) {
  // If file missing, treat as empty list
}

// Escape regex special chars
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Build banned regexes
const bannedRegexes = bannedEntries.map(entry => {
  // Replace spaces with \s+ for matching any whitespace run
  const escapedEntry = escapeRegex(entry).replace(/\\ /g, '\\s+');
  // Use lookbehind/lookahead to ensure whole word match (letters/digits)
  return new RegExp('(?<![\p{L}\p{N}])' + escapedEntry + '(?![\p{L}\p{N}])', 'iu');
});

// Scan src/game/*.ts
const gameDir = path.join(process.cwd(), 'src', 'game');
let files;
try {
  files = fs.readdirSync(gameDir).filter(f => f.endsWith('.ts')).sort();
} catch (e) {
  // Directory might not exist or be empty
  console.log('kidtext: 0 messages, 0 too long, 0 banned');
  process.exit(0);
}

const callPattern = /(?:onTipMessage|narrator\.say|onTreasurePopup|cheer)\(\s*/g;
let totalMessages = 0;
let totalTooLong = 0;
let totalBanned = 0;
const findings = [];

for (const file of files) {
  const filePath = 'src/game/' + file; // forward slashes on every OS, like git paths
  const fullPath = path.join(gameDir, file);
  const content = fs.readFileSync(fullPath, 'utf8');
  
  let match;
  while ((match = callPattern.exec(content)) !== null) {
    const startIdx = match.index + match[0].length;
    // Find the first quote character after the opening paren (allowing whitespace/newlines)
    let quoteIdx = -1;
    let quoteChar = '';
    
    for (let i = startIdx; i < content.length; i++) {
      const char = content[i];
      if (char === ' ' || char === '\n' || char === '\r' || char === '\t') continue;
      if (char === "'" || char === '"' || char === '`') {
        quoteIdx = i;
        quoteChar = char;
        break;
      } else {
        // Not a quote, so not a string literal argument. Skip this call.
        break;
      }
    }
    
    if (quoteIdx === -1) continue;

    // Extract the string literal content
    let endIdx = -1;
    let i = quoteIdx + 1;
    while (i < content.length) {
      const char = content[i];
      if (char === '\\') {
        i += 2; // Skip escaped character
        continue;
      }
      if (char === quoteChar) {
        endIdx = i;
        break;
      }
      i++;
    }
    
    if (endIdx === -1) continue; // Unterminated string

    const rawContent = content.substring(quoteIdx + 1, endIdx);
    
    // Calculate line number of the opening quote (1-based)
    const beforeQuote = content.substring(0, quoteIdx);
    const lineNumber = (beforeQuote.match(/\n/g) || []).length + 1;

    // Process template literals: replace ${...} with X
    let processedContent = rawContent;
    if (quoteChar === '`') {
      processedContent = rawContent.replace(/\$\{[^}]*\}/g, 'X');
    }

    // Collapse newlines to spaces for display and processing
    const displayText = processedContent.replace(/[\r\n]+/g, ' ').trim();
    
    // Count words: split on whitespace, keep tokens with at least one letter/digit
    const tokens = displayText.split(/\s+/).filter(t => t.length > 0);
    const wordCount = tokens.filter(t => /[\p{L}\p{N}]/u.test(t)).length;

    totalMessages++;

    // Check too long
    if (wordCount > maxWords) {
      totalTooLong++;
      findings.push(`${filePath}:${lineNumber}  ${wordCount} words  "${displayText}"`);
    }

    // Check banned words
    for (const regex of bannedRegexes) {
      if (regex.test(displayText)) {
        totalBanned++;
        // Find the entry that matched to report it
        const entry = bannedEntries.find(e => {
          const r = new RegExp('(?<![\p{L}\p{N}])' + escapeRegex(e).replace(/\\ /g, '\\s+') + '(?![\p{L}\p{N}])', 'iu');
          return r.test(displayText);
        });
        findings.push(`${filePath}:${lineNumber}  banned "${entry}"  "${displayText}"`);
      }
    }
  }
}

// Output findings
for (const f of findings) {
  console.log(f);
}

console.log(`kidtext: ${totalMessages} messages, ${totalTooLong} too long, ${totalBanned} banned`);

if (!reportOnly && (totalTooLong > 0 || totalBanned > 0)) {
  process.exit(1);
} else {
  process.exit(0);
}
