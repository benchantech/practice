// levels.js
// Handles calculating skill levels and rendering a table at the bottom of the screen
// Level system: 1–100 per slug, based on total minutes cached (Level 100 = 10,000 hours = 600,000 minutes)

// Calculate level and title name for a given number of minutes
function getSkillLevelData(minutes) {
  const totalNeeded = 600000; // 600k minutes = Level 100
  const level = Math.min(100, Math.floor((minutes / totalNeeded) * 100) + 1);

  // Calculate how many minutes are needed to reach the next level
  const nextLevelMinutes = (level / 100) * totalNeeded;
  const remainingMinutes = Math.max(0, Math.ceil(nextLevelMinutes - minutes));

  // Thematic names for ranges of levels
  let name = '';
  if (level <= 10) name = '🌱 Acorn Tuner';
  else if (level <= 20) name = '🍂 Leaf Flute Player';
  else if (level <= 30) name = '🌳 Oak Harpist';
  else if (level <= 40) name = '🪵 Log String Plucker';
  else if (level <= 50) name = '🌲 Pine Melody Maker';
  else if (level <= 60) name = '🍄 Mushroom Chord Shaper';
  else if (level <= 70) name = '🌿 Evergreen Balladeer';
  else if (level <= 80) name = '🎼 Symphony of the Grove';
  else if (level <= 90) name = '🪶 Feathered Lyric Sage';
  else name = '🐉 Mythic Squirrel Maestro';

  return { level, name, remainingMinutes };
}

// Calculate total minutes, XP, and level for each slug based on cached data
function calculateSkillLevels() {
  const slugs = (localStorage.getItem('slugs') || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);

  const results = {};

  slugs.forEach(slug => {
    let totalMinutes = 0;

    // Sum all cached minutes for this slug across all dates
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key.startsWith(`logcache_${slug}_`)) {
        totalMinutes += parseInt(localStorage.getItem(key), 10) || 0;
      }
    }

    // XP is minutes * XP/min (defaults to 1)
    const xpPerMin = parseInt(localStorage.getItem(`xp_${slug}`) || '1', 10);
    const totalXP = totalMinutes * xpPerMin;

    // Get level data for this slug
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

// Render the skill levels in a table at the bottom of the screen
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

  // Create table element
  const table = document.createElement('table');
  table.style.width = '100%';
  table.style.borderCollapse = 'collapse';
  table.style.marginTop = '10px';

  // Table header
  const headerRow = document.createElement('tr');
  ['Skill', 'Level', 'Title', 'Total Minutes', 'To Next Level'].forEach(text => {
    const th = document.createElement('th');
    th.textContent = text;
    th.style.borderBottom = '2px solid #ccc';
    th.style.textAlign = 'left';
    th.style.padding = '4px 8px';
    headerRow.appendChild(th);
  });
  table.appendChild(headerRow);

  // Add one row per slug
  slugs.forEach(slug => {
    const { level, title, minutes, remainingMinutes } = skills[slug];

    const row = document.createElement('tr');
    const cells = [
      slug,
      `Level ${level}`,
      title,
      minutes.toLocaleString(),
      `${remainingMinutes.toLocaleString()} min`
    ];

    cells.forEach(val => {
      const td = document.createElement('td');
      td.textContent = val;
      td.style.padding = '4px 8px';
      td.style.borderBottom = '1px solid #eee';
      row.appendChild(td);
    });

    table.appendChild(row);
  });

  container.appendChild(table);
}
