
let NEWS_DATA = [];
let SCHEDULE_DATA = {};

async function loadData() {
  try {
    // Load schedule
    SCHEDULE_DATA[activeYear] = [];
    const seriesList = ['f1', 'f2', 'f3', 'wec', 'wrc', 'fe', 'indycar', 'nascar', 'igtc', 'nls', 'gtwceu', 'motogp', 'imsa'];
    for (const s of seriesList) {
      try {
        const res = await fetch(`data/schedule/${activeYear}/${s}_${activeYear}.json`);
        if (res.ok) {
          const rawData = await res.json();
          let sData = rawData;
          if (rawData.calendar) {
            let seriesName = rawData.series_slug.toUpperCase();
            if (rawData.series_slug === 'indycar') seriesName = 'IndyCar';

            sData = rawData.calendar.map(calItem => {
              const rSesh = calItem.sessions.find(sesh => sesh.code === 'R') || calItem.sessions[calItem.sessions.length - 1] || {};
              let rDateObj = new Date(calItem.event_end_date);
              if (rSesh.start_time && rSesh.start_time !== "TBC" && rSesh.start_time !== "N.S.") {
                rDateObj = new Date(rSesh.start_time);
              }
              const pad = n => String(n).padStart(2, '0');
              const eDateStr = `${rDateObj.getFullYear()}-${pad(rDateObj.getMonth() + 1)}-${pad(rDateObj.getDate())}`;

              return {
                id: calItem.id,
                date: eDateStr,
                series: seriesName,
                seriesWebsite: rawData.series_website || null,
                name: calItem.event_name,
                location: calItem.location,
                sessions: calItem.sessions.map(sesh => {
                  let lDate = "";
                  let lTime = "";
                  let startTimeISO = null;
                  let endTimeISO = null;
                  let endTimeFormatted = "";
                  let isMultiDay = false;
                  let endDay = "";
                  let endDayMonth = "";

                  if (sesh.start_time === "TBC" || sesh.start_time === "N.S." || !sesh.start_time) {
                    const dStr = sesh.date_tbc || calItem.event_end_date;
                    const d = new Date(dStr);
                    lDate = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
                    lTime = "N.S.";
                    // For N.S. events, we can set start and end to end of day to avoid active state issues
                    startTimeISO = new Date(lDate + 'T23:59:59').toISOString();
                    endTimeISO = new Date(lDate + 'T23:59:59').toISOString();
                  } else {
                    const d = new Date(sesh.start_time);
                    lDate = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
                    lTime = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
                    startTimeISO = d.toISOString();
                    if (sesh.end_time) {
                      endTimeISO = new Date(sesh.end_time).toISOString();
                    } else {
                      // Default durations for logic (Happening Now)
                      const typeLower = (sesh.type || "").toLowerCase();
                      const codeLower = (sesh.code || "").toLowerCase();
                      let durationHours = 2; // Default for Race, Feature, Sprint, etc.

                      if (typeLower.includes("qualifying") || codeLower.startsWith("q") || codeLower.startsWith("tq")) {
                        durationHours = 1;
                      } else if (typeLower.includes("practice") || codeLower.startsWith("fp") || codeLower === "w") {
                        durationHours = 1;
                      }

                      endTimeISO = new Date(d.getTime() + durationHours * 60 * 60 * 1000).toISOString();
                    }
                  }
                  isMultiDay = false;
                  endDay = "";
                  endDayMonth = "";

                  if (endTimeISO && lTime !== "N.S." && sesh.end_time) {
                    const sd = new Date(sesh.start_time);
                    const ed = new Date(sesh.end_time);
                    endTimeFormatted = `${pad(ed.getHours())}:${pad(ed.getMinutes())}`;

                    if (sd.toDateString() !== ed.toDateString()) {
                      isMultiDay = true;
                      endDay = pad(ed.getDate());
                      endDayMonth = pad(ed.getMonth() + 1);
                    }
                  }

                  let cssCode = sesh.code ? sesh.code.toLowerCase() : 'u';
                  if (cssCode.startsWith('fp') || cssCode === 'w') cssCode = 'fp';
                  if (cssCode.startsWith('q') || cssCode.startsWith('tq')) cssCode = 'q';

                  return {
                    code: cssCode,
                    type: sesh.type,
                    date: lDate,
                    time: lTime,
                    endTimeFormatted: endTimeFormatted,
                    isMultiDay: isMultiDay,
                    endDay: endDay,
                    endDayMonth: endDayMonth,
                    startTimeISO: startTimeISO,
                    endTimeISO: endTimeISO,
                    local: calItem.location,
                    official: sesh.links?.official || null,
                    broadcaster: sesh.links?.broadcast || null
                  };
                })
              };
            });
          }
          SCHEDULE_DATA[activeYear].push(...sData);
        }
      } catch (e) {
        // file might not exist, ignore
      }
    }

  } catch (err) {
    console.error("Error loading data", err);
  }
}

