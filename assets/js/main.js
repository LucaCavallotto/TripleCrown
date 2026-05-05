
let NEWS_DATA = [];
let SCHEDULE_DATA = {};

async function loadData() {
  try {
    // Load schedule
    SCHEDULE_DATA[activeYear] = [];
    const seriesList = ['f1', 'wec', 'wrc', 'fe', 'indycar', 'nascar', 'igtc', 'nls', 'gtwc', 'motogp'];
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
              if (rSesh.start_time && rSesh.start_time !== "TBC") {
                rDateObj = new Date(rSesh.start_time);
              }
              const pad = n => String(n).padStart(2, '0');
              const eDateStr = `${rDateObj.getFullYear()}-${pad(rDateObj.getMonth() + 1)}-${pad(rDateObj.getDate())}`;

              return {
                id: calItem.id,
                date: eDateStr,
                series: seriesName,
                name: calItem.event_name,
                location: calItem.location,
                sessions: calItem.sessions.map(sesh => {
                  let lDate = "";
                  let lTime = "";
                  if (sesh.start_time === "TBC" || !sesh.start_time) {
                    const dStr = sesh.date_tbc || calItem.event_end_date;
                    const d = new Date(dStr);
                    lDate = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
                    lTime = "TBC";
                  } else {
                    const d = new Date(sesh.start_time);
                    lDate = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
                    lTime = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
                  }
                  let cssCode = sesh.code ? sesh.code.toLowerCase() : 'u';
                  if (cssCode.startsWith('fp')) cssCode = 'fp';

                  return {
                    code: cssCode,
                    type: sesh.type,
                    date: lDate,
                    time: lTime,
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

    // Sort by date descending
    allNews.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));

    if (allNews.length === 0) {
      grid.innerHTML = `<div class="no-events w-100 text-center" style="grid-column:1/-1">No news found.</div>`;
      return;
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

    grid.innerHTML = renderCards(allNews);

    const homeGrid = document.getElementById('home-news-grid');
    if (homeGrid) {
      homeGrid.innerHTML = renderCards(allNews.slice(0, 6));
    }
  } catch (e) {
    console.error("Failed to fetch or parse data.json:", e);
    const errorHtml = `<div class="no-events w-100 text-center" style="grid-column:1/-1;color:var(--bs-danger);">Error loading news: ${e.message}</div>`;
    grid.innerHTML = errorHtml;
    const homeGrid = document.getElementById('home-news-grid');
    if (homeGrid) homeGrid.innerHTML = errorHtml;
  }
}

async function initPage() {
  await loadData();
  loadExternalNews();
  buildTimeline();
}

// Modify setNewsFilter and setYear to async
window.setNewsFilter = async function (cat) {
  activeNewsFilter = cat;
  await loadData();
  buildNewsFilters();
  buildNewsGrid();
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
let activeNewsFilter = "All";
let activeYear = 2026;
let activeSeries = "All";
let activeEventId = null;
let countdownInterval = null;
let isChronologicalView = false;
let isProgrammaticScroll = false;
let programmaticScrollTimeout = null;

const NEWS_CATEGORIES = ["All", "F1", "WEC", "WRC", "FE", "IndyCar", "NASCAR", "IGTC", "NLS", "GTWC", "MotoGP"];
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

function getNextEvent(events) {
  const now = new Date();
  return events.find(e => new Date(e.date + 'T23:59:59') >= now) || events[events.length - 1];
}

function getUniqueEventDates(events) {
  return [...new Set(events.map(e => e.date))];
}

function getSeries(events) {
  return ['All', ...new Set(events.map(e => e.series))];
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
function buildNextEventHero(event) {
  const hero = document.getElementById('next-event-hero');
  if (!event) {
    hero.innerHTML = `<p class="no-events">No upcoming events found.</p>`;
    hero.onclick = null;
    hero.classList.remove('hero-clickable');
    hero.removeAttribute('role');
    hero.removeAttribute('tabindex');
    hero.removeAttribute('title');
    return;
  }

  // Make the entire hero container clickable
  hero.classList.add('hero-clickable');
  hero.setAttribute('role', 'button');
  hero.setAttribute('tabindex', '0');
  hero.setAttribute('title', 'Go to Event Schedule');
  hero.onclick = () => goToScheduleAndScroll(event.id);

  const nextSession = event.sessions.find(s => {
    if (s.time === "TBC") {
      const dt = new Date(s.date + 'T23:59:59');
      return dt > new Date();
    }
    const dt = new Date(s.date + 'T' + s.time + ':00');
    return dt > new Date();
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
          <div class="section-label">Countdown to ${nextSession.type}</div>
          <div class="countdown-wrap mt-1" id="countdown-wrap"></div>
        </div>
      </div>
      <div class="hero-cta">
        View Full Schedule <i class="bi bi-arrow-right"></i>
      </div>
    `;

  // Start countdown
  if (countdownInterval) clearInterval(countdownInterval);
  const wrap = document.getElementById('countdown-wrap');

  const targetStr = nextSession.time === "TBC" ? (nextSession.date + 'T00:00:00') : (nextSession.date + 'T' + nextSession.time + ':00');
  const target = new Date(targetStr);

  function tick() {
    const now = new Date();
    const diff = target - now;
    if (!wrap) return;

    if (diff <= 0) {
      if (nextSession.time === "TBC") {
        wrap.innerHTML = `<span class="section-label" style="color:var(--text-muted)">TODAY (TIME TBC)</span>`;
      } else {
        wrap.innerHTML = `<span class="section-label" style="color:var(--ferrari-red)">LIVE NOW</span>`;
      }
      clearInterval(countdownInterval);
      return;
    }
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
  const next = getNextEvent(events);
  if (next) selectEvent(next.id);
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
  buildTimeline(getEvents(activeYear), getNextEvent(getEvents(activeYear)));
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
        if (a.time === "TBC" && b.time === "TBC") return 0;
        if (a.time === "TBC") return 1;
        if (b.time === "TBC") return -1;
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
      const officialLink = ev.sessions.find(s => s.official)?.official;

      return `
          <div class="event-group fade-up fade-up-${Math.min(idx + 1, 5)} ${isHighlighted ? 'highlighted-event' : ''}"
               id="event-${ev.id}" data-date="${ev.date}">
            ${isHighlighted ? '<div class="upcoming-label">UPCOMING EVENT</div>' : ''}
            <div class="event-group-header">
              <div>
                <div class="event-group-name">${ev.name}</div>
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
  const links = [];
  // if (s.official) links.push(`<a href="${s.official}" target="_blank" class="session-link"><i class="bi bi-globe2 me-1"></i>Official</a>`);
  if (s.broadcaster) links.push(`<a href="#" class="session-link"><i class="bi bi-tv me-1"></i>${s.broadcaster}</a>`);

  // Format YYYY-MM-DD to DD-MM-YYYY
  const [yr, mo, da] = s.date.split('-');
  const formattedDate = `${da}-${mo}-${yr}`;

  return `
      <div class="session-block">
        <div class="session-block-color ${s.code}"></div>
        <div class="session-block-body">
          ${isChronological ? `<span class="event-series-badge ms-0 badge-${s.evSeries.toLowerCase()}">${s.evSeries}</span>` : ''}
          <div class="session-type">
            ${s.type}
            ${isChronological ? `<div style="font-size:0.65rem; color:var(--text-muted); font-family:'Space Mono', monospace; text-transform:uppercase; margin-top:2px;" class="session-event-name-wrap"><span class="session-event-name">${s.evName}</span> &middot; ${s.evLocation}</div>` : ''}
          </div>
          <div class="session-time mono d-flex align-items-center gap-3 ms-auto">
            <div><i class="bi bi-clock me-1"></i>${formattedDate} &nbsp;<strong>${s.time}</strong></div>
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
  const filtered = getFilteredEvents();
  const nextEvent = getNextEvent(events);

  if (!activeEventId) activeEventId = nextEvent ? nextEvent.id : null;

  buildNextEventHero(nextEvent);
  buildThisWeek();
  buildTimeline(events, nextEvent);
  buildSeriesTabs(events);
  buildEventsList(filtered);

  if (window.triggerScheduleSearch) window.triggerScheduleSearch();

  // Auto-scroll timeline to next
  setTimeout(scrollTimelineToActive, 150);
}

// ============================================================
//  INIT
// ============================================================
function initScheduleSearch() {
  const searchInput = document.getElementById('api-schedule-search');
  const clearBtn = document.getElementById('api-schedule-search-clear');

  if (!searchInput) return;

  // We expose a global trigger so buildSchedule() can re-apply the filter after DOM rebuilds
  window.triggerScheduleSearch = () => {
    searchInput.dispatchEvent(new Event('input'));
  };

  const filterSchedule = (query) => {
    const isChrono = isChronologicalView && activeSeries === 'All';

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
            } else {
              session.style.display = 'none';
            }
          } else {
            // If title doesn't exist, we just show it if query is empty
            session.style.display = query === '' ? '' : 'none';
          }
        });
        group.style.display = hasVisible ? '' : 'none';
      });
    } else {
      const groups = document.querySelectorAll('#events-container .event-group');
      groups.forEach(group => {
        const nameEl = group.querySelector('.event-group-name');
        if (nameEl) {
          if (nameEl.textContent.toLowerCase().includes(query)) {
            group.style.display = '';
          } else {
            group.style.display = 'none';
          }
        }
      });
    }
  };

  searchInput.addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase();
    if (clearBtn) {
      clearBtn.style.display = query.length > 0 ? 'block' : 'none';
    }
    filterSchedule(query);
  });

  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      searchInput.value = '';
      clearBtn.style.display = 'none';
      filterSchedule('');
      searchInput.focus();
    });
  }
}

function initNewsSearch() {
  const searchInput = document.getElementById('api-news-search');
  const clearBtn = document.getElementById('api-news-search-clear');
  const newsGrid = document.getElementById('news-grid');
  if (!searchInput || !newsGrid) return;

  // Filter function
  const filterNews = (query) => {
    const cards = newsGrid.querySelectorAll('.api-news-card');
    cards.forEach(card => {
      const titleEl = card.querySelector('.api-news-title');
      if (titleEl) {
        const titleText = titleEl.textContent.toLowerCase();
        if (titleText.includes(query)) {
          card.style.display = '';
        } else {
          card.style.display = 'none';
        }
      }
    });
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
  const sentinel = document.getElementById('schedule-sticky-sentinel');
  const stickyBar = document.getElementById('schedule-sticky-bar');

  if (!sentinel || !stickyBar) return;

  // Exact height of the fixed navbar
  const navbarHeight = 56;

  // Create an Intersection Observer to watch the zero-height sentinel
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      // If the sentinel is scrolling up past the top of the navbar, 
      // we lock the sticky bar.
      if (!entry.isIntersecting && entry.boundingClientRect.top < navbarHeight) {
        stickyBar.classList.add('is-locked');
      } else {
        stickyBar.classList.remove('is-locked');
      }
    });
  }, {
    // Offset by the navbar height so it triggers exactly when it touches the navbar
    rootMargin: `-${navbarHeight}px 0px 0px 0px`,
    threshold: 0
  });

  observer.observe(sentinel);

  // Track dynamic height of the sticky bar for accurate scroll-margins
  // This perfectly calculates whether the filter dropdown is open or closed!
  const resizeObserver = new ResizeObserver(() => {
    // Use offsetHeight since it factors in total element size (padding/borders)
    const stickyHeight = stickyBar.offsetHeight;
    // Add Navbar height + 20px padding buffer for visual breathing room
    const totalOffset = navbarHeight + stickyHeight + 20;

    // Pass this dynamic value directly to the CSS variable
    document.documentElement.style.setProperty('--dynamic-scroll-offset', `${totalOffset}px`);
  });

  resizeObserver.observe(stickyBar);
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
