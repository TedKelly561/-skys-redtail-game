'use strict';

const fs = require('fs');
const path = require('path');

function readLines(filePath) {
  const content = fs.readFileSync(path.join(process.cwd(), filePath), 'utf8');
  return content.split(/\r?\n/);
}

function extractIds(lines, startIdx, regex) {
  const ids = [];
  // Find the end of the list: first line where trim() is exactly '];'
  let endIdx = -1;
  for (let i = startIdx + 1; i < lines.length; i++) {
    if (lines[i].trim() === '];') {
      endIdx = i;
      break;
    }
  }

  if (endIdx === -1) return { ids: [], error: true };

  // Scan strictly between startIdx and endIdx
  for (let i = startIdx + 1; i < endIdx; i++) {
    let match;
    const re = new RegExp(regex, 'g');
    while ((match = re.exec(lines[i])) !== null) {
      ids.push(match[1]);
    }
  }

  return { ids, error: false };
}

function extractFriendKindMembers(lines, startIdx) {
  // Start at the line with 'export type FriendKind ='
  // Members are on subsequent lines starting with ' | ' or similar, ending at ';'
  const members = [];
  
  // Collect from current line onwards until we find a line ending with ';'
  for (let i = startIdx; i < lines.length; i++) {
    const line = lines[i];
    
    // Check if this line ends the type definition
    if (line.trim().endsWith(';')) {
      // Check if there are members on this line before the semicolon
      // e.g., "  | 'last' ;" or just ";"
      const beforeSemi = line.substring(0, line.length - 1).trim();
      if (beforeSemi) {
        const match = beforeSemi.match(/\|?\s*'([^']+)'/);
        if (match) members.push(match[1]);
      }
      break;
    }

    // Look for member pattern: optional pipe, single quoted string
    // Pattern: | 'value' or just 'value' (if first line doesn't have pipe)
    const match = line.match(/\|?\s*'([^']+)'/);
    if (match) {
      members.push(match[1]);
    }
  }

  return members;
}

function findListStart(lines, name, isPlayerKeys) {
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (isPlayerKeys) {
      if (line.startsWith('const ' + name)) return i;
    } else {
      if (line.startsWith('export const ' + name)) return i;
    }
  }
  return -1;
}

function findTypeStart(lines, name) {
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith('export type ' + name)) return i;
  }
  return -1;
}

const problems = [];
const results = {};

// 1. FRIENDS
const friendsLines = readLines('src/game/friends.ts');
const friendsStart = findListStart(friendsLines, 'FRIENDS', false);
if (friendsStart === -1) {
  problems.push('FRIENDS: no entries found (parse failed?)');
} else {
  const { ids, error } = extractIds(friendsLines, friendsStart, /\bkind:\s*'([^']+)'/g);
  if (error || ids.length === 0) {
    problems.push('FRIENDS: no entries found (parse failed?)');
  } else {
    // Check duplicates
    const counts = {};
    ids.forEach(id => { counts[id] = (counts[id] || 0) + 1; });
    for (const id in counts) {
      if (counts[id] > 1) {
        problems.push(`FRIENDS: duplicate id '${id}'`);
      }
    }
    results.FRIENDS = ids.length;
  }
}

// 2. CLOSET_ITEMS
const closetLines = readLines('src/game/closet.ts');
const closetStart = findListStart(closetLines, 'CLOSET_ITEMS', false);
if (closetStart === -1) {
  problems.push('CLOSET_ITEMS: no entries found (parse failed?)');
} else {
  const { ids, error } = extractIds(closetLines, closetStart, /\bid:\s*'([^']+)'/g);
  if (error || ids.length === 0) {
    problems.push('CLOSET_ITEMS: no entries found (parse failed?)');
  } else {
    const counts = {};
    ids.forEach(id => { counts[id] = (counts[id] || 0) + 1; });
    for (const id in counts) {
      if (counts[id] > 1) {
        problems.push(`CLOSET_ITEMS: duplicate id '${id}'`);
      }
    }
    results.CLOSET_ITEMS = ids.length;
  }
}