// Fetch external news from custom API proxy
async function loadExternalNews() {
  const grid = document.getElementById('news-grid');
  if (!grid) return;

  grid.innerHTML = '<div class="loading-overlay d-flex w-100" style="position:relative;height:150px;grid-column:1/-1;"><div class="spinner-border text-primary m-auto"></div></div>';

  try {
    // Fetch local data.json with cache-busting mechanism
    const timestamp = new Date().getTime();
    const res = await fetch(`data/news/data.json?v=${timestamp}`);

    // Proper error handling
    if (!res.ok) {
      throw new Error(`HTTP error! status: ${res.status}`);
    }

    const data = await res.json();

    // DOM Manipulation Skeleton / Integration
    let allNews = [];

    // Handle our customized merged format with 5 distinct series
    if (data.f1_news) allNews = allNews.concat(data.f1_news.map(n => ({ ...n, _cat: 'F1' })));
    if (data.wec_news) allNews = allNews.concat(data.wec_news.map(n => ({ ...n, _cat: 'WEC' })));
    if (data.us_news) allNews = allNews.concat(data.us_news.map(n => ({ ...n, _cat: 'US Racing' })));
    if (data.wrc_news) allNews = allNews.concat(data.wrc_news.map(n => ({ ...n, _cat: 'WRC' })));
    if (data.motogp_news) allNews = allNews.concat(data.motogp_news.map(n => ({ ...n, _cat: 'MotoGP' })));

    // Fallback for single query structures just in case
    if (allNews.length === 0 && data.articles) {
      allNews = data.articles.map(n => ({ ...n, _cat: 'News' }));
    }

    // Proactively fix categories based on strong URL or keyword signals
    const getBestCategory = (article, currentCat) => {
      const url = (article.url || '').toLowerCase();

      // 1. Explicit URL parsing (more flexible to catch paths like /nascar-os/ or slugs like formula-e-berlino)
      if (url.match(/[\/-]f1[\/-]/)) return 'F1';
      if (url.includes('motogp')) return 'MotoGP';
      if (url.match(/[\/-]wec[\/-]/) || url.includes('lemans') || url.includes('24-heures-du-mans')) return 'WEC';
      if (url.match(/[\/-]wrc[\/-]/)) return 'WRC';
      if (url.includes('formula-e')) return 'FE';
      if (url.includes('indycar')) return 'IndyCar';
      if (url.includes('nascar')) return 'NASCAR';
      if (url.match(/[\/-]imsa[\/-]/) || url.includes('weathertech-sportscar')) return 'IMSA';
      if (url.match(/[\/-]f2[\/-]/)) return 'F2';
      if (url.match(/[\/-]f3[\/-]/)) return 'F3';
      if (url.includes('gt-world-challenge')) return 'GTWCEU';

      // 2. Keyword fallback (checking title and description)
      const texts = [
        article.title || '',
        article.description || ''
      ].join(' ').toLowerCase();

      const check = (keywords) => keywords.some(k => texts.includes(k));

      // We check in order of specificity to avoid F1 crossover false positives.
      if (check(['motogp', 'moto2', 'moto3'])) return 'MotoGP';
      if (check(['wec', 'le mans', 'hypercar', 'endurance championship', 'lmdh'])) return 'WEC';
      if (check(['indycar', 'indy 500'])) return 'IndyCar';
      if (check(['nascar'])) return 'NASCAR';
      if (check(['imsa', 'laguna seca', 'daytona'])) return 'IMSA';
      if (check(['formula e', 'formula-e'])) return 'FE';
      if (check(['wrc', 'rally'])) return 'WRC';
      if (check(['gt world challenge', 'gtwceu'])) return 'GTWCEU';
      if (check(['f1', 'formula 1'])) return 'F1';

      // 3. Fallback to API. Map generic API categories to standard ones if needed.
      if (currentCat === 'US Racing') return 'IndyCar';
      return currentCat;
    };

    // Apply the fix to every article
    allNews.forEach(n => {
      n._cat = getBestCategory(n, n._cat);
    });

    // Deduplicate by title
    const seenTitles = new Map();
    allNews.forEach(n => {
      const title = n.title ? n.title.trim() : '';
      if (!title) return;
      const lowerTitle = title.toLowerCase();

      if (!seenTitles.has(lowerTitle)) {
        seenTitles.set(lowerTitle, n);
      }
    });

    allNews = Array.from(seenTitles.values());

    // Sort by date descending
    allNews.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));

    EXTERNAL_NEWS = allNews;

    // Dynamically build categories based on what actually exists
    const uniqueCats = new Set(EXTERNAL_NEWS.map(n => n._cat).filter(Boolean));
    NEWS_CATEGORIES = ["All", ...Array.from(uniqueCats).sort()];
    buildNewsFilters();

    if (allNews.length === 0) {
      grid.innerHTML = `<div class="no-events w-100 text-center" style="grid-column:1/-1">No news found.</div>`;
      return;
    }

    const homeGrid = document.getElementById('home-news-grid');
    if (homeGrid) {
      homeGrid.innerHTML = renderCards(allNews.slice(0, 6));
    }

    renderPaginatedNews();
  } catch (e) {
    console.error("Failed to fetch or parse data.json:", e);
    const errorHtml = `<div class="no-events w-100 text-center" style="grid-column:1/-1;color:var(--bs-danger);">Error loading news: ${e.message}</div>`;
    grid.innerHTML = errorHtml;
    const homeGrid = document.getElementById('home-news-grid');
    if (homeGrid) homeGrid.innerHTML = errorHtml;
  }
}

const renderCards = (newsArray) => newsArray.map((item, idx) => {
  const hasImage = item.urlToImage && item.urlToImage !== 'null';
  const imgHtml = hasImage
    ? `<div class="api-news-img" style="background-image: url('${item.urlToImage}')"></div>`
    : `<div class="api-news-placeholder d-flex align-items-center justify-content-center"><i class="bi bi-image" style="font-size:2.5rem;color:#333"></i></div>`;

  const dateObj = new Date(item.publishedAt);
  const dateStr = dateObj.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });

  return `
        <article class="api-news-card fade-up fade-up-${Math.min(idx + 1, 5)}" onclick="window.open('${item.url}', '_blank')">
            <div class="api-news-image">
                <span class="cat-badge ${item._cat.toLowerCase().replace(/ /g, '-')}">${item._cat}</span>
                ${imgHtml}
            </div>
            <div class="api-news-body">
                <h3 class="api-news-title">${item.title || 'No Title'}</h3>
                <p class="api-news-desc">${item.description || ''}</p>
                <div class="api-news-meta">
                    <span class="api-news-source">${item.source?.name || 'Unknown'}</span>
                    <span class="api-news-date">${dateStr}</span>
                </div>
            </div>
        </article>
        `;
}).join('');

function renderPaginatedNews() {
  const grid = document.getElementById('news-grid');
  const pagination = document.getElementById('news-pagination');
  if (!grid || !pagination) return;

  // Filter based on search query and category
  let filteredNews = EXTERNAL_NEWS;

  if (activeNewsFilter !== 'All') {
    filteredNews = filteredNews.filter(item => item._cat === activeNewsFilter);
  }

  if (currentNewsQuery) {
    filteredNews = filteredNews.filter(item => {
      const title = (item.title || '').toLowerCase();
      return title.includes(currentNewsQuery);
    });
  }

  if (filteredNews.length === 0) {
    grid.innerHTML = `<div class="no-events w-100 text-center" style="grid-column:1/-1">No news found for this search.</div>`;
    pagination.innerHTML = '';
    return;
  }

  const totalPages = Math.ceil(filteredNews.length / NEWS_PER_PAGE);
  if (currentNewsPage > totalPages) currentNewsPage = totalPages;
  if (currentNewsPage < 1) currentNewsPage = 1;

  const startIndex = (currentNewsPage - 1) * NEWS_PER_PAGE;
  const endIndex = startIndex + NEWS_PER_PAGE;
  const currentItems = filteredNews.slice(startIndex, endIndex);

  grid.innerHTML = renderCards(currentItems);

  // Build Pagination UI
  if (totalPages <= 1) {
    pagination.innerHTML = '';
    return;
  }

  let paginationHtml = '';

  // Prev button
  paginationHtml += `<button class="rm-page-btn" ${currentNewsPage === 1 ? 'disabled' : ''} onclick="changeNewsPage(${currentNewsPage - 1})"><i class="bi bi-chevron-left"></i></button>`;

  // Page numbers logic (show few pages around current)
  let startPage = Math.max(1, currentNewsPage - 2);
  let endPage = Math.min(totalPages, currentNewsPage + 2);

  if (startPage > 1) {
    paginationHtml += `<button class="rm-page-btn" onclick="changeNewsPage(1)">1</button>`;
    if (startPage > 2) paginationHtml += `<span class="rm-page-btn" style="border:none;background:transparent;cursor:default;">...</span>`;
  }

  for (let i = startPage; i <= endPage; i++) {
    paginationHtml += `<button class="rm-page-btn ${i === currentNewsPage ? 'active' : ''}" onclick="changeNewsPage(${i})">${i}</button>`;
  }

  if (endPage < totalPages) {
    if (endPage < totalPages - 1) paginationHtml += `<span class="rm-page-btn" style="border:none;background:transparent;cursor:default;">...</span>`;
    paginationHtml += `<button class="rm-page-btn" onclick="changeNewsPage(${totalPages})">${totalPages}</button>`;
  }

  // Next button
  paginationHtml += `<button class="rm-page-btn" ${currentNewsPage === totalPages ? 'disabled' : ''} onclick="changeNewsPage(${currentNewsPage + 1})"><i class="bi bi-chevron-right"></i></button>`;

  pagination.innerHTML = paginationHtml;
}

