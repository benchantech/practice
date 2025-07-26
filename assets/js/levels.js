// levels.js

// Locked XP thresholds for Levels 1–100
const levelThresholds = [
  0,20,40,70,110,160,220,290,370,460,560,670,790,920,1060,1210,1370,1540,1720,1910,
  2110,2320,2540,2770,3010,3260,3520,3790,4070,4360,4660,4970,5290,5620,5960,6310,6670,7040,7420,7810,
  8210,8620,9040,9470,9910,10360,10820,11290,11770,12260,14280,16420,18680,21060,23560,26180,28920,31780,34760,37860,
  41080,44420,47880,51460,55160,58980,62920,66980,71160,75460,82180,89080,96160,103420,110860,118480,126280,134260,142420,150760,
  165180,179980,195160,210720,226660,242980,259680,276760,294220,312060,344660,378780,414420,451580,490260,530460,572180,615420,660180,600000
];

// Level names change every 3 levels; Level 100 unique
const levelNames = [
  '🌱 Acorn Tuner', '🌱 Acorn Tuner', '🌱 Acorn Tuner',
  '🐿️ Nut Collector', '🐿️ Nut Collector', '🐿️ Nut Collector',
  '🎶 Hollow Log Drummer', '🎶 Hollow Log Drummer', '🎶 Hollow Log Drummer',
  '🍂 Leaf Flute Player', '🍂 Leaf Flute Player', '🍂 Leaf Flute Player',
  '🌿 Sprout Songweaver', '🌿 Sprout Songweaver', '🌿 Sprout Songweaver',
  '🦊 Woodland Harpist', '🦊 Woodland Harpist', '🦊 Woodland Harpist',
  '🪵 Log String Plucker', '🪵 Log String Plucker', '🪵 Log String Plucker',
  '🌲 Pine Melody Maker', '🌲 Pine Melody Maker', '🌲 Pine Melody Maker',
  '🐇 Hare Tempo Keeper', '🐇 Hare Tempo Keeper', '🐇 Hare Tempo Keeper',
  '🦉 Night Owl Chanter', '🦉 Night Owl Chanter', '🦉 Night Owl Chanter',
  '🍄 Mushroom Chord Shaper', '🍄 Mushroom Chord Shaper', '🍄 Mushroom Chord Shaper',
  '🕊️ Sky Note Messenger', '🕊️ Sky Note Messenger', '🕊️ Sky Note Messenger',
  '🌳 Elder Tree Harmonist', '🌳 Elder Tree Harmonist', '🌳 Elder Tree Harmonist',
  '🐺 Howling Harmony Maker', '🐺 Howling Harmony Maker', '🐺 Howling Harmony Maker',
  '🎼 Symphony of the Grove', '🎼 Symphony of the Grove', '🎼 Symphony of the Grove',
  '🦅 Wind Song Oracle', '🦅 Wind Song Oracle', '🦅 Wind Song Oracle',
  '🪶 Feathered Lyric Sage', '🪶 Feathered Lyric Sage', '🪶 Feathered Lyric Sage',
  '🌌 Starwood Virtuoso', '🌌 Starwood Virtuoso', '🌌 Starwood Virtuoso',
  '🐉 Mythic Squirrel Maestro' // Level 100
];

// Get level data based on total minutes
function getSkillLevelData(minutes) {
  const xp = minutes; // 1 XP per minute
  let level = 1;

  for (let i = 0; i < levelThresholds.length; i++) {
    if (xp >= levelThresholds[i]) level = i + 1;
    else break;
  }

  const nextLevelXP = levelThresholds[level] || 600000;
  const remainingMinutes = Math.max(0, nextLevelXP - xp);

  const name = levelNames[level - 1] || '🐉 Mythic Squirrel Maestro';

  return { level, name, remainingMinutes };
}

// Calculate total minutes, XP, and level for each slug
function calculateSkillLevels() {
  const slugs = (localStorage.getItem('slugs') || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);

  const results = {};

  slugs.forEach(slug => {
    let totalMinutes = 0;

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

// Render levels as table at bottom of page
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

  // Blank header for emoji column
  const headerRow = document.createElement('tr');
  ['', 'Skill', 'Level', 'Title', 'Total Minutes', 'To Next Level'].forEach(text => {
    const th = document.createElement('th');
    th.textContent = text;
    headerRow.appendChild(th);
  });
  table.appendChild(headerRow);

  slugs.forEach(slug => {
    const { level, title, minutes, remainingMinutes } = skills[slug];
    const emoji = localStorage.getItem(`emoji_${slug}`) || '';

    const row = document.createElement('tr');
    const cells = [
      emoji,
      slug,
      `Level ${level}`,
      title,
      minutes.toLocaleString(),
      `${remainingMinutes.toLocaleString()} min`
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
