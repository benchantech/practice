console.log("%cPractice Log Viewer by Ben Chan | benchantech.com", "color:#0077cc;font-weight:bold;");

const LS_KEYS = ['googleSheetUrl','username','repo','slugs','startDate','endDate','chartStartDate','chartEndDate','chartType','groupBy'];
const colorKey = slug => `color_${slug}`;
const emojiKey = slug => `emoji_${slug}`;
const xpKey = slug => `xp_${slug}`;
const cacheKey = (slug,date) => `logcache_${slug}_${date}`;

function randomColor() {
  return '#'+Math.floor(Math.random()*16777215).toString(16);
}

function toCsvLink(originalUrl) {
  const match = originalUrl.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (!match) return null;
  const sheetId = match[1];
  return `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv`;
}

async function parseGoogleSheet(url) {
  try {
    const csvUrl = toCsvLink(url);
    if (!csvUrl) return null;

    const res = await fetch(csvUrl);
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
        const totalMins = isNaN(mins) ? 0 : mins;

        data[slug][date] = totalMins;
        localStorage.setItem(cacheKey(slug, date), totalMins);
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

function groupData(labels, dataBySlug, groupBy) {
  if (groupBy === 'Day') return { labels, dataBySlug };

  const groupedLabels = [];
  const groupedData = {};

  function getGroupKey(dateStr) {
    const d = new Date(dateStr);
    switch (groupBy) {
      case 'Week': {
        const weekStart = new Date(d);
        weekStart.setDate(d.getDate() - d.getDay());
        return weekStart.toISOString().split('T')[0];
      }
      case 'Month':
        return `${d.getFullYear()}-${('0' + (d.getMonth() + 1)).slice(-2)}`;
      case 'Quarter': {
        const q = Math.floor(d.getMonth() / 3) + 1;
        return `${d.getFullYear()}-Q${q}`;
      }
      case 'Year':
        return `${d.getFullYear()}`;
    }
  }

  labels.forEach(dateStr => {
    const key = getGroupKey(dateStr);
    if (!groupedLabels.includes(key)) groupedLabels.push(key);
    for (const slug in dataBySlug) {
      if (!groupedData[slug]) groupedData[slug] = {};
      if (!groupedData[slug][key]) groupedData[slug][key] = 0;
      groupedData[slug][key] += dataBySlug[slug][dateStr] || 0;
    }
  });

  return { labels: groupedLabels, dataBySlug: groupedData };
}

async function refreshData(forceVisibleOnly = false) {
  const sheetUrl = document.getElementById('googleSheetUrl').value.trim();
  const startDate = document.getElementById('startDate').value.trim();

  if (!sheetUrl && !startDate) {
    alert("Please enter the Start Date of the first practice log in your Git Repo");
    return;
  }

  const chartStart = localStorage.getItem('chartStartDate') || getDefaultChartStart();
  const chartEnd = localStorage.getItem('chartEndDate') || getToday();
  const groupBy = localStorage.getItem('groupBy') || 'Day';
  const visibleDates = getDateRange(chartStart, chartEnd);

  if (sheetUrl && sheetUrl.includes('docs.google.com')) {
    const parsed = await parseGoogleSheet(sheetUrl);
    if (parsed && parsed.dates.length > 0) {
      const { labels, dataBySlug } = groupData(visibleDates, parsed.data, groupBy);
      drawChart(labels, dataBySlug, localStorage.getItem('chartType') || 'line');
      calculateXPandStreaks(parsed.data);
      renderSkillLevels();
      return;
    }
  }

  const username = localStorage.getItem('username');
  const repo = localStorage.getItem('repo');
  const slugs = (localStorage.getItem('slugs') || '').split(',').map(s => s.trim()).filter(Boolean);
  const endDate = localStorage.getItem('endDate');
  const chartType = localStorage.getItem('chartType') || 'line';

  if (!username || !repo || !slugs.length || !startDate) {
    alert('Please provide either a Google Sheets URL or GitHub settings.');
    return;
  }

  const dateRange = forceVisibleOnly ? visibleDates : getDateRange(startDate, endDate);
  const dataBySlug = {};

  for (const slug of slugs) {
    dataBySlug[slug] = {};
    for (const date of dateRange) {
      const key = cacheKey(slug, date);
      let total;
      const [y, m, d] = date.split('-');
      const url = `https://${username}.github.io/${repo}/${slug}/${y}/${m}/${d}.json`;

      let logs = await fetchLog(url);
      if (!Array.isArray(logs)) logs = [];
      total = logs.reduce((sum, entry) => sum + parseInt(entry.minutes || 0, 10), 0);
      localStorage.setItem(key, total);

      dataBySlug[slug][date] = isNaN(total) ? 0 : total;
    }
  }

  const { labels, dataBySlug: groupedData } = groupData(visibleDates, dataBySlug, groupBy);
  drawChart(labels, groupedData, chartType);
  calculateXPandStreaks(dataBySlug);
  renderSkillLevels();
}

function getDefaultChartStart() {
  const today = new Date();
  today.setHours(0,0,0,0);
  const start = new Date(today);
  start.setDate(start.getDate()-7);
  return start.toISOString().split('T')[0];
}

function getToday() {
  const t = new Date();
  t.setHours(0,0,0,0);
  return t.toISOString().split('T')[0];
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

  const canvas = document.getElementById('practiceChart');
  const ctx = canvas.getContext('2d');

  const displayLabels = labels.map(d => d.includes('-') ? d.slice(5) : d);

  if (window.innerWidth <= 600 && !canvas.dataset.fixedHeight) {
    canvas.style.width = '100%';
    canvas.style.height = (window.innerHeight * 0.5) + 'px';
    canvas.dataset.fixedHeight = 'true';
  } else if (window.innerWidth > 600) {
    canvas.style.height = '';
    delete canvas.dataset.fixedHeight;
  }

  const datasets = Object.keys(dataBySlug).map(slug => {
    const color = localStorage.getItem(colorKey(slug)) || randomColor();
    const values = labels.map(d => {
      if (dataBySlug[slug][d] !== undefined) return dataBySlug[slug][d];
      let sum = 0;
      for (const k in dataBySlug[slug]) {
        if (k.startsWith(d)) sum += dataBySlug[slug][k];
      }
      return sum;
    });
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
    try { window.practiceChart.destroy(); } catch (e) {}
  }

  window.practiceChart = new Chart(ctx, {
    type: chartType === 'stackedBar' ? 'bar' : chartType,
    data: { labels: displayLabels, datasets },
    options: {
      responsive: window.innerWidth > 600,
      maintainAspectRatio: window.innerWidth > 600,
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
  const slugs = (localStorage.getItem('slugs') || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);

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
    let totalMinutes = 0;

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key.startsWith(`logcache_${slug}_`)) {
        totalMinutes += parseInt(localStorage.getItem(key), 10) || 0;
      }
    }

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
    label.style.fontSize = '8px';
    label.textContent = allTimeXP[slug];
    xpBarLabels.appendChild(label);
  });

  const allDates = new Set();

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    const match = key.match(/^logcache_(.+)_(\d{4}-\d{2}-\d{2})$/);
    if (match) {
      allDates.add(match[2]);
    }
  }

  const sortedDates = Array.from(allDates).sort();
  const today = new Date().toISOString().split('T')[0];

  let currentStreak = 0;
  let maxStreak = 0;
  let streak = 0;

  sortedDates.forEach(date => {
    let totalMins = 0;
    slugs.forEach(slug => {
      const cachedVal = localStorage.getItem(`logcache_${slug}_${date}`);
      totalMins += cachedVal ? parseInt(cachedVal, 10) || 0 : 0;
    });

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

document.getElementById('shareSettings').addEventListener('click', () => {
  const settings = {};
  LS_KEYS.forEach(k => {
    const val = localStorage.getItem(k);
    if (val) settings[k] = val;
  });

  const encoded = btoa(JSON.stringify(settings));
  const shareUrl = `${window.location.origin}${window.location.pathname}#${encoded}`;

  navigator.clipboard.writeText(shareUrl)
    .then(() => alert('Share link copied to clipboard. Only settings are included.'))
    .catch(() => alert('Unable to copy share link.'));
});

window.addEventListener('load', () => {
  if (window.location.hash.length > 1) {
    try {
      const decoded = JSON.parse(atob(window.location.hash.substring(1)));
      Object.keys(decoded).forEach(k => {
        localStorage.setItem(k, decoded[k]);
        if (document.getElementById(k)) document.getElementById(k).value = decoded[k];
      });

      history.replaceState(null, '', window.location.pathname);

      refreshData();
    } catch (e) {
      console.error('Invalid share data', e);
    }
  } else {
    if (localStorage.getItem('googleSheetUrl') || localStorage.getItem('username')) {
      refreshData();
    }
  }
});

document.getElementById('toggleSettings').addEventListener('click',()=>{
  const s = document.getElementById('settings');
  s.style.display = s.style.display==='none'?'block':'none';
});

document.getElementById('updateSettings').addEventListener('click',()=>{
  LS_KEYS.forEach(k=>{
    const el = document.getElementById(k);
    if (!el) return;
    const val = el.value.trim();
    if (val || k === 'endDate' || k === 'chartEndDate') {
      localStorage.setItem(k, val);
    } else {
      localStorage.removeItem(k);
    }
  });
  saveSlugOptions();
  renderSlugOptions();
  refreshData();

  document.getElementById('toggleSettings').click();
});

document.getElementById('clearEndDate').addEventListener('click',()=>{
  document.getElementById('endDate').value='';
  localStorage.removeItem('endDate');
});

document.getElementById('clearCache').addEventListener('click',()=>{
  const confirmed = confirm('This will clear all cached data and the Google Sheets URL. Continue?');
  if (confirmed) {
    localStorage.clear();
    location.reload();
  }
});

document.getElementById('refreshVisibleDays').addEventListener('click',()=>{
  refreshData(true);
});

document.getElementById('chartStartDate').addEventListener('change', () => {
  const val = document.getElementById('chartStartDate').value.trim();
  localStorage.setItem('chartStartDate', val);
  refreshData();
});

document.getElementById('chartEndDate').addEventListener('change', () => {
  const val = document.getElementById('chartEndDate').value.trim();
  localStorage.setItem('chartEndDate', val);
  refreshData();
});

document.getElementById('groupBy').addEventListener('change', () => {
  const val = document.getElementById('groupBy').value;
  localStorage.setItem('groupBy', val);
  refreshData();
});

LS_KEYS.forEach(k=>{
  const val = localStorage.getItem(k);
  if (val && document.getElementById(k)) document.getElementById(k).value = val;
});
renderSlugOptions();
if(localStorage.getItem('googleSheetUrl') || localStorage.getItem('username')) refreshData();