window.changeNewsPage = function (page) {
  currentNewsPage = page;
  renderPaginatedNews();
  // Scroll slightly up to the start of the news grid
  const newsSection = document.getElementById('news');
  if (newsSection) {
    newsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

async function initPage() {
  await loadData();
  loadExternalNews();
  buildTimeline();
}
// Category filter for paginated news
window.setNewsFilter = function (cat) {
  activeNewsFilter = cat;
  currentNewsPage = 1;
  buildNewsFilters();
  renderPaginatedNews();
}

window.setYear = async function (yr) {
  activeYear = yr;
  await loadData();
  buildYearSelector();
  activeSeries = 'All'; // reset
  buildSchedule();
}

// Now replace initial calls at the bottom of main.js
// ============================================================
//  APP STATE
// ============================================================
let EXTERNAL_NEWS = [];
let currentNewsPage = 1;
const NEWS_PER_PAGE = 24;
let currentNewsQuery = '';

let activeNewsFilter = "All";
let activeYear = 2026;
let activeSeries = "All";
let activeEventId = null;
let countdownInterval = null;
let isChronologicalView = false;
let isProgrammaticScroll = false;
let programmaticScrollTimeout = null;

let NEWS_CATEGORIES = ["All", "F1", "WEC", "WRC", "US Racing", "MotoGP"];
const YEARS = [2025, 2026];

// ============================================================
//  HELPERS
// ============================================================
function fmt(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function fmtShort(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function fmtTime(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

function getDay(dateStr) {
  return new Date(dateStr + 'T00:00:00').getDate();
}

function getMonthShort(dateStr) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-GB', { month: 'short' }).toUpperCase();
}

function isToday(dateStr) {
  const now = new Date();
  const d = new Date(dateStr + 'T00:00:00');
  return d.toDateString() === now.toDateString();
}

function isPast(dateStr) {
  return new Date(dateStr + 'T23:59:59') < new Date();
}

function isFuture(dateStr) {
  return new Date(dateStr + 'T00:00:00') > new Date();
}

// ============================================================
//  SECTION TOGGLING
// ============================================================
function showSection(name) {
  document.querySelectorAll('.rm-section').forEach(s => s.style.display = 'none');
  const el = document.getElementById(name);
  if (el) el.style.display = '';
  document.querySelectorAll('.rm-nav .nav-link').forEach(l => {
    l.classList.toggle('active', l.getAttribute('href') === '#' + name);
  });

  if (name === 'schedule') {
    isProgrammaticScroll = true;
    if (programmaticScrollTimeout) clearTimeout(programmaticScrollTimeout);

    // Slight delay to ensure DOM is visible for scroll calculation
    setTimeout(() => {
      scrollTimelineToActive();
      programmaticScrollTimeout = setTimeout(() => {
        isProgrammaticScroll = false;
      }, 500);
    }, 50);
  }

  // Close navbar on mobile after selection
  const navMain = document.getElementById('navMain');
  if (navMain && navMain.classList.contains('show')) {
    const bsCollapse = bootstrap.Collapse.getInstance(navMain) || new bootstrap.Collapse(navMain);
    bsCollapse.hide();
  }
}

// ============================================================
//  NEWS — Render
// ============================================================

function buildNewsFilters() {
  const wrap = document.getElementById('news-filters');
  wrap.innerHTML = NEWS_CATEGORIES.map(cat =>
    `<button class="rm-filter-btn ${cat === activeNewsFilter ? 'active' : ''}"
               onclick="setNewsFilter('${cat}')">${cat}</button>`
  ).join('');
}

window.setNewsFilterOriginal = function (cat) {
  activeNewsFilter = cat;
  buildNewsFilters();
  buildNewsGrid();
}

// Generate a decorative SVG for each news card
function newsCardSVG(cat, idx) {
  const palettes = [
    { bg: '#0067A5', stripe: '#F4621F', text: '#fff' }, // Gulf
    { bg: '#1B4332', stripe: '#FFCF00', text: '#fff' }, // BRG
    { bg: '#C8102E', stripe: '#F5F0E8', text: '#fff' }, // Ferrari
    { bg: '#6B21A8', stripe: '#C084FC', text: '#fff' }, // Purple
    { bg: '#0891B2', stripe: '#67E8F9', text: '#fff' }, // Cyan
  ];
  const p = palettes[idx % palettes.length];
  return `<svg class="news-card-graphic" viewBox="0 0 300 150" xmlns="http://www.w3.org/2000/svg">
      <rect width="300" height="150" fill="${p.bg}"/>
      <rect x="0" y="110" width="300" height="6" fill="${p.stripe}" opacity="0.8"/>
      <rect x="0" y="120" width="300" height="2" fill="${p.stripe}" opacity="0.4"/>
      <!-- racing number decoration -->
      <text x="230" y="105" font-family="'Barlow Condensed',sans-serif" font-weight="900"
            font-size="90" fill="${p.stripe}" opacity="0.15" text-anchor="middle">${idx + 1}</text>
      <text x="30" y="48" font-family="'Barlow Condensed',sans-serif" font-weight="700"
            font-size="13" fill="${p.text}" opacity="0.7" letter-spacing="3">${cat.toUpperCase()}</text>
      <!-- diagonal stripes -->
      ${[0, 1, 2, 3, 4].map(i =>
    `<line x1="${-20 + i * 60}" y1="0" x2="${40 + i * 60}" y2="150"
               stroke="${p.stripe}" stroke-width="1" opacity="0.12"/>`
  ).join('')}
    </svg>`;
}

function buildNewsGrid() {
  const grid = document.getElementById('news-grid');
  const filtered = activeNewsFilter === 'All'
    ? NEWS_DATA
    : NEWS_DATA.filter(n => n.category === activeNewsFilter);

  if (!filtered.length) {
    grid.innerHTML = `<div class="no-events col-span-full" style="grid-column:1/-1">No news for this category.</div>`;
    return;
  }

  grid.innerHTML = filtered.map((item, idx) => `
      <article class="news-card fade-up fade-up-${Math.min(idx + 1, 5)}">
        <div class="news-card-image">
          <span class="cat-badge ${item.catClass || ''}">${item.category}</span>
          ${newsCardSVG(item.category, idx)}
        </div>
        <div class="news-card-body">
          <div>
            <h3 class="news-card-title">${item.title}</h3>
            <p class="news-card-sub">${item.subtitle}</p>
          </div>
          <div class="news-card-meta">
            <span class="news-source">${item.source}</span>
            <span class="news-date">${fmt(item.date)}</span>
          </div>
        </div>
      </article>
    `).join('');
}

// ============================================================
//  SCHEDULE — Data helpers
// ============================================================
function getEvents(year) {
  return (SCHEDULE_DATA[year] || []).sort((a, b) => a.date.localeCompare(b.date));
}

function getActiveOrNextEvents(events) {
  const now = new Date();
  // Find all events that are currently happening
  const happening = events.filter(e => {
    return e.sessions.some(s => {
      return now >= new Date(s.startTimeISO) && now < new Date(s.endTimeISO);
    });
  });

  if (happening.length > 0) return happening;

  // If none happening, find the first event with an upcoming session
  const next = events.find(e => {
    return e.sessions.some(s => new Date(s.endTimeISO) > now);
  });

  return next ? [next] : [];
}

function getUniqueEventDates(events) {
  return [...new Set(events.map(e => e.date))];
}

function getSeries(events) {
  const uniqueSeries = [...new Set(events.map(e => e.series))].sort((a, b) => a.localeCompare(b));
  return ['All', ...uniqueSeries];
}

// ============================================================
//  SCHEDULE — Year selector
// ============================================================
function buildYearSelector() {
  const wrap = document.getElementById('year-selector');
  wrap.innerHTML = `
      <div class="d-flex align-items-center gap-2">
        <span class="section-label mb-0" style="margin-bottom:0!important">Season:</span>
        <select class="form-select form-select-sm w-auto" style="background-color: var(--card-bg); color: var(--text-main); border: 1px solid var(--border-color); cursor: pointer;" onchange="setYear(parseInt(this.value))">
          ${YEARS.map(y => `<option value="${y}" ${y === activeYear ? 'selected' : ''}>${y}</option>`).join('')}
        </select>
      </div>`;
}

function setYear(y) {
  activeYear = y;
  activeSeries = 'All';
  activeEventId = null;
  buildYearSelector();
  buildSchedule();
}

// ============================================================
//  SCHEDULE — Next event hero + countdown
// ============================================================
function buildNextEventHero(events) {
  const hero = document.getElementById('next-event-hero');
  if (!events || events.length === 0) {
    hero.innerHTML = `<p class="no-events">No upcoming events found.</p>`;
    hero.onclick = null;
    hero.classList.remove('hero-clickable');
    hero.removeAttribute('role');
    hero.removeAttribute('tabindex');
    hero.removeAttribute('title');
    return;
  }

  // Clear interval for any previous setup
  if (countdownInterval) clearInterval(countdownInterval);

  const now = new Date();

  // CASE: Multiple events happening simultaneously
  if (events.length > 1) {
    hero.classList.remove('hero-clickable');
    hero.onclick = null;
    hero.innerHTML = `
      <div class="multi-live-header mb-3">
        <i class="bi bi-broadcast me-2"></i> ${events.length} EVENTS LIVE NOW
      </div>
      <div class="row gy-3">
        ${events.map(ev => {
      const s = ev.sessions.find(sesh => now >= new Date(sesh.startTimeISO) && now < new Date(sesh.endTimeISO)) || ev.sessions[0];
      return `
            <div class="col-md-6">
              <div class="multi-live-card" onclick="goToScheduleAndScroll('${ev.id}')">
                <div class="d-flex justify-content-between align-items-center mb-1">
                  <div class="next-event-label">${ev.series}</div>
                  <span class="live-tag-sm">LIVE</span>
                </div>
                <div class="next-event-name" style="font-size: 1.25rem; margin-bottom: 0.25rem;">${ev.name}</div>
                <div class="happening-now-hero" style="font-size: 1.1rem; color: var(--ferrari-red);">
                  ${s.type}
                </div>
              </div>
            </div>
          `;
    }).join('')}
      </div>
    `;
    return;
  }

  // CASE: Single event (Next or currently active)
  const event = events[0];
  hero.classList.add('hero-clickable');
  hero.setAttribute('role', 'button');
  hero.setAttribute('tabindex', '0');
  hero.setAttribute('title', 'Go to Event Schedule');
  hero.onclick = () => goToScheduleAndScroll(event.id);

  const nextSession = event.sessions.find(s => {
    return new Date(s.endTimeISO) > new Date();
  }) || event.sessions[event.sessions.length - 1];

  hero.innerHTML = `
      <div class="row gy-4 align-items-center">
        <div class="col-lg-7">
          <div class="next-event-label"><i class="bi bi-flag-fill me-1"></i>Next Event</div>
          <div class="next-event-name">${event.name}</div>
          <div class="next-event-detail">
            <i class="bi bi-geo-alt me-1"></i>${event.location}
          </div>
          <div class="divider-racing mt-2 mb-2"></div>
          <div class="next-event-detail">
            <i class="bi bi-calendar3 me-1"></i>${fmtShort(event.date)}
            &nbsp;·&nbsp;
            <span class="event-series-badge badge-${event.series.toLowerCase()}">${event.series}</span>
          </div>
        </div>
        <div class="col-lg-5 d-flex flex-column align-items-start align-items-lg-center text-start text-lg-center">
          <div class="section-label" id="hero-session-label">Countdown to ${nextSession.type}</div>
          <div class="countdown-wrap mt-1" id="countdown-wrap"></div>
        </div>
      </div>
      <div class="hero-cta">
        View Full Schedule <i class="bi bi-arrow-right"></i>
      </div>
    `;

  const wrap = document.getElementById('countdown-wrap');
  const startTarget = new Date(nextSession.startTimeISO);
  const endTarget = new Date(nextSession.endTimeISO);

  function tick() {
    const currentNow = new Date();
    if (!wrap) return;

    const labelEl = document.getElementById('hero-session-label');
    if (currentNow >= startTarget && currentNow < endTarget) {
      if (nextSession.time === "N.S.") {
        if (labelEl) labelEl.textContent = `${nextSession.type} — TODAY`;
        wrap.innerHTML = `<span class="section-label" style="color:var(--text-muted)">TIME N.S.</span>`;
      } else {
        if (labelEl) labelEl.style.display = 'none';
        wrap.innerHTML = `<div class="happening-now-hero">${nextSession.type} <span class="live-tag">LIVE NOW</span></div>`;
      }
      return;
    } else if (currentNow >= endTarget) {
      if (labelEl) labelEl.style.display = 'none';
      wrap.innerHTML = `<span class="section-label" style="color:var(--text-muted)">SESSION FINISHED</span>`;
      clearInterval(countdownInterval);
      return;
    }

    if (labelEl) {
      labelEl.style.display = 'block';
      labelEl.textContent = `Countdown to ${nextSession.type}`;
    }

    const diff = startTarget - currentNow;
    const days = Math.floor(diff / 86400000);
    const hours = Math.floor((diff % 86400000) / 3600000);
    const mins = Math.floor((diff % 3600000) / 60000);
    const secs = Math.floor((diff % 60000) / 1000);
    wrap.innerHTML = `
        <div class="countdown-unit"><span class="countdown-num">${String(days).padStart(2, '0')}</span><span class="countdown-label">Days</span></div>
        <div class="countdown-sep">:</div>
        <div class="countdown-unit"><span class="countdown-num">${String(hours).padStart(2, '0')}</span><span class="countdown-label">Hrs</span></div>
        <div class="countdown-sep">:</div>
        <div class="countdown-unit"><span class="countdown-num">${String(mins).padStart(2, '0')}</span><span class="countdown-label">Min</span></div>
        <div class="countdown-sep">:</div>
        <div class="countdown-unit"><span class="countdown-num">${String(secs).padStart(2, '0')}</span><span class="countdown-label">Sec</span></div>
      `;
  }
  tick();
  countdownInterval = setInterval(tick, 1000);
}

// ============================================================
//  SCHEDULE — Timeline
// ============================================================
function buildTimeline(events, nextEvent) {
  const scroll = document.getElementById('timeline-scroll');
  if (!events.length) {
    scroll.innerHTML = '';
    return;
  }

  // Group events by date
  const groupedByDate = {};
  events.forEach(ev => {
    if (!groupedByDate[ev.date]) groupedByDate[ev.date] = [];
    groupedByDate[ev.date].push(ev);
  });

  const uniqueDates = Object.keys(groupedByDate).sort();

  // Get date of active event to show correct active state
  const activeEvent = events.find(e => e.id === activeEventId);
  const activeDate = activeEvent ? activeEvent.date : (nextEvent ? nextEvent.date : null);
  const nextDate = nextEvent ? nextEvent.date : null;

  scroll.innerHTML = uniqueDates.map(dateStr => {
    const dayEvents = groupedByDate[dateStr];
    const firstEventId = dayEvents[0].id;
    const past = isPast(dateStr);
    const isActive = dateStr === activeDate;
    const isNext = dateStr === nextDate;

    return `<button
        class="timeline-date-btn ${past ? 'past' : ''} ${isNext ? 'next-indicator' : ''} ${isActive ? 'active' : ''}"
        onclick="selectEvent('${firstEventId}')"
        data-date="${dateStr}"
        id="tl-date-${dateStr}">
          <span class="tl-month">${getMonthShort(dateStr)}</span>
          <span class="tl-day">${getDay(dateStr)}</span>
      </button>`;
  }).join('');
}

function jumpToNextEvent() {
  const events = getFilteredEvents();
  const activeOrNext = getActiveOrNextEvents(events);
  if (activeOrNext.length > 0) selectEvent(activeOrNext[0].id);
}

function scrollTimelineToActive() {
  const active = document.querySelector(`.timeline-date-btn.active`);
  if (active) active.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
}

function updateActiveTimelineBtn(dateStr) {
  if (!dateStr) return;
  const currentActive = document.querySelector('.timeline-date-btn.active');
  if (currentActive && currentActive.getAttribute('data-date') === dateStr) {
    return;
  }

  document.querySelectorAll('.timeline-date-btn').forEach(b => b.classList.remove('active'));

  const newActive = document.querySelector(`.timeline-date-btn[data-date="${dateStr}"]`);
  if (newActive) {
    newActive.classList.add('active');
    scrollTimelineToActive();
  }
}

let scrollTimeoutAuto;
function initTimelineScrollSpy() {
  window.addEventListener('scroll', () => {
    if (isProgrammaticScroll) return;
    if (scrollTimeoutAuto) cancelAnimationFrame(scrollTimeoutAuto);

    scrollTimeoutAuto = requestAnimationFrame(() => {
      const groups = document.querySelectorAll('.event-group[data-date]');
      if (!groups.length) return;

      let stickyOffset = 160;
      const rootStyles = getComputedStyle(document.documentElement);
      const dynamicOffset = rootStyles.getPropertyValue('--dynamic-scroll-offset');
      if (dynamicOffset) stickyOffset = parseInt(dynamicOffset);

      const targetLine = stickyOffset + 50;
      let bestGroup = null;
      let minDiff = Infinity;

      for (const g of groups) {
        const rect = g.getBoundingClientRect();
        if (rect.height === 0) continue; // Skip hidden ones

        if (rect.top <= targetLine && rect.bottom >= targetLine) {
          bestGroup = g;
          break;
        } else if (rect.top > targetLine) {
          if (!bestGroup && rect.top - targetLine < minDiff) {
            bestGroup = g;
          }
          break;
        }
        bestGroup = g;
      }

      if (bestGroup) {
        updateActiveTimelineBtn(bestGroup.getAttribute('data-date'));
      }
    });
  }, { passive: true });
}

// ============================================================
//  SCHEDULE — Series tabs & View Toggle
// ============================================================
function buildSeriesTabs(events) {
  const series = getSeries(events);
  const wrap = document.getElementById('series-tabs');
  wrap.innerHTML = series.map(s =>
    `<button class="series-tab ${s === activeSeries ? 'active' : ''}"
               onclick="setSeries('${s}')">${s}</button>`
  ).join('');
  buildViewToggle();
}

function buildViewToggle() {
  const wrap = document.getElementById('view-toggle-wrap');
  if (!wrap) return;
  if (activeSeries !== 'All') {
    wrap.innerHTML = '';
    return;
  }
  wrap.innerHTML = `
      <div class="d-flex rounded">
        <button class="view-toggle-btn left-btn ${!isChronologicalView ? 'active' : ''}" onclick="toggleViewMode(false)">Grouped</button>
        <button class="view-toggle-btn right-btn ${isChronologicalView ? 'active' : ''}" onclick="toggleViewMode(true)">Chronological</button>
      </div>
    `;
}

window.toggleViewMode = function (toChronological) {
  if (isChronologicalView === toChronological) return;
  isChronologicalView = toChronological;
  buildSchedule();
}

function setSeries(s) {
  activeSeries = s;
  if (s !== 'All') isChronologicalView = false;
  buildSchedule();
}

function getFilteredEvents() {
  const events = getEvents(activeYear);
  return activeSeries === 'All' ? events : events.filter(e => e.series === activeSeries);
}

// ============================================================
//  SCHEDULE — Event list
// ============================================================
function selectEvent(id) {
  activeEventId = id;
  const events = getFilteredEvents();
  buildTimeline(getEvents(activeYear), getActiveOrNextEvents(getEvents(activeYear))[0]);
  buildEventsList(events);
  scrollTimelineToActive();

  // Scroll to event block
  setTimeout(() => {
    isProgrammaticScroll = true;
    if (programmaticScrollTimeout) clearTimeout(programmaticScrollTimeout);

    let el = document.getElementById('event-' + id);
    if (!el) {
      const ev = events.find(e => e.id === id);
      if (ev) el = document.querySelector(`.event-group[data-date="${ev.date}"]`);
    }

    if (el) {
      let offset = 160;
      const rootStyles = getComputedStyle(document.documentElement);
      const dynamicOffset = rootStyles.getPropertyValue('--dynamic-scroll-offset');
      if (dynamicOffset) offset = parseInt(dynamicOffset);

      const y = el.getBoundingClientRect().top + window.scrollY;
      window.scrollTo({ top: y - offset - 40, behavior: 'smooth' });
    }

    programmaticScrollTimeout = setTimeout(() => {
      isProgrammaticScroll = false;
    }, 1000);
  }, 150);
}

function buildEventsList(events) {
  const container = document.getElementById('events-container');
  if (!events.length) {
    container.innerHTML = `<div class="no-events">No events for this selection.</div>`;
    return;
  }

  if (isChronologicalView && activeSeries === 'All') {
    // Flatten all sessions
    let allSessions = [];
    events.forEach(ev => {
      ev.sessions.forEach(s => {
        allSessions.push({
          ...s,
          evName: ev.name,
          evSeries: ev.series,
          evLocation: ev.location,
          evId: ev.id
        });
      });
    });

    // Group by date
    const grouped = {};
    allSessions.forEach(s => {
      if (!grouped[s.date]) grouped[s.date] = [];
      grouped[s.date].push(s);
    });

    // Sort dates
    const sortedDates = Object.keys(grouped).sort();
    const pastDates = sortedDates.filter(d => isPast(d));
    const upcomingDates = sortedDates.filter(d => !isPast(d));

    const renderDateGroup = (date, idx) => {
      let daySessions = grouped[date];
      // Sort sessions by time
      daySessions.sort((a, b) => {
        if (a.time === "N.S." && b.time === "N.S.") return 0;
        if (a.time === "N.S.") return 1;
        if (b.time === "N.S.") return -1;
        return a.time.localeCompare(b.time);
      });

      const dDate = new Date(date + 'T00:00:00');
      const displayDate = dDate.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' });

      return `
          <div class="event-group fade-up fade-up-${Math.min(idx + 1, 5)}" data-date="${date}">
            <div class="date-group-header">
              <i class="bi bi-calendar-event me-2" style="color:var(--gulf-orange);"></i>${displayDate}
            </div>
            ${daySessions.map(s => sessionBlock(s, true)).join('')}
          </div>
        `;
    };

    let html = '';
    if (pastDates.length > 0) {
      html += `
          <div class="past-events-wrapper">
            <button class="past-events-toggle w-100" onclick="document.getElementById('past-events-chrono').classList.toggle('d-none'); this.classList.toggle('open')">
              <i class="bi bi-clock-history me-2"></i> Show Past Dates (<span class="past-count">${pastDates.length}</span>)
              <i class="bi bi-chevron-down ms-auto toggle-icon"></i>
            </button>
            <div id="past-events-chrono" class="d-none mt-4">
              ${pastDates.map((d, idx) => renderDateGroup(d, idx)).join('')}
            </div>
          </div>
        `;
    }

    html += upcomingDates.map((d, idx) => renderDateGroup(d, idx)).join('');
    container.innerHTML = html;

  } else {
    const pastEvents = events.filter(ev => isPast(ev.date));
    const upcomingEvents = events.filter(ev => !isPast(ev.date));

    const renderEvent = (ev, idx) => {
      const past = isPast(ev.date);

      // Calculate week boundaries
      const now = new Date();
      const day = now.getDay();
      const diff = now.getDate() - day + (day === 0 ? -6 : 1);
      const startOfWeek = new Date(now.setDate(diff));
      startOfWeek.setHours(0, 0, 0, 0);
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(endOfWeek.getDate() + 6);
      endOfWeek.setHours(23, 59, 59, 999);

      const evDate = new Date(ev.date + 'T00:00:00');
      const isThisWeek = evDate >= startOfWeek && evDate <= endOfWeek;
      const isHighlighted = isThisWeek || ev.id === activeEventId;

      // Calculate date range from sessions
      const sDates = ev.sessions.map(s => s.date).sort();
      const firstD = sDates[0];
      const lastD = sDates[sDates.length - 1];

      const fmtD = (dStr) => {
        const [y, m, d] = dStr.split('-');
        return `${d}-${m}-${y}`;
      };
      const dateRange = firstD === lastD ? fmtD(firstD) : `${fmtD(firstD)} - ${fmtD(lastD)}`;

      // Get series official link
      const officialLink = ev.seriesWebsite || ev.sessions.find(s => s.official)?.official;

      const isTripleCrown = (ev.series === 'F1' && ev.name === 'Monaco Grand Prix') ||
        (ev.series === 'IndyCar' && ev.name.includes('Indianapolis 500')) ||
        (ev.series === 'WEC' && ev.name === '24 Hours of Le Mans');

      return `
          <div class="event-group fade-up fade-up-${Math.min(idx + 1, 5)} ${isHighlighted ? 'highlighted-event' : ''}"
               id="event-${ev.id}" data-date="${ev.date}">
            ${isHighlighted ? '<div class="upcoming-label">UPCOMING EVENT</div>' : ''}
            <div class="event-group-header">
              <div>
                <div class="event-group-name">${isTripleCrown ? '👑 ' : ''}${ev.name}</div>
                <div class="event-group-location">
                  <i class="bi bi-geo-alt me-1"></i>${ev.location}
                  <span class="ms-2 opacity-75">&middot;</span>
                  <i class="bi bi-calendar3 me-1 ms-2"></i>${dateRange}
                  ${past ? '<span class="completed-badge ms-2">COMPLETED</span>' : ''}
                </div>
              </div>
              ${officialLink
          ? `<a href="${officialLink}" target="_blank" class="event-series-badge badge-${ev.series.toLowerCase()} text-decoration-none" title="View official ${ev.series} website">${ev.series} <i class="bi bi-box-arrow-up-right ms-1" style="font-size:0.5rem"></i></a>`
          : `<span class="event-series-badge badge-${ev.series.toLowerCase()}">${ev.series}</span>`
        }
            </div>
            ${ev.sessions.map(s => sessionBlock(s, false)).join('')}
          </div>
        `;
    };

    let html = '';
    if (pastEvents.length > 0) {
      html += `
          <div class="past-events-wrapper">
            <button class="past-events-toggle w-100" onclick="document.getElementById('past-events-grouped').classList.toggle('d-none'); this.classList.toggle('open')">
              <i class="bi bi-clock-history me-2"></i> Show Past Events (<span class="past-count">${pastEvents.length}</span>)
              <i class="bi bi-chevron-down ms-auto toggle-icon"></i>
            </button>
            <div id="past-events-grouped" class="d-none mt-4">
              ${pastEvents.map((ev, idx) => renderEvent(ev, idx)).join('')}
            </div>
          </div>
        `;
    }

    html += upcomingEvents.map((ev, idx) => renderEvent(ev, idx)).join('');
    container.innerHTML = html;
  }
}

function sessionBlock(s, isChronological = false) {
  const now = new Date();
  const isActive = s.startTimeISO && s.endTimeISO && now >= new Date(s.startTimeISO) && now < new Date(s.endTimeISO);
  const links = [];
  // if (s.official) links.push(`<a href="${s.official}" target="_blank" class="session-link"><i class="bi bi-globe2 me-1"></i>Official</a>`);
  if (s.broadcaster) links.push(`<a href="#" class="session-link"><i class="bi bi-tv me-1"></i>${s.broadcaster}</a>`);

  // Format YYYY-MM-DD to DD/MM/YYYY
  const [yr, mo, da] = s.date.split('-');
  let dateDisplay = `${da}/${mo}/${yr}`;

  if (s.isMultiDay) {
    if (s.endDayMonth === mo) {
      dateDisplay = `${da}-${s.endDay}/${mo}/${yr}`;
    } else {
      dateDisplay = `${da}/${mo} - ${s.endDay}/${s.endDayMonth}/${yr}`;
    }
  }

  return `
      <div class="session-block ${isActive ? 'is-active' : ''}">
        <div class="session-block-color ${s.code}"></div>
        <div class="session-block-body">
          ${isActive ? '<span class="live-tag-sm">LIVE</span>' : ''}
          ${isChronological ? `<span class="event-series-badge ms-0 badge-${s.evSeries.toLowerCase()}">${s.evSeries}</span>` : ''}
          <div class="session-type">
            ${s.type}
            ${isChronological ? `<div style="font-size:0.65rem; color:var(--text-muted); font-family:'Space Mono', monospace; text-transform:uppercase; margin-top:2px;" class="session-event-name-wrap"><span class="session-event-name">${s.evName}</span> &middot; ${s.evLocation}</div>` : ''}
          </div>
          <div class="session-time mono d-flex align-items-center gap-3 ms-auto">
            <div><i class="bi bi-clock me-1"></i>${dateDisplay} &nbsp;<strong>${s.time}${s.endTimeFormatted ? ' — ' + s.endTimeFormatted : ''}</strong></div>
          </div>
          ${links.length ? `<div class="session-links">${links.join('')}</div>` : ''}
        </div>
      </div>
    `;
}

// ============================================================
//  DEEP LINKING & NAVIGATION
// ============================================================
window.goToScheduleAndScroll = function (eventId) {
  // Check if we are already on schedule
  const hashRaw = window.location.hash.replace('#', '');
  const [sectionPart] = hashRaw.split('?');

  if (sectionPart !== 'schedule') {
    showSection('schedule');
  }
  history.pushState(null, '', '#schedule?eventId=' + eventId);

  // selectEvent rebuilds the layout, sets the active style, and scrolls down
  selectEvent(eventId);
};

// ============================================================
//  HOME — This Week
// ============================================================
function buildThisWeek() {
  const wrap = document.getElementById('home-this-week-grid');
  if (!wrap) return;

  const now = new Date();
  const day = now.getDay() || 7;
  if (day !== 1) {
    now.setHours(-24 * (day - 1));
  }
  const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(endOfWeek.getDate() + 6);
  endOfWeek.setHours(23, 59, 59, 999);

  let weekEvents = [];
  Object.values(SCHEDULE_DATA).forEach(yearEvents => {
    yearEvents.forEach(ev => {
      const evDate = new Date(ev.date + 'T00:00:00');
      if (evDate >= startOfWeek && evDate <= endOfWeek) {
        weekEvents.push(ev);
      }
    });
  });

  if (weekEvents.length === 0) {
    wrap.innerHTML = `<div class="no-events w-100 text-center" style="grid-column:1/-1">No motorsport events scheduled for this week.</div>`;
    return;
  }

  weekEvents.sort((a, b) => new Date(a.date) - new Date(b.date));

  wrap.innerHTML = weekEvents.map((ev, idx) => `
      <article class="api-news-card fade-up fade-up-${Math.min(idx + 1, 5)}" style="cursor:pointer;" onclick="showSection('schedule'); goToScheduleAndScroll('${ev.id}')">
          <div class="api-news-body d-flex flex-column justify-content-center h-100" style="padding: 1.5rem;">
              <div>
                  <span class="event-series-badge ms-0 badge-${ev.series.toLowerCase()} mb-3 d-inline-block">${ev.series}</span>
              </div>
              <h3 class="api-news-title">${ev.name}</h3>
              <div class="api-news-meta mt-auto pt-3">
                  <span class="api-news-source"><i class="bi bi-geo-alt me-1"></i>${ev.location}</span>
                  <span class="api-news-date"><i class="bi bi-calendar3 me-1"></i>${fmtShort(ev.date)}</span>
              </div>
          </div>
      </article>
    `).join('');
}

// ============================================================
//  SCHEDULE — Main build
// ============================================================
function buildSchedule() {
  const events = getEvents(activeYear);
  const activeOrNext = getActiveOrNextEvents(events);
  buildSeriesTabs(events);
  buildThisWeek();
  buildTimeline(events, activeOrNext[0]);
  buildNextEventHero(activeOrNext);
  buildEventsList(getFilteredEvents());

  if (window.triggerScheduleSearch) window.triggerScheduleSearch();

  // Auto-scroll timeline to active if section is visible
  const schedSection = document.getElementById('schedule');
  if (schedSection && schedSection.style.display !== 'none') {
    setTimeout(scrollTimelineToActive, 150);
  }
}

// ============================================================
//  INIT
// ============================================================
function initScheduleSearch() {
  const inputs = document.querySelectorAll('#api-schedule-search-desktop, #api-schedule-search-mobile');
  const clearBtns = document.querySelectorAll('.api-schedule-search-clear');
  const navContainers = document.querySelectorAll('.schedule-search-nav-container');
  const searchCounts = document.querySelectorAll('.schedule-search-count');

  if (inputs.length === 0) return;

  let matchElements = [];
  let currentMatchIdx = -1;

  window.navigateScheduleSearch = (direction) => {
    if (matchElements.length === 0) return;
    currentMatchIdx += direction;
    if (currentMatchIdx < 0) currentMatchIdx = matchElements.length - 1;
    if (currentMatchIdx >= matchElements.length) currentMatchIdx = 0;

    updateSearchUI();
    scrollToMatch(matchElements[currentMatchIdx]);
  };

  const updateSearchUI = () => {
    if (matchElements.length > 1) {
      navContainers.forEach(nc => {
        nc.classList.remove('d-none');
        nc.classList.add('d-flex');
      });
      searchCounts.forEach(sc => {
        sc.textContent = `${currentMatchIdx + 1}/${matchElements.length}`;
      });
    } else {
      navContainers.forEach(nc => {
        nc.classList.add('d-none');
        nc.classList.remove('d-flex');
      });
    }
  };

  const scrollToMatch = (el) => {
    // Check if inside a past events container and open it if necessary
    const pastContainer = el.closest('#past-events-chrono, #past-events-grouped');
    if (pastContainer && pastContainer.classList.contains('d-none')) {
      pastContainer.classList.remove('d-none');
      const wrapper = pastContainer.closest('.past-events-wrapper');
      if (wrapper) {
        const toggleBtn = wrapper.querySelector('.past-events-toggle');
        if (toggleBtn) toggleBtn.classList.add('open');
      }
    }

    document.querySelectorAll('.search-highlight').forEach(e => e.classList.remove('search-highlight'));
    el.classList.add('search-highlight');

    let offset = 220;
    const rootStyles = getComputedStyle(document.documentElement);
    const dynamicOffset = rootStyles.getPropertyValue('--dynamic-scroll-offset');
    if (dynamicOffset) offset = parseInt(dynamicOffset) + 120;

    const y = el.getBoundingClientRect().top + window.scrollY;
    window.scrollTo({ top: y - offset, behavior: 'smooth' });
  };

  window.triggerScheduleSearch = () => {
    inputs[0].dispatchEvent(new Event('input'));
  };

  const filterSchedule = (query) => {
    const isChrono = isChronologicalView && activeSeries === 'All';
    matchElements = [];

    if (isChrono) {
      const groups = document.querySelectorAll('#events-container .event-group');
      groups.forEach(group => {
        let hasVisible = false;
        const sessions = group.querySelectorAll('.session-block');
        sessions.forEach(session => {
          const nameEl = session.querySelector('.session-event-name');
          if (nameEl) {
            if (nameEl.textContent.toLowerCase().includes(query)) {
              session.style.display = '';
              hasVisible = true;
              if (query !== "") matchElements.push(session);
            } else {
              session.style.display = 'none';
            }
          } else {
            session.style.display = query === '' ? '' : 'none';
          }
        });
        group.style.display = hasVisible || query === '' ? '' : 'none';
      });
    } else {
      const groups = document.querySelectorAll('#events-container .event-group');
      groups.forEach(group => {
        const nameEl = group.querySelector('.event-group-name');
        if (nameEl) {
          if (nameEl.textContent.toLowerCase().includes(query)) {
            group.style.display = '';
            if (query !== "") matchElements.push(group);
          } else {
            group.style.display = 'none';
          }
        }
      });
    }

    if (query === "") {
      currentMatchIdx = -1;
      document.querySelectorAll('.search-highlight').forEach(e => e.classList.remove('search-highlight'));
      updateSearchUI();
    } else if (matchElements.length > 0) {
      const pastChrono = document.getElementById('past-events-chrono');
      const pastGrouped = document.getElementById('past-events-grouped');
      const pastOpen = (pastChrono && !pastChrono.classList.contains('d-none')) ||
        (pastGrouped && !pastGrouped.classList.contains('d-none'));

      if (pastOpen) {
        currentMatchIdx = 0;
      } else {
        currentMatchIdx = matchElements.findIndex(el => !el.closest('#past-events-chrono, #past-events-grouped'));
        if (currentMatchIdx === -1) currentMatchIdx = 0;
      }

      updateSearchUI();
      scrollToMatch(matchElements[currentMatchIdx]);
    } else {
      currentMatchIdx = -1;
      updateSearchUI();
    }
  };

  inputs.forEach(input => {
    input.addEventListener('input', (e) => {
      const query = e.target.value.toLowerCase();
      // Sync other inputs
      inputs.forEach(i => { if (i !== e.target) i.value = e.target.value; });

      clearBtns.forEach(btn => {
        btn.style.display = query !== "" ? "block" : "none";
      });
      filterSchedule(query);
    });
  });

  clearBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      inputs.forEach(i => i.value = "");
      clearBtns.forEach(b => b.style.display = "none");
      filterSchedule("");
    });
  });

  const searchCollapse = document.getElementById('searchCollapse');
  if (searchCollapse) {
    searchCollapse.addEventListener('shown.bs.collapse', () => {
      const mobInput = document.getElementById('api-schedule-search-mobile');
      if (mobInput) mobInput.focus();
    });
  }
}

