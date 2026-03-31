
let NEWS_DATA = [];
let SCHEDULE_DATA = {};

async function loadData() {
  try {
    const cats_to_fetch = activeNewsFilter === 'All' ? ['f1', 'wec', 'wrc', 'fe', 'indycar', 'nls', 'gtwc', 'motogp'] : [activeNewsFilter.toLowerCase()];
    NEWS_DATA = [];
    for (const cat of cats_to_fetch) {
      try {
        const res = await fetch(`data/news/${cat}.json`);
        if (res.ok) {
          const catData = await res.json();
          NEWS_DATA.push(...catData);
        }
      } catch (e) {
        console.warn('Could not load news for ' + cat);
      }
    }
    
    // Sort news by date descending
    NEWS_DATA.sort((a,b) => new Date(b.date) - new Date(a.date));

    // Load schedule
    SCHEDULE_DATA[activeYear] = [];
    const seriesList = ['f1', 'wec', 'wrc', 'fe', 'indycar', 'nls', 'gtwc', 'motogp'];
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

// Intercept buildNewsFilters, setNewsFilter, setYear, init page
async function initPage() {
    await loadData();
    buildNewsFilters();
    buildNewsGrid();
    buildTimeline();
}

// Modify setNewsFilter and setYear to async
window.setNewsFilter = async function(cat) {
    activeNewsFilter = cat;
    await loadData();
    buildNewsFilters();
    buildNewsGrid();
}

window.setYear = async function(yr) {
    activeYear = yr;
    await loadData();
    document.querySelectorAll('.year-btn').forEach(btn => {
      btn.classList.toggle('active', parseInt(btn.innerText) === yr);
    });
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

  const NEWS_CATEGORIES = ["All", "F1", "WEC", "WRC", "FE", "IndyCar", "NLS", "GTWC", "MotoGP"];
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

  window.setNewsFilterOriginal = function(cat) {
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
      ${[0,1,2,3,4].map(i =>
        `<line x1="${-20 + i*60}" y1="0" x2="${40 + i*60}" y2="150"
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
      <article class="news-card fade-up fade-up-${Math.min(idx+1,5)}">
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
    wrap.innerHTML = `<span class="section-label mb-0" style="margin-bottom:0!important">Season:</span>` +
      YEARS.map(y =>
        `<button class="year-btn ${y === activeYear ? 'active' : ''}"
                 onclick="setYear(${y})">${y}</button>`
      ).join('');
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
      return;
    }

    const nextSession = event.sessions.find(s => {
      if (s.time === "TBC") {
        const dt = new Date(s.date + 'T23:59:59');
        return dt > new Date();
      }
      const dt = new Date(s.date + 'T' + s.time + ':00');
      return dt > new Date();
    }) || event.sessions[event.sessions.length - 1];

    hero.innerHTML = `
      <div class="row gy-3 align-items-center">
        <div class="col-md-7">
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
        <div class="col-md-5">
          <div class="section-label">Countdown to ${nextSession.type}</div>
          <div class="countdown-wrap mt-1" id="countdown-wrap"></div>
        </div>
      </div>
    `;

    // Start countdown
    if (countdownInterval) clearInterval(countdownInterval);
    const wrap = document.getElementById('countdown-wrap');

    if (nextSession.time === "TBC") {
      wrap.innerHTML = `<span class="section-label" style="color:var(--text-muted)">TIME TBC</span>`;
      return;
    }

    const target = new Date(nextSession.date + 'T' + nextSession.time + ':00');
    function tick() {
      const now = new Date();
      const diff = target - now;
      if (!wrap) return;
      if (diff <= 0) {
        wrap.innerHTML = `<span class="section-label" style="color:var(--ferrari-red)">LIVE NOW</span>`;
        clearInterval(countdownInterval);
        return;
      }
      const days  = Math.floor(diff / 86400000);
      const hours = Math.floor((diff % 86400000) / 3600000);
      const mins  = Math.floor((diff % 3600000) / 60000);
      const secs  = Math.floor((diff % 60000) / 1000);
      wrap.innerHTML = `
        <div class="countdown-unit"><span class="countdown-num">${String(days).padStart(2,'0')}</span><span class="countdown-label">Days</span></div>
        <div class="countdown-sep">:</div>
        <div class="countdown-unit"><span class="countdown-num">${String(hours).padStart(2,'0')}</span><span class="countdown-label">Hrs</span></div>
        <div class="countdown-sep">:</div>
        <div class="countdown-unit"><span class="countdown-num">${String(mins).padStart(2,'0')}</span><span class="countdown-label">Min</span></div>
        <div class="countdown-sep">:</div>
        <div class="countdown-unit"><span class="countdown-num">${String(secs).padStart(2,'0')}</span><span class="countdown-label">Sec</span></div>
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
    scroll.innerHTML = events.map(ev => {
      const past = isPast(ev.date);
      const isNext = ev.id === (nextEvent && nextEvent.id);
      return `<button
        class="timeline-date-btn ${past ? 'past' : ''} ${isNext ? 'next-indicator' : ''} ${activeEventId === ev.id ? 'active' : ''}"
        onclick="selectEvent('${ev.id}')"
        data-event-id="${ev.id}"
        id="tl-${ev.id}">
          <span class="tl-month">${getMonthShort(ev.date)}</span>
          <span class="tl-day">${getDay(ev.date)}</span>
          <span class="tl-event">${ev.series}</span>
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

  // ============================================================
  //  SCHEDULE — Series tabs
  // ============================================================
  function buildSeriesTabs(events) {
    const series = getSeries(events);
    const wrap = document.getElementById('series-tabs');
    wrap.innerHTML = series.map(s =>
      `<button class="series-tab ${s === activeSeries ? 'active' : ''}"
               onclick="setSeries('${s}')">${s}</button>`
    ).join('');
  }

  function setSeries(s) {
    activeSeries = s;
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
      const el = document.getElementById('event-' + id);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  }

  function buildEventsList(events) {
    const container = document.getElementById('events-container');
    if (!events.length) {
      container.innerHTML = `<div class="no-events">No events for this selection.</div>`;
      return;
    }

    container.innerHTML = events.map((ev, idx) => {
      const past = isPast(ev.date);
      const isHighlighted = ev.id === activeEventId;
      return `
        <div class="event-group fade-up fade-up-${Math.min(idx+1,5)} ${isHighlighted ? 'highlighted-event' : ''}"
             id="event-${ev.id}" style="${isHighlighted ? 'outline:2px solid var(--gulf-orange);outline-offset:4px;border-radius:3px;' : ''}">
          <div class="event-group-header">
            <div>
              <div class="event-group-name">${ev.name}</div>
              <div class="event-group-location">
                <i class="bi bi-geo-alt me-1"></i>${ev.location}
                ${past ? '<span class="ms-2" style="color:var(--text-muted);font-size:0.65rem;">COMPLETED</span>' : ''}
              </div>
            </div>
            <span class="event-series-badge badge-${ev.series.toLowerCase()}">${ev.series}</span>
          </div>
          ${ev.sessions.map(s => sessionBlock(s)).join('')}
        </div>
      `;
    }).join('');
  }

  function sessionBlock(s) {
    const links = [];
    if (s.official) links.push(`<a href="${s.official}" target="_blank" class="session-link"><i class="bi bi-globe2 me-1"></i>Official</a>`);
    if (s.broadcaster) links.push(`<a href="#" class="session-link"><i class="bi bi-tv me-1"></i>${s.broadcaster}</a>`);
    
    // Format YYYY-MM-DD to DD-MM-YYYY
    const [yr, mo, da] = s.date.split('-');
    const formattedDate = `${da}-${mo}-${yr}`;

    return `
      <div class="session-block">
        <div class="session-block-color ${s.code}"></div>
        <div class="session-block-body">
          <div class="session-type">${s.type}</div>
          <div class="session-time mono"><i class="bi bi-clock me-1"></i>${formattedDate} &nbsp;<strong>${s.time}</strong></div>
          ${links.length ? `<div class="session-links">${links.join('')}</div>` : ''}
        </div>
      </div>
    `;
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
    buildTimeline(events, nextEvent);
    buildSeriesTabs(events);
    buildEventsList(filtered);

    // Auto-scroll timeline to next
    setTimeout(scrollTimelineToActive, 150);
  }

  // ============================================================
  //  INIT
  // ============================================================
  async function init() {
    await loadData();
    // News
    buildNewsFilters();
    buildNewsGrid();

    // Schedule
    buildYearSelector();
    buildSchedule();

    // Section toggle via hash
    const hash = window.location.hash.replace('#', '');
    if (hash === 'schedule') showSection('schedule');
    else showSection('news');

    // Nav link clicks toggle sections
    document.querySelectorAll('.rm-nav .nav-link[href^="#"]').forEach(link => {
      link.addEventListener('click', e => {
        const target = link.getAttribute('href').replace('#', '');
        if (['news', 'schedule'].includes(target)) {
          e.preventDefault();
          showSection(target);
          history.pushState(null, '', '#' + target);
        }
      });
    });
  }

  document.addEventListener('DOMContentLoaded', init);