// 3. HOUSE_ITEMS
const houseLines = readLines('src/game/house.ts');
const houseStart = findListStart(houseLines, 'HOUSE_ITEMS', false);
if (houseStart === -1) {
  problems.push('HOUSE_ITEMS: no entries found (parse failed?)');
} else {
  const { ids, error } = extractIds(houseLines, houseStart, /\bid:\s*'([^']+)'/g);
  if (error || ids.length === 0) {
    problems.push('HOUSE_ITEMS: no entries found (parse failed?)');
  } else {
    const counts = {};
    ids.forEach(id => { counts[id] = (counts[id] || 0) + 1; });
    for (const id in counts) {
      if (counts[id] > 1) {
        problems.push(`HOUSE_ITEMS: duplicate id '${id}'`);
      }
    }
    results.HOUSE_ITEMS = ids.length;
  }
}

// 4. PLAYER_KEYS
const profileLines = readLines('src/game/profiles.ts');
const playerKeysStart = findListStart(profileLines, 'PLAYER_KEYS', true);
if (playerKeysStart === -1) {
  problems.push('PLAYER_KEYS: no entries found (parse failed?)');
} else {
  const { ids, error } = extractIds(profileLines, playerKeysStart, /'([^']+)'/g);
  if (error || ids.length === 0) {
    problems.push('PLAYER_KEYS: no entries found (parse failed?)');
  } else {
    const counts = {};
    ids.forEach(id => { counts[id] = (counts[id] || 0) + 1; });
    for (const id in counts) {
      if (counts[id] > 1) {
        problems.push(`PLAYER_KEYS: duplicate id '${id}'`);
      }
    }
    results.PLAYER_KEYS = ids.length;
  }
}

// 5. FriendKind Type Check
const friendsTypeStart = findTypeStart(friendsLines, 'FriendKind');
let friendKindMembers = [];
if (friendsTypeStart === -1) {
  problems.push('FriendKind: no entries found (parse failed?)');
} else {
  friendKindMembers = extractFriendKindMembers(friendsLines, friendsTypeStart);
  if (friendKindMembers.length === 0) {
    problems.push('FriendKind: no entries found (parse failed?)');
  } else {
    results.FriendKind = friendKindMembers.length;
    
    // Check if all members are in FRIENDS
    const friendsIds = results.FRIENDS !== undefined ? [] : []; 
    // We need the actual ids from FRIENDS for comparison, even if we already processed it.
    // Re-extract or store it. Let's re-extract safely.
    let validFriendsIds = [];
    if (friendsStart !== -1) {
      const res = extractIds(friendsLines, friendsStart, /\bkind:\s*'([^']+)'/g);
      if (!res.error && res.ids.length > 0) validFriendsIds = res.ids;
    }

    const friendKindSet = new Set(friendKindMembers);
    const friendsIdSet = new Set(validFriendsIds);

    // Check for missing in FRIENDS
    for (const kind of friendKindMembers) {
      if (!friendsIdSet.has(kind)) {
        problems.push(`FriendKind: '${kind}' missing from FRIENDS`);
      }
    }

    // Check for extra in FRIENDS
    for (const id of validFriendsIds) {
      if (!friendKindSet.has(id)) {
        problems.push(`FRIENDS: '${id}' is not a FriendKind`);
      }
    }
  }
}

// Output
if (problems.length === 0) {
  // Print OK lines in order
  if (results.FRIENDS !== undefined) console.log(`FRIENDS ${results.FRIENDS} ids OK`);
  if (results.CLOSET_ITEMS !== undefined) console.log(`CLOSET_ITEMS ${results.CLOSET_ITEMS} ids OK`);
  if (results.HOUSE_ITEMS !== undefined) console.log(`HOUSE_ITEMS ${results.HOUSE_ITEMS} ids OK`);
  if (results.PLAYER_KEYS !== undefined) console.log(`PLAYER_KEYS ${results.PLAYER_KEYS} ids OK`);
  if (results.FriendKind !== undefined) console.log(`FriendKind ${results.FriendKind} members OK`);
  console.log('ids: OK');
  process.exit(0);
} else {
  problems.forEach(p => console.log(p));
  console.log(`ids: ${problems.length} problem(s)`);
  process.exit(1);
}