function initNewsSearch() {
  const searchInput = document.getElementById('api-news-search');
  const clearBtn = document.getElementById('api-news-search-clear');
  if (!searchInput) return;

  // Filter function
  const filterNews = (query) => {
    currentNewsQuery = query;
    currentNewsPage = 1;
    renderPaginatedNews();
  };

  // On input, filter and toggle clear button
  searchInput.addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase();

    if (clearBtn) {
      clearBtn.style.display = query.length > 0 ? 'block' : 'none';
    }

    filterNews(query);
  });

  // On clear button click, clear input and filter
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      searchInput.value = '';
      clearBtn.style.display = 'none';
      filterNews('');
      searchInput.focus();
    });
  }
}

function initStickyBehavior() {
  const navbarHeight = 56;

  // 1. Schedule Sticky Bar
  const scheduleSentinel = document.getElementById('schedule-sticky-sentinel');
  const scheduleStickyBar = document.getElementById('schedule-sticky-bar');

  if (scheduleSentinel && scheduleStickyBar) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting && entry.boundingClientRect.top < navbarHeight) {
          scheduleStickyBar.classList.add('is-locked');
        } else {
          scheduleStickyBar.classList.remove('is-locked');
        }
      });
    }, {
      rootMargin: `-${navbarHeight}px 0px 0px 0px`,
      threshold: 0
    });
    observer.observe(scheduleSentinel);

    const resizeObserver = new ResizeObserver(() => {
      const stickyHeight = scheduleStickyBar.offsetHeight;
      const totalOffset = navbarHeight + stickyHeight + 20;
      document.documentElement.style.setProperty('--dynamic-scroll-offset', `${totalOffset}px`);
    });
    resizeObserver.observe(scheduleStickyBar);
  }

  // 2. News Sticky Bar
  const newsSentinel = document.getElementById('news-sticky-sentinel');
  const newsStickyBar = document.getElementById('news-sticky-bar');

  if (newsSentinel && newsStickyBar) {
    const newsObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting && entry.boundingClientRect.top < navbarHeight) {
          newsStickyBar.classList.add('is-locked');
        } else {
          newsStickyBar.classList.remove('is-locked');
        }
      });
    }, {
      rootMargin: `-${navbarHeight}px 0px 0px 0px`,
      threshold: 0
    });
    newsObserver.observe(newsSentinel);
  }
}

