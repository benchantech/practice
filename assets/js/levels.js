// levels.js
// Practice Log Viewer Level System
// Created by Ben Chan | © Ben Chan Tech LLC
// Handles skill levels for each slug with XP-based progression and themed names.

// =========================
// LOCKED XP THRESHOLDS
// =========================
// Level 100 represents 10,000 hours (600,000 XP).
// Values are cumulative XP required to reach each level.
// 1 minute = 1 XP.
const levelThresholds = [
  0,20,40,70,110,160,220,290,370,460,560,670,790,920,1060,1210,1370,1540,1720,1910,
  2110,2320,2540,2770,3010,3260,3520,3790,4070,4360,4660,4970,5290,5620,5960,6310,6670,7040,7420,7810,
  8210,8620,9040,9470,9910,10360,10820,11290,11770,12260,14280,16420,18680,21060,23560,26180,28920,31780,34760,37860,
  41080,44420,47880,51460,55160,58980,62920,66980,71160,75460,82180,89080,96160,103420,110860,118480,126280,134260,142420,150760,
  165180,179980,195160,210720,226660,242980,259680,276760,294220,312060,344660,378780,414420,451580,490260,530460,572180,615420,660180,600000
];

// =========================
// LEVEL NAMES
// =========================
// Stage names for themed progression. Each covers 3 levels.
// Level 100 gets its own unique name.
// Update stageNames to change all level names at once.
const stageNames = [
  '🌱 Acorn Tuner',
  '🐿️ Nut Collector',
  '🎶 Hollow Log Drummer',
  '🍂 Leaf Flute Player',
  '🌿 Sprout Songweaver',
  '🦊 Woodland Harpist',
  '🪵 Log String Plucker',
  '🌲 Pine Melody Maker',
  '🐇 Hare Tempo Keeper',
  '🦉 Night Owl Chanter',
  '🍄 Mushroom Chord Shaper',
  '🕊️ Sky Note Messenger',
  '🌳 Elder Tree Harmonist',
  '🐺 Howling Harmony Maker',
  '🎼 Symphony of the Grove',
  '🦅 Wind Song Oracle',
  '🪶 Feathered Lyric Sage',
  '🌌 Starwood Virtuoso'
];

const level100Name = '🐉 Mythic Squirrel Maestro';

// Build full name array by repeating each stage name for 3 levels
function buildLevelNames() {
  const names = [];
  stageNames.forEach(name => {
    names.push(name, name, name);
  });
  names[99] = level100Name; // Override Level 100
  return names;
}

const levelNames = buildLevelNames();

// =========================
// LEVEL DATA CALCULATION
// =========================
// Takes total minutes and returns level, name, and XP needed for next level.
function getSkillLevelData(minutes) {
  const xp = minutes; // 1 XP per minute
  let level = 1;

  // Find current level based on thresholds
  for (let i = 0; i < levelThresholds.length; i++) {
    if (xp >= levelThresholds[i]) level = i + 1;
    else break;
  }

  // Remaining XP to next level
  const nextLevelXP = levelThresholds[level] || 600000;
  const remainingMinutes = Math.max(0, nextLevelXP - xp);

  const name = levelNames[level - 1];

  return { level, name, remainingMinutes };
}

// =========================
// CALCULATE LEVELS FOR ALL SLUGS
// =========================
// Reads cached totals for each slug, computes total minutes/XP, and assigns levels.
function calculateSkillLevels() {
  const slugs = (localStorage.getItem('slugs') || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);

  const results = {};

  slugs.forEach(slug => {
    let totalMinutes = 0;

    // Sum all cached minutes for this slug
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key.startsWith(`logcache_${slug}_`)) {
        totalMinutes += parseInt(localStorage.getItem(key), 10) || 0;
      }
    }

    const xpPerMin = parseInt(localStorage.getItem(`xp_${slug}`) || '1', 10);
    const totalXP = totalMinutes * xpPerMin;
    const levelData = getSkillLevelData(totalMinutes);

    results[slug] = {
      minutes: totalMinutes,
      xp: totalXP,
      level: levelData.level,
      title: levelData.name,
      remainingMinutes: levelData.remainingMinutes
    };
  });

  return results;
}

// =========================
// RENDER LEVEL TABLE
// =========================
// Creates a table at the bottom of the page showing each skill's level and progress.
function renderSkillLevels() {
  const skills = calculateSkillLevels();
  const container = document.getElementById('skillLevels');
  if (!container) return;

  container.innerHTML = '';

  const slugs = Object.keys(skills);
  if (slugs.length === 0) {
    container.textContent = 'No skill data available';
    return;
  }

  const table = document.createElement('table');

  // Table header (blank first column for emoji)
  const headerRow = document.createElement('tr');
  ['Slug', 'Level', 'Title', 'XP (Left)'].forEach(text => {
    const th = document.createElement('th');
    th.textContent = text;
    headerRow.appendChild(th);
  });
  table.appendChild(headerRow);

  // Add each slug as a row
  slugs.forEach(slug => {
    const { level, title, minutes, remainingMinutes } = skills[slug];
    const emoji = localStorage.getItem(`emoji_${slug}`) || '';

    const row = document.createElement('tr');
    const cells = [
      emoji + slug,
      level,
      title,
      `${minutes.toLocaleString()} (${remainingMinutes.toLocaleString()})`
    ];

    cells.forEach(val => {
      const td = document.createElement('td');
      td.textContent = val;
      row.appendChild(td);
    });

    table.appendChild(row);
  });

  container.appendChild(table);
}
