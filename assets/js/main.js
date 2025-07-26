console.log("%cPractice Log Viewer by Ben Chan | benchantech.com", "color:#0077cc;font-weight:bold;");

const LS_KEYS = ['googleSheetUrl','username','repo','slugs','startDate','endDate','chartType'];
const colorKey = slug => `color_${slug}`;
const emojiKey = slug => `emoji_${slug}`;
const xpKey = slug => `xp_${slug}`;
const cacheKey = (slug,date) => `logcache_${slug}_${date}`;

function randomColor() {
  return '#'+Math.floor(Math.random()*16777215).toString(16);
}

/* Parse Google Sheets CSV file with correct ordering */
async function parseGoogleSheet(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;

    const text = await res.text();
    const rows = text
      .trim()
      .split(/\r?\n/)
      .map(r => r.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g)?.map(v => v.replace(/^"|"$/g, '').trim()) || []);

    if (rows.length < 2) return null;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const rawDateStrings = rows[0].slice(1);
    const dateMap = [];

    rawDateStrings.forEach((d, idx) => {
      const trimmed = d.replace(/['"]+/g, '').trim();
      if (!trimmed) return;

      let parsed;
      const parts = trimmed.split('/');
      if (parts.length === 3) {
        const [month, day, year] = parts.map(n => parseInt(n, 10));
        parsed = new Date(year, month - 1, day);
      } else {
        parsed = new Date(trimmed);
      }

      if (isNaN(parsed)) return;
      parsed.setHours(0, 0, 0, 0);
      if (parsed > today) return;

      const isoDate = parsed.toISOString().split('T')[0];
      dateMap.push({ idx, date: isoDate });
    });

    dateMap.sort((a, b) => new Date(a.date) - new Date(b.date));

    const slugs = [];
    const data = {};

    for (let i = 1; i < rows.length; i++) {
      let slug = (rows[i][0] || '').trim().replace(/['"]+/g, '');
      if (!slug) continue;
      slugs.push(slug);

      if (!localStorage.getItem(colorKey(slug))) {
        localStorage.setItem(colorKey(slug), randomColor());
      }

      data[slug] = {};
      dateMap.forEach(({ idx, date }) => {
        const rawVal = (rows[i][idx + 1] || '0').replace(/['"]+/g, '').trim();
        const mins = parseInt(rawVal, 10);
        data[slug][date] = isNaN(mins) ? 0 : mins;
        localStorage.setItem(cacheKey(slug, date), data[slug][date]);
      });
    }

    const sortedDates = dateMap.map(d => d.date);

    localStorage.setItem('slugs', slugs.join(','));
    document.getElementById('slugs').value = slugs.join(',');

    return { dates: sortedDates, data };
  } catch (e) {
    console.error("Google Sheets parse error", e);
    return null;
  }
}

async function fetchLog(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) return [];
    return await res.json();
  } catch { return []; }
}

function getDateRange(start, end) {
  const dates = [];
  let cur = new Date(start);
  const endDate = end ? new Date(end) : new Date();
  while (cur <= endDate) {
    dates.push(cur.toISOString().split('T')[0]);
    cur.setDate(cur.getDate()+1);
  }
  return dates;
}

async function refreshData() {
  const sheetUrl = document.getElementById('googleSheetUrl').value.trim();

  if (sheetUrl && sheetUrl.includes('docs.google.com')) {
    const parsed = await parseGoogleSheet(sheetUrl);
    if (parsed && parsed.dates.length > 0) {
      drawChart(parsed.dates,parsed.data, localStorage.getItem('chartType') || 'line');
      calculateXPandStreaks(parsed.data);
      return;
    }
  }

  const username = localStorage.getItem('username');
  const repo = localStorage.getItem('repo');
  const slugs = (localStorage.getItem('slugs')||'').split(',').map(s=>s.trim()).filter(Boolean);
  const startDate = localStorage.getItem('startDate');
  const endDate = localStorage.getItem('endDate');
  const chartType = localStorage.getItem('chartType') || 'line';

  if (!username || !repo || !slugs.length || !startDate) {
    alert('Please provide either a Google Sheets URL or GitHub settings.');
    return;
  }
  
  const dateRange = getDateRange(startDate,endDate);
  const dataBySlug = {};

  for (const slug of slugs) {
    dataBySlug[slug] = {};
    for (const date of dateRange) {
      const key = cacheKey(slug,date);
      let total;
      const cached = localStorage.getItem(key);
      if (cached !== null) {
        total = parseInt(cached,10);
      } else {
        const [y,m,d] = date.split('-');
        const url = `https://${username}.github.io/${repo}/${slug}/${y}/${m}/${d}.json`;
        let logs = await fetchLog(url);
        if (!Array.isArray(logs)) logs = [];
        total = logs.reduce((sum,entry)=>sum+parseInt(entry.minutes||0,10),0);
        localStorage.setItem(key,total);
      }
      dataBySlug[slug][date] = isNaN(total)?0:total;
    }
  }
   drawChart(dateRange,dataBySlug,chartType); 
  calculateXPandStreaks(dataBySlug);
}

function renderSlugOptions() {
  const slugContainer = document.getElementById('slugSettings');
  slugContainer.innerHTML = '';
  const slugs = (document.getElementById('slugs').value||'').split(',').map(s=>s.trim()).filter(Boolean);
  slugs.forEach(slug => {
    const colorVal = localStorage.getItem(colorKey(slug)) || '#0077cc';
    const emojiVal = localStorage.getItem(emojiKey(slug)) || '';
    const xpVal = localStorage.getItem(xpKey(slug)) || '1';
    const div = document.createElement('div');
    div.className = 'slug-options';
    div.innerHTML = `
      <span>${slug}</span>
      <input type="color" data-slug="${slug}" value="${colorVal}">
      <input type="text" placeholder="Color" data-slug-color="${slug}" value="${colorVal}">
      <input type="text" placeholder="Emoji" maxlength="2" data-slug-emoji="${slug}" value="${emojiVal}">
      <input type="number" placeholder="XP/min" min="0" step="1" data-slug-xp="${slug}" value="${xpVal}">
    `;
    slugContainer.appendChild(div);
  });
}

function saveSlugOptions() {
  document.querySelectorAll('input[data-slug]').forEach(inp => {
    localStorage.setItem(colorKey(inp.dataset.slug), inp.value);
  });
  document.querySelectorAll('input[data-slug-color]').forEach(inp => {
    if (inp.value.trim()) localStorage.setItem(colorKey(inp.dataset.slugColor), inp.value.trim());
  });
  document.querySelectorAll('input[data-slug-emoji]').forEach(inp => {
    localStorage.setItem(emojiKey(inp.dataset.slugEmoji), inp.value.trim());
  });
  document.querySelectorAll('input[data-slug-xp]').forEach(inp => {
    localStorage.setItem(xpKey(inp.dataset.slugXp), inp.value.trim() || '1');
  });
}

function drawChart(labels, dataBySlug, chartType) {
  if (!Array.isArray(labels) || labels.length === 0) return;

  const ctx = document.getElementById('practiceChart').getContext('2d');

  const datasets = Object.keys(dataBySlug).map(slug => {
    const color = localStorage.getItem(colorKey(slug)) || randomColor();
    const values = labels.map(d => dataBySlug[slug]?.[d] || 0);
    return {
      label: slug,
      data: values,
      borderColor: color,
      backgroundColor: color,
      fill: chartType !== 'line',
      tension: 0.2
    };
  });

  if (window.practiceChart) {
    try {
      window.practiceChart.destroy();
    } catch (e) {}
  }

  window.practiceChart = new Chart(ctx, {
    type: chartType === 'stackedBar' ? 'bar' : chartType,
    data: { labels, datasets },
    options: {
      responsive: true,
      plugins: { legend: { position: 'bottom' } },
      scales: (chartType === 'pie' || chartType === 'polarArea') ? {} : {
        x: chartType === 'stackedBar' ? { stacked: true } : {},
        y: chartType === 'stackedBar'
          ? { stacked: true, beginAtZero: true, title: { display: true, text: 'Minutes Practiced' } }
          : { beginAtZero: true, title: { display: true, text: 'Minutes Practiced' } }
      }
    }
  });
}

function calculateXPandStreaks(dataBySlug) {
  const slugs = Object.keys(dataBySlug);
  if (slugs.length === 0) {
    document.getElementById('xpBar').innerHTML = '';
    document.getElementById('xpBarLabels').innerHTML = '';
    document.getElementById('streakInfo').textContent = 'No data available';
    return;
  }

  const allTimeXP = {};
  let totalXP = 0;

  slugs.forEach(slug => {
    const xpPerMin = parseInt(localStorage.getItem(xpKey(slug)) || '1', 10);
    const totalMinutes = Object.values(dataBySlug[slug]).reduce((a,b)=>a+b, 0);
    const xp = totalMinutes * xpPerMin;
    allTimeXP[slug] = xp;
    totalXP += xp;
  });

  const xpBar = document.getElementById('xpBar');
  xpBar.innerHTML = '';

  const xpBarLabels = document.getElementById('xpBarLabels');
  xpBarLabels.innerHTML = '';

  slugs.forEach(slug => {
    const color = localStorage.getItem(colorKey(slug)) || '#0077cc';
    const width = totalXP > 0 ? (allTimeXP[slug] / totalXP * 100).toFixed(2) : 0;

    const seg = document.createElement('div');
    seg.style.background = color;
    seg.style.width = width + '%';
    seg.title = `${slug}: ${allTimeXP[slug]} XP — benchantech.com`;
    xpBar.appendChild(seg);

    const label = document.createElement('div');
    label.style.width = width + '%';
    label.textContent = allTimeXP[slug] + ' XP';
    xpBarLabels.appendChild(label);
  });

  const allDates = new Set();
  slugs.forEach(slug => Object.keys(dataBySlug[slug]).forEach(date => allDates.add(date)));

  const sortedDates = Array.from(allDates).sort();
  const today = new Date().toISOString().split('T')[0];

  let currentStreak = 0;
  let maxStreak = 0;
  let streak = 0;

  sortedDates.forEach(date => {
    const totalMins = slugs.reduce((sum, slug) => sum + (dataBySlug[slug][date] || 0), 0);
    if (totalMins > 0) {
      streak++;
      if (streak > maxStreak) maxStreak = streak;
    } else {
      streak = 0;
    }
    if (date === today) currentStreak = streak;
  });

  document.getElementById('streakInfo').textContent =
    `Total XP: ${totalXP} | Current Streak: ${currentStreak} days | Max Streak: ${maxStreak} days`;
}

document.getElementById('toggleSettings').addEventListener('click',()=>{
  const s = document.getElementById('settings');
  s.style.display = s.style.display==='none'?'block':'none';
});

document.getElementById('updateSettings').addEventListener('click',()=>{
  LS_KEYS.forEach(k=>{
    const val = document.getElementById(k).value.trim();
    if (val || k==='endDate') localStorage.setItem(k,val);
  });
  saveSlugOptions();
  refreshData();
}); 

document.getElementById('clearEndDate').addEventListener('click',()=>{
  document.getElementById('endDate').value='';
  localStorage.removeItem('endDate');
});

document.getElementById('clearCache').addEventListener('click',()=>{
  const confirmed = confirm('This will clear all cached data and the Google Sheets URL. Continue?');
  if (confirmed) {
    Object.keys(localStorage).forEach(k=>{
      if (k.startsWith('logcache_') || k==='googleSheetUrl') localStorage.removeItem(k);
    });
    document.getElementById('googleSheetUrl').value='';
    alert('Cache cleared — Practice Log Viewer by Ben Chan | benchantech.com');
  }
});

document.getElementById('refreshVisibleDays').addEventListener('click',()=>{
  refreshData();
});

LS_KEYS.forEach(k=>{
  const val = localStorage.getItem(k);
  if (val) document.getElementById(k).value = val;
});
renderSlugOptions();
if(localStorage.getItem('googleSheetUrl') || localStorage.getItem('username')) refreshData();