async function init() {
  initStickyBehavior();
  initTimelineScrollSpy();
  initNewsSearch();
  initScheduleSearch();

  const loadingOverlay = document.getElementById('loadingOverlay');
  const contentContainer = document.getElementById('content');
  const errorContainer = document.getElementById('errorContainer');
  const errorMessage = document.getElementById('errorMessage');

  try {
    await loadData();

    // Deep Linking: parse the event ID from the URL hash query string
    const hashRaw = window.location.hash.replace('#', '');
    const [sectionPart, queryString] = hashRaw.split('?');
    if (queryString) {
      const params = new URLSearchParams(queryString);
      const urlEventId = params.get('eventId');
      if (urlEventId) {
        activeEventId = urlEventId; // Sets the default active event BEFORE building
      }
    }

    // News
    buildNewsFilters();
    loadExternalNews();

    // Schedule
    buildYearSelector();
    buildSchedule();

    // If opened directly via a deep link, force scroll into view after rendering
    if (sectionPart === 'schedule' && activeEventId) {
      setTimeout(() => {
        let el = document.getElementById('event-' + activeEventId);
        if (!el) {
          const events = getEvents(activeYear);
          const ev = events.find(e => e.id === activeEventId);
          if (ev) el = document.querySelector(`.event-group[data-date="${ev.date}"]`);
        }

        if (el) {
          let offset = 160;
          const rootStyles = getComputedStyle(document.documentElement);
          const dynamicOffset = rootStyles.getPropertyValue('--dynamic-scroll-offset');
          if (dynamicOffset) offset = parseInt(dynamicOffset);

          const y = el.getBoundingClientRect().top + window.scrollY;
          window.scrollTo({ top: y - offset - 40, behavior: 'smooth' });
        }
      }, 250); // slight delay to allow layout calculation
    }

    // Hide Loader & Show Content
    if (loadingOverlay) loadingOverlay.classList.add('hidden');
    if (contentContainer) contentContainer.classList.remove('d-none');
    setTimeout(() => {
      if (loadingOverlay) loadingOverlay.classList.add('d-none');
    }, 300);

    // Section toggle via hash
    if (sectionPart === 'schedule') showSection('schedule');
    else if (sectionPart === 'news') showSection('news');
    else showSection('home');

    // Nav link clicks toggle sections
    document.querySelectorAll('.rm-nav .nav-link[href^="#"]').forEach(link => {
      link.addEventListener('click', e => {
        const target = link.getAttribute('href').replace('#', '');
        if (['home', 'news', 'schedule'].includes(target)) {
          e.preventDefault();
          showSection(target);
          history.pushState(null, '', '#' + target);
        }
      });
    });

  } catch (e) {
    console.error("Initialization failed", e);
    if (loadingOverlay) loadingOverlay.classList.add('hidden');
    if (errorMessage) errorMessage.textContent = `Failed to load data: ${e.message}. Please refresh the page.`;
    if (errorContainer) errorContainer.classList.remove('d-none');
  }
}

document.addEventListener('DOMContentLoaded', init);
