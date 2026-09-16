/**
 * Child Death Review (CDR) & Maternal Death Review (MDR) Unified Dashboard
 * Across all 8 worksheets (2023-24, 2024-25, 2025-26, 2026-27)
 */

// Global Application State
const appState = {
  allData: { cdr: [], mdr: [], meta: {} },
  activeModule: 'CDR', // 'CDR' or 'MDR'
  activeYear: 'ALL',   // 'ALL', '2023-24', '2024-25', '2025-26', '2026-27'
  filteredData: [],
  currentPage: 1,
  pageSize: 12,
  temporalViews: {
    facility: 'monthly', // 'monthly' or 'yearly'
    area: 'monthly',
    district: 'yearly'
  },
  filters: {
    year: 'ALL',
    facility: 'ALL',
    areaCategory: 'ALL',
    district: 'ALL',
    ageGroup: 'ALL',
    causeCategory: 'ALL',
    // CDR specific
    sex: 'ALL',
    // MDR specific
    deathTiming: 'ALL',
    search: ''
  },
  charts: {}
};

const facilityColors = {
  'GMC': '#6366f1',
  'IGGMC': '#38bdf8',
  'DAGA': '#f59e0b',
  'NMC (Urban)': '#10b981',
  'Private Hospital': '#a855f7',
  'Home': '#ef4444'
};

const areaColors = {
  'NMC (Urban)': '#38bdf8',
  'Rural': '#10b981',
  'Other District': '#f97316',
  'Other State': '#ec4899'
};

const palette = {
  blue: '#38bdf8',
  indigo: '#6366f1',
  rose: '#f43f5e',
  amber: '#f59e0b',
  emerald: '#10b981',
  purple: '#a855f7',
  cyan: '#06b6d4',
  teal: '#14b8a6',
  orange: '#f97316'
};

document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  setupEventListeners();
  loadAllDatasets();
});

function initTheme() {
  const saved = localStorage.getItem('cdrmdr_theme') || 'dark';
  document.documentElement.setAttribute('data-theme', saved);
  updateThemeIcon(saved);
}

function toggleTheme() {
  const cur = document.documentElement.getAttribute('data-theme') || 'dark';
  const next = cur === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('cdrmdr_theme', next);
  updateThemeIcon(next);
  if (appState.filteredData.length > 0) renderAllCharts(appState.filteredData);
}

function updateThemeIcon(t) {
  const icon = document.getElementById('theme-icon');
  if (icon) icon.className = t === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
}

// Load unified dataset (local pre-compiled JSON + optional live sync)
async function loadAllDatasets() {
  showToast('Loading data from all 8 worksheets...', 'info');
  try {
    const res = await fetch('data/dataset_all.json');
    if (!res.ok) throw new Error('dataset_all.json could not be loaded');
    const data = await res.json();
    appState.allData = data;

    // Update counts on badges
    document.getElementById('tab-count-cdr').textContent = Number(data.meta.totalCdr).toLocaleString();
    document.getElementById('tab-count-mdr').textContent = Number(data.meta.totalMdr).toLocaleString();
    document.getElementById('sync-timestamp').textContent = `Loaded: ${data.meta.totalCdr + data.meta.totalMdr} Records across 8 Sheets`;

    switchModule(appState.activeModule);
    showToast(`Loaded ${data.meta.totalCdr} Child + ${data.meta.totalMdr} Maternal records successfully!`, 'success');
  } catch (err) {
    console.error('Load error:', err);
    showToast('Failed to load dataset: ' + err.message, 'error');
  }
}

function setupEventListeners() {
  document.getElementById('btn-theme-toggle').addEventListener('click', toggleTheme);
  document.getElementById('btn-sync-all-sheets').addEventListener('click', () => loadAllDatasets());
  document.getElementById('btn-export-csv').addEventListener('click', exportActiveViewToCsv);

  // Tab buttons (CDR vs MDR)
  document.getElementById('tab-btn-cdr').addEventListener('click', () => switchModule('CDR'));
  document.getElementById('tab-btn-mdr').addEventListener('click', () => switchModule('MDR'));

  // Year chips selector
  document.querySelectorAll('.year-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.year-chip').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      appState.activeYear = btn.getAttribute('data-year');
      appState.currentPage = 1;
      applyFilters();
    });
  });

  // Temporal toggle buttons (Monthly vs Yearly)
  setupTemporalToggle('toggle-facility-temporal', 'facility');
  setupTemporalToggle('toggle-area-temporal', 'area');
  setupTemporalToggle('toggle-district-temporal', 'district');

  // Modal handlers
  document.getElementById('modal-close-btn').addEventListener('click', closeModal);
  document.getElementById('case-modal').addEventListener('click', (e) => {
    if (e.target.id === 'case-modal') closeModal();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal();
  });

  // Pagination
  document.getElementById('btn-prev-page').addEventListener('click', () => {
    if (appState.currentPage > 1) {
      appState.currentPage--;
      renderTable();
    }
  });
  document.getElementById('btn-next-page').addEventListener('click', () => {
    const totalPages = Math.ceil(appState.filteredData.length / appState.pageSize) || 1;
    if (appState.currentPage < totalPages) {
      appState.currentPage++;
      renderTable();
    }
  });

  // Search input
  const sInput = document.getElementById('search-input');
  if (sInput) {
    sInput.addEventListener('input', debounce(() => {
      appState.filters.search = sInput.value.trim().toLowerCase();
      appState.currentPage = 1;
      applyFilters();
    }, 250));
  }
}

function setupTemporalToggle(containerId, chartKey) {
  const container = document.getElementById(containerId);
  if (!container) return;
  const buttons = container.querySelectorAll('.btn-temporal');
  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      buttons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      appState.temporalViews[chartKey] = btn.getAttribute('data-period');
      renderAllCharts(appState.filteredData);
    });
  });
}

// Switch between Child Death Review (CDR) and Maternal Death Review (MDR)
function switchModule(mod) {
  appState.activeModule = mod;
  appState.currentPage = 1;

  const cdrBtn = document.getElementById('tab-btn-cdr');
  const mdrBtn = document.getElementById('tab-btn-mdr');
  const distCardTitle = document.getElementById('chart-title-district');
  const distSub = document.getElementById('chart-sub-district');

  if (mod === 'CDR') {
    cdrBtn.classList.add('active');
    mdrBtn.classList.remove('active');
    document.getElementById('filter-module-label').textContent = 'CDR (Child Mortality) Surveillance Filters';
    document.getElementById('table-main-title').innerHTML = '<i class="fas fa-baby" style="color:var(--accent-blue); margin-right:6px;"></i> Child Death Review (CDR) Case Explorer';
    if (distCardTitle) distCardTitle.innerHTML = '<i class="fas fa-city" style="color:var(--accent-amber);"></i> Area & District Distribution (CDR)';
    if (distSub) distSub.textContent = 'Cases by residence location & district';
  } else {
    mdrBtn.classList.add('active');
    cdrBtn.classList.remove('active');
    document.getElementById('filter-module-label').textContent = 'MDR (Maternal Mortality) Surveillance Filters';
    document.getElementById('table-main-title').innerHTML = '<i class="fas fa-female" style="color:var(--accent-rose); margin-right:6px;"></i> Maternal Death Review (MDR) Case Explorer';
    if (distCardTitle) distCardTitle.innerHTML = '<i class="fas fa-city" style="color:var(--accent-amber);"></i> District Wise Case Distribution (MDR)';
    if (distSub) distSub.textContent = 'Maternal death distribution across Vidarbha, Maharashtra & Neighbouring States';
  }

  renderFilterControls();
  applyFilters();
}

// Render dynamic filter controls based on active module
function renderFilterControls() {
  const container = document.getElementById('filter-grid-container');
  const isCdr = appState.activeModule === 'CDR';

  container.innerHTML = `
    <!-- 1. Health Facility Filter -->
    <div class="filter-group">
      <label for="filter-facility"><i class="fas fa-hospital-alt"></i> Health Facility</label>
      <select id="filter-facility" class="filter-select">
        <option value="ALL">All Facilities (6 Types)</option>
        <option value="GMC">GMC (Govt Medical College)</option>
        <option value="IGGMC">IGGMC (Mayo Hospital)</option>
        <option value="DAGA">DAGA Memorial Hospital</option>
        <option value="NMC (Urban)">NMC (Urban UPHC/Zones)</option>
        <option value="Private Hospital">Private Hospitals / Nursing Homes</option>
        <option value="Home">Home Deaths</option>
      </select>
    </div>

    <!-- 2. Area Wise Filter -->
    <div class="filter-group">
      <label for="filter-area"><i class="fas fa-map-marked-alt"></i> Area Wise</label>
      <select id="filter-area" class="filter-select">
        <option value="ALL">All Areas (4 Categories)</option>
        <option value="NMC (Urban)">NMC (Urban)</option>
        <option value="Rural">Rural</option>
        <option value="Other District">Other District</option>
        <option value="Other State">Other State</option>
      </select>
    </div>

    <!-- 3. District Filter (Especially for MDR) -->
    <div class="filter-group">
      <label for="filter-district"><i class="fas fa-city"></i> District</label>
      <select id="filter-district" class="filter-select">
        <option value="ALL">All Districts</option>
        <option value="Nagpur">Nagpur</option>
        <option value="Chandrapur">Chandrapur</option>
        <option value="Amravati">Amravati</option>
        <option value="Bhandara">Bhandara</option>
        <option value="Gondia">Gondia</option>
        <option value="Yavatmal">Yavatmal</option>
        <option value="Gadchiroli">Gadchiroli</option>
        <option value="Akola">Akola</option>
        <option value="Washim">Washim</option>
        <option value="Chhindwara (MP)">Chhindwara (MP)</option>
        <option value="Seoni (MP)">Seoni (MP)</option>
        <option value="Balaghat (MP)">Balaghat (MP)</option>
      </select>
    </div>

    ${isCdr ? `
      <div class="filter-group">
        <label for="filter-gender"><i class="fas fa-venus-mars"></i> Child Gender</label>
        <select id="filter-gender" class="filter-select">
          <option value="ALL">All Genders</option>
          <option value="MALE">Male</option>
          <option value="FEMALE">Female</option>
        </select>
      </div>
    ` : `
      <div class="filter-group">
        <label for="filter-timing"><i class="fas fa-hourglass-half"></i> Demise Timing</label>
        <select id="filter-timing" class="filter-select">
          <option value="ALL">All Timings</option>
          <option value="Postpartum (PNC)">Postpartum (PNC)</option>
          <option value="Antepartum (ANC)">Antepartum (ANC)</option>
          <option value="Intrapartum (Delivery)">Intrapartum (Delivery)</option>
        </select>
      </div>
    `}

    <div class="filter-group">
      <label for="filter-cause"><i class="fas fa-stethoscope"></i> Clinical Cause</label>
      <select id="filter-cause" class="filter-select">
        <option value="ALL">All Causes</option>
        ${isCdr ? `
          <option value="Sepsis & Septic Shock">Sepsis & Septic Shock</option>
          <option value="Respiratory / RDS / Pneumonia">Respiratory / RDS / Pneumonia</option>
          <option value="Prematurity & Low Birth Weight">Prematurity & LBW</option>
          <option value="Congenital Anomalies & Heart Diseases">Congenital Anomalies & CHD</option>
          <option value="Birth Asphyxia & Aspiration">Birth Asphyxia & Aspiration</option>
          <option value="Infections & Illness">Infections & General Illness</option>
        ` : `
          <option value="Hemorrhage / PPH / Severe Anemia">Hemorrhage / PPH / Anemia</option>
          <option value="Hypertensive Disorders / Eclampsia">Eclampsia / Hypertension</option>
          <option value="Sepsis & Severe Infections">Sepsis & Severe Infections</option>
          <option value="Cardiac Failure & Heart Disease">Cardiac Failure & Heart Disease</option>
          <option value="Hepatic / Liver Disorders">Hepatic / Liver Disorders</option>
        `}
      </select>
    </div>

    <div class="filter-group">
      <button id="btn-reset-filters" class="btn-reset-filters" title="Clear active filters">
        <i class="fas fa-undo"></i> Reset Filters
      </button>
    </div>
  `;

  container.querySelectorAll('select').forEach(sel => sel.addEventListener('change', onDynamicFilterChange));
  const resetBtn = document.getElementById('btn-reset-filters');
  if (resetBtn) resetBtn.addEventListener('click', resetAllFilters);
}

function onDynamicFilterChange() {
  const isCdr = appState.activeModule === 'CDR';
  appState.filters.facility = document.getElementById('filter-facility') ? document.getElementById('filter-facility').value : 'ALL';
  appState.filters.areaCategory = document.getElementById('filter-area') ? document.getElementById('filter-area').value : 'ALL';
  appState.filters.district = document.getElementById('filter-district') ? document.getElementById('filter-district').value : 'ALL';
  appState.filters.causeCategory = document.getElementById('filter-cause') ? document.getElementById('filter-cause').value : 'ALL';

  if (isCdr) {
    appState.filters.sex = document.getElementById('filter-gender') ? document.getElementById('filter-gender').value : 'ALL';
  } else {
    appState.filters.deathTiming = document.getElementById('filter-timing') ? document.getElementById('filter-timing').value : 'ALL';
  }

  appState.currentPage = 1;
  applyFilters();
}

function resetAllFilters() {
  appState.filters = {
    year: 'ALL',
    facility: 'ALL',
    areaCategory: 'ALL',
    district: 'ALL',
    ageGroup: 'ALL',
    causeCategory: 'ALL',
    sex: 'ALL',
    deathTiming: 'ALL',
    search: ''
  };

  const sInput = document.getElementById('search-input');
  if (sInput) sInput.value = '';

  renderFilterControls();
  appState.currentPage = 1;
  applyFilters();
  showToast('Filters reset', 'info');
}

function applyFilters() {
  const isCdr = appState.activeModule === 'CDR';
  const rawList = isCdr ? (appState.allData.cdr || []) : (appState.allData.mdr || []);
  const f = appState.filters;
  const activeYear = appState.activeYear;

  appState.filteredData = rawList.filter(r => {
    if (activeYear !== 'ALL' && r.year !== activeYear) return false;
    if (f.facility !== 'ALL' && r.facility !== f.facility) return false;
    if (f.areaCategory !== 'ALL' && r.areaCategory !== f.areaCategory) return false;
    if (f.district !== 'ALL' && r.district !== f.district) return false;
    if (f.causeCategory !== 'ALL' && r.causeCategory !== f.causeCategory) return false;

    if (isCdr) {
      if (f.sex !== 'ALL' && r.sex !== f.sex) return false;
    } else {
      if (f.deathTiming !== 'ALL' && r.deathTiming !== f.deathTiming) return false;
    }

    if (f.search) {
      const q = f.search;
      if (isCdr) {
        const match = (r.childName && r.childName.toLowerCase().includes(q)) ||
                      (r.motherName && r.motherName.toLowerCase().includes(q)) ||
                      (r.cause && r.cause.toLowerCase().includes(q)) ||
                      (r.village && r.village.toLowerCase().includes(q)) ||
                      (r.facility && r.facility.toLowerCase().includes(q)) ||
                      (r.areaCategory && r.areaCategory.toLowerCase().includes(q));
        if (!match) return false;
      } else {
        const match = (r.deceasedName && r.deceasedName.toLowerCase().includes(q)) ||
                      (r.cause && r.cause.toLowerCase().includes(q)) ||
                      (r.address && r.address.toLowerCase().includes(q)) ||
                      (r.district && r.district.toLowerCase().includes(q)) ||
                      (r.facility && r.facility.toLowerCase().includes(q));
        if (!match) return false;
      }
    }
    return true;
  });

  updateActiveChips();
  renderKpis(appState.filteredData);
  renderAllCharts(appState.filteredData);
  renderTable();
}

function updateActiveChips() {
  const container = document.getElementById('filter-active-chips');
  container.innerHTML = '';
  const chips = [];

  if (appState.activeYear !== 'ALL') chips.push(`Year: ${appState.activeYear}`);
  const isCdr = appState.activeModule === 'CDR';
  const f = appState.filters;

  if (f.facility !== 'ALL') chips.push(`Facility: ${f.facility}`);
  if (f.areaCategory !== 'ALL') chips.push(`Area: ${f.areaCategory}`);
  if (f.district !== 'ALL') chips.push(`District: ${f.district}`);
  if (isCdr && f.sex !== 'ALL') chips.push(`Sex: ${f.sex}`);
  if (!isCdr && f.deathTiming !== 'ALL') chips.push(`Timing: ${f.deathTiming}`);
  if (f.causeCategory !== 'ALL') chips.push(`Cause: ${f.causeCategory}`);
  if (f.search) chips.push(`Search: "${f.search}"`);

  if (chips.length === 0) {
    const total = appState.filteredData.length;
    container.innerHTML = `<span style="font-size:0.75rem; color:var(--text-muted);">Showing all ${total} records across health facilities & areas</span>`;
    return;
  }

  chips.forEach(c => {
    const el = document.createElement('span');
    el.className = 'kpi-pill';
    el.style.background = isCdr ? 'rgba(99, 102, 241, 0.2)' : 'rgba(244, 63, 94, 0.2)';
    el.style.color = isCdr ? '#818cf8' : '#fb7185';
    el.style.border = `1px solid ${isCdr ? 'rgba(99, 102, 241, 0.4)' : 'rgba(244, 63, 94, 0.4)'}`;
    el.textContent = c;
    container.appendChild(el);
  });
}



// Render dynamic Executive KPI cards
function renderKpis(data) {
  const container = document.getElementById('kpi-cards-container');
  const isCdr = appState.activeModule === 'CDR';
  const total = data.length;

  if (isCdr) {
    const neonatalCount = data.filter(r => r.ageGroup.includes('Neonatal') || r.ageGroup.includes('Day 0 - 1')).length;
    const neonatalPct = total > 0 ? ((neonatalCount / total) * 100).toFixed(1) : 0;
    const males = data.filter(r => r.sex === 'MALE').length;
    const females = data.filter(r => r.sex === 'FEMALE').length;
    const homeDeaths = data.filter(r => r.podGroup === 'Home').length;
    const instDeaths = total - homeDeaths;
    const instPct = total > 0 ? ((instDeaths / total) * 100).toFixed(1) : 0;
    const lbwCases = data.filter(r => r.birthWeightGrams && r.birthWeightGrams < 2500).length;
    const knownWeights = data.filter(r => r.birthWeightGrams !== null).length;
    const lbwPct = knownWeights > 0 ? ((lbwCases / knownWeights) * 100).toFixed(1) : 0;
    const sepsisCount = data.filter(r => r.causeCategory === 'Sepsis & Septic Shock').length;

    container.innerHTML = `
      <div class="kpi-card kpi-rose">
        <div class="kpi-header">
          <span class="kpi-title">Total Child Deaths</span>
          <div class="kpi-icon"><i class="fas fa-clipboard-check"></i></div>
        </div>
        <div class="kpi-value-row"><span class="kpi-value">${total.toLocaleString()}</span></div>
        <div class="kpi-subtext"><span>Across Selected Years & Worksheets</span></div>
      </div>

      <div class="kpi-card kpi-amber">
        <div class="kpi-header">
          <span class="kpi-title">Neonatal Mortality (&le;28d)</span>
          <div class="kpi-icon"><i class="fas fa-baby"></i></div>
        </div>
        <div class="kpi-value-row"><span class="kpi-value">${neonatalCount.toLocaleString()}</span></div>
        <div class="kpi-subtext"><span>${neonatalPct}% of reviewed child deaths</span></div>
      </div>

      <div class="kpi-card kpi-blue">
        <div class="kpi-header">
          <span class="kpi-title">Gender Ratio</span>
          <div class="kpi-icon"><i class="fas fa-venus-mars"></i></div>
        </div>
        <div class="kpi-value-row"><span class="kpi-value">${males}M / ${females}F</span></div>
        <div class="kpi-subtext"><span>${total > 0 ? ((males/total)*100).toFixed(1) : 0}% Male • ${total > 0 ? ((females/total)*100).toFixed(1) : 0}% Female</span></div>
      </div>

      <div class="kpi-card kpi-purple">
        <div class="kpi-header">
          <span class="kpi-title">Institutional Facility</span>
          <div class="kpi-icon"><i class="fas fa-hospital-user"></i></div>
        </div>
        <div class="kpi-value-row"><span class="kpi-value">${instPct}%</span></div>
        <div class="kpi-subtext"><span>${instDeaths.toLocaleString()} Inst. | ${homeDeaths.toLocaleString()} Home Deaths</span></div>
      </div>

      <div class="kpi-card kpi-cyan">
        <div class="kpi-header">
          <span class="kpi-title">Low Birth Weight (&lt;2.5kg)</span>
          <div class="kpi-icon"><i class="fas fa-weight"></i></div>
        </div>
        <div class="kpi-value-row"><span class="kpi-value">${lbwPct}%</span></div>
        <div class="kpi-subtext"><span>${lbwCases} of ${knownWeights} recorded birth weights</span></div>
      </div>

      <div class="kpi-card kpi-emerald">
        <div class="kpi-header">
          <span class="kpi-title">Sepsis & Septic Shock</span>
          <div class="kpi-icon"><i class="fas fa-virus"></i></div>
        </div>
        <div class="kpi-value-row"><span class="kpi-value">${sepsisCount.toLocaleString()}</span></div>
        <div class="kpi-subtext"><span>${total > 0 ? ((sepsisCount/total)*100).toFixed(1) : 0}% Leading Primary Factor</span></div>
      </div>
    `;
  } else {
    // Maternal Death Review KPIs
    const pncDeaths = data.filter(r => r.deathTiming === 'Postpartum (PNC)').length;
    const pncPct = total > 0 ? ((pncDeaths / total) * 100).toFixed(1) : 0;
    const pphDeaths = data.filter(r => r.causeCategory.includes('Hemorrhage')).length;
    const pphPct = total > 0 ? ((pphDeaths / total) * 100).toFixed(1) : 0;
    const eclampsiaDeaths = data.filter(r => r.causeCategory.includes('Hypertensive') || r.causeCategory.includes('Eclampsia')).length;
    const gmcDeaths = data.filter(r => r.podGroup.includes('Public')).length;
    const gmcPct = total > 0 ? ((gmcDeaths / total) * 100).toFixed(1) : 0;
    const youngMothers = data.filter(r => r.ageNum > 0 && r.ageNum <= 24).length;
    const youngPct = total > 0 ? ((youngMothers / total) * 100).toFixed(1) : 0;

    container.innerHTML = `
      <div class="kpi-card kpi-rose">
        <div class="kpi-header">
          <span class="kpi-title">Total Maternal Deaths</span>
          <div class="kpi-icon"><i class="fas fa-female"></i></div>
        </div>
        <div class="kpi-value-row"><span class="kpi-value">${total.toLocaleString()}</span></div>
        <div class="kpi-subtext"><span>Maternal Deaths Audited Across 2023–27</span></div>
      </div>

      <div class="kpi-card kpi-purple">
        <div class="kpi-header">
          <span class="kpi-title">Postpartum (PNC) Deaths</span>
          <div class="kpi-icon"><i class="fas fa-hourglass-end"></i></div>
        </div>
        <div class="kpi-value-row"><span class="kpi-value">${pncDeaths}</span></div>
        <div class="kpi-subtext"><span>${pncPct}% Occurred After Delivery</span></div>
      </div>

      <div class="kpi-card kpi-amber">
        <div class="kpi-header">
          <span class="kpi-title">Hemorrhage & PPH</span>
          <div class="kpi-icon"><i class="fas fa-tint"></i></div>
        </div>
        <div class="kpi-value-row"><span class="kpi-value">${pphDeaths}</span></div>
        <div class="kpi-subtext"><span>${pphPct}% Primary Hemorrhage / PPH / Severe Anemia</span></div>
      </div>

      <div class="kpi-card kpi-blue">
        <div class="kpi-header">
          <span class="kpi-title">Eclampsia / Hypertension</span>
          <div class="kpi-icon"><i class="fas fa-heartbeat"></i></div>
        </div>
        <div class="kpi-value-row"><span class="kpi-value">${eclampsiaDeaths}</span></div>
        <div class="kpi-subtext"><span>${total > 0 ? ((eclampsiaDeaths/total)*100).toFixed(1) : 0}% Hypertensive Disorders</span></div>
      </div>

      <div class="kpi-card kpi-cyan">
        <div class="kpi-header">
          <span class="kpi-title">Tertiary Care Referrals</span>
          <div class="kpi-icon"><i class="fas fa-hospital"></i></div>
        </div>
        <div class="kpi-value-row"><span class="kpi-value">${gmcPct}%</span></div>
        <div class="kpi-subtext"><span>${gmcDeaths} at GMC / District Hospital Level</span></div>
      </div>

      <div class="kpi-card kpi-emerald">
        <div class="kpi-header">
          <span class="kpi-title">Young Mothers (&le;24 Yrs)</span>
          <div class="kpi-icon"><i class="fas fa-user-clock"></i></div>
        </div>
        <div class="kpi-value-row"><span class="kpi-value">${youngMothers}</span></div>
        <div class="kpi-subtext"><span>${youngPct}% Mothers Aged 18 to 24</span></div>
      </div>
    `;
  }
}

// Chart theme settings
function getChartTheme() {
  const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
  return {
    textColor: isDark ? '#94a3b8' : '#475569',
    gridColor: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.06)',
    tooltipBg: isDark ? '#1e293b' : '#ffffff',
    tooltipText: isDark ? '#f8fafc' : '#0f172a',
    tooltipBorder: isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.12)'
  };
}

// Render all charts dynamically
function renderAllCharts(data) {
  const theme = getChartTheme();
  const isCdr = appState.activeModule === 'CDR';

  // 1. Health Facility Wise Analysis (GMC, IGGMC, DAGA, NMC Urban, Private, Home)
  renderFacilityChart(data, theme);

  // 2. Area Wise Analysis (NMC Urban, Rural, Other District, Other State)
  renderAreaChart(data, theme);

  // 3. District Wise Analysis (Special focus for MDR & regional surveillance)
  renderDistrictChart(data, theme);

  // 4. Place of Death Donut Chart
  renderPodChart(data, theme, isCdr);

  // 5. Child Age at Demise (or Mother Age in MDR)
  renderAgeBreakdownChart(data, theme, isCdr);

  // 6. Birth Weight Profile (or Pregnancy Demise Timing in MDR)
  renderSecondaryBreakdownChart(data, theme, isCdr);
}

// Global Data Labels Plugin for Chart.js - Always Outside / Above the bars
const chartDataLabelsPlugin = {
  id: 'customDataLabels',
  afterDatasetsDraw(chart, args, options) {
    if (options && options.display === false) return;
    const { ctx } = chart;
    const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
    const defaultColor = isDark ? '#f1f5f9' : '#0f172a';

    chart.data.datasets.forEach((dataset, datasetIndex) => {
      const meta = chart.getDatasetMeta(datasetIndex);
      if (!meta || meta.hidden) return;

      const isLine = chart.config.type === 'line' || meta.type === 'line';
      const isBar = chart.config.type === 'bar' || meta.type === 'bar';
      const isDoughnut = chart.config.type === 'doughnut' || meta.type === 'doughnut';
      const isHorizontal = chart.options.indexAxis === 'y';

      meta.data.forEach((element, index) => {
        const val = dataset.data ? dataset.data[index] : null;
        if (val === null || val === undefined || val === 0) return;

        ctx.save();
        ctx.font = 'bold 10px system-ui, -apple-system, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        if (isBar && isHorizontal) {
          // Horizontal bar chart: place OUTSIDE the right edge of the bar
          const x = element.x + 12;
          const y = element.y;
          ctx.textAlign = 'left';
          ctx.fillStyle = defaultColor;
          ctx.fillText(String(val), x, y);
        } else if (isBar) {
          // Vertical bar chart: place OUTSIDE / ABOVE the bar
          const x = element.x;
          let y = element.y - 8;
          // Ensure it doesn't clip off the top
          if (y < chart.chartArea.top + 6) y = chart.chartArea.top + 8;
          
          ctx.fillStyle = defaultColor;
          ctx.fillText(String(val), x, y);
        } else if (isLine) {
          // Line chart: above the point
          const x = element.x;
          let y = element.y - 10;
          if (y < chart.chartArea.top + 8) y = element.y + 12;

          ctx.fillStyle = dataset.borderColor || defaultColor;
          ctx.fillText(String(val), x, y);
        } else if (isDoughnut) {
          // Doughnut slice label: calculate middle angle outside or centered
          const angle = (element.startAngle + element.endAngle) / 2;
          const radius = (element.innerRadius + element.outerRadius) / 2;
          const x = element.x + Math.cos(angle) * radius;
          const y = element.y + Math.sin(angle) * radius;

          if (element.endAngle - element.startAngle > 0.25) {
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 11px system-ui, -apple-system, sans-serif';
            ctx.shadowColor = 'rgba(0,0,0,0.6)';
            ctx.shadowBlur = 4;
            ctx.fillText(String(val), x, y);
          }
        }
        ctx.restore();
      });
    });
  }
};

Chart.register(chartDataLabelsPlugin);

// 1. Health Facility Wise Chart (Monthly / Yearly) - Bar Chart with Data Labels Above
function renderFacilityChart(data, theme) {
  const facilities = ['GMC', 'IGGMC', 'DAGA', 'NMC (Urban)', 'Private Hospital', 'Home'];
  const mode = appState.temporalViews.facility || 'monthly';
  const canvas = document.getElementById('chart-facility');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (appState.charts.facility) appState.charts.facility.destroy();

  if (mode === 'monthly') {
    const months = ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'];
    const datasets = facilities.map(fac => {
      const counts = months.map(m => {
        return data.filter(r => r.facility === fac && r.month && r.month.toLowerCase().startsWith(m.toLowerCase())).length;
      });
      const color = facilityColors[fac] || palette.blue;
      return {
        label: fac,
        data: counts,
        backgroundColor: color,
        borderRadius: 4
      };
    });

    appState.charts.facility = new Chart(ctx, {
      type: 'bar',
      data: { labels: months, datasets: datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        layout: {
          padding: { top: 22, right: 10, left: 5, bottom: 5 }
        },
        plugins: {
          legend: {
            position: 'top',
            labels: {
              color: theme.textColor,
              font: { size: 10, weight: '600' },
              boxWidth: 10
            }
          },
          tooltip: {
            backgroundColor: theme.tooltipBg,
            titleColor: theme.tooltipText,
            bodyColor: theme.tooltipText,
            borderColor: theme.tooltipBorder,
            borderWidth: 1
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: theme.textColor, font: { size: 10, weight: '600' } }
          },
          y: {
            beginAtZero: true,
            grace: '12%',
            grid: { color: theme.gridColor },
            ticks: { color: theme.textColor }
          }
        }
      }
    });
  } else {
    // Yearly breakdown Bar Chart
    const years = ['2023-24', '2024-25', '2025-26', '2026-27'];
    const datasets = facilities.map(fac => {
      const counts = years.map(y => data.filter(r => r.facility === fac && r.year === y).length);
      const color = facilityColors[fac] || palette.blue;
      return {
        label: fac,
        data: counts,
        backgroundColor: color,
        borderRadius: 5
      };
    });

    appState.charts.facility = new Chart(ctx, {
      type: 'bar',
      data: { labels: years, datasets: datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        layout: {
          padding: { top: 24, right: 15, left: 5, bottom: 5 }
        },
        plugins: {
          legend: {
            position: 'top',
            labels: {
              color: theme.textColor,
              font: { size: 11, weight: '600' },
              boxWidth: 10
            }
          },
          tooltip: {
            backgroundColor: theme.tooltipBg,
            titleColor: theme.tooltipText,
            bodyColor: theme.tooltipText,
            borderColor: theme.tooltipBorder,
            borderWidth: 1
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: theme.textColor, font: { size: 11, weight: '600' } }
          },
          y: {
            beginAtZero: true,
            grace: '14%',
            grid: { color: theme.gridColor },
            ticks: { color: theme.textColor }
          }
        }
      }
    });
  }
}

// 2. Area Wise Chart (NMC Urban, Rural, Other District, Other State)
function renderAreaChart(data, theme) {
  const areas = ['NMC (Urban)', 'Rural', 'Other District', 'Other State'];
  const mode = appState.temporalViews.area || 'monthly';
  const canvas = document.getElementById('chart-area');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (appState.charts.area) appState.charts.area.destroy();

  if (mode === 'monthly') {
    const months = ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'];
    const datasets = areas.map(a => {
      const counts = months.map(m => {
        return data.filter(r => r.areaCategory === a && r.month && r.month.toLowerCase().startsWith(m.toLowerCase())).length;
      });
      return {
        label: a,
        data: counts,
        backgroundColor: areaColors[a] || palette.blue,
        borderRadius: 4
      };
    });

    appState.charts.area = new Chart(ctx, {
      type: 'bar',
      data: { labels: months, datasets: datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        layout: { padding: { top: 22 } },
        plugins: {
          legend: { position: 'top', labels: { color: theme.textColor, font: { size: 10, weight: '600' }, boxWidth: 10 } },
          tooltip: { backgroundColor: theme.tooltipBg, titleColor: theme.tooltipText, bodyColor: theme.tooltipText }
        },
        scales: {
          x: { grid: { display: false }, ticks: { color: theme.textColor, font: { size: 10 } } },
          y: { beginAtZero: true, grace: '12%', grid: { color: theme.gridColor }, ticks: { color: theme.textColor } }
        }
      }
    });
  } else {
    const years = ['2023-24', '2024-25', '2025-26', '2026-27'];
    const datasets = areas.map(a => {
      const counts = years.map(y => data.filter(r => r.areaCategory === a && r.year === y).length);
      return {
        label: a,
        data: counts,
        backgroundColor: areaColors[a] || palette.blue,
        borderRadius: 4
      };
    });

    appState.charts.area = new Chart(ctx, {
      type: 'bar',
      data: { labels: years, datasets: datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        layout: { padding: { top: 24 } },
        plugins: {
          legend: { position: 'top', labels: { color: theme.textColor, font: { size: 10, weight: '600' }, boxWidth: 10 } },
          tooltip: { backgroundColor: theme.tooltipBg, titleColor: theme.tooltipText, bodyColor: theme.tooltipText }
        },
        scales: {
          x: { grid: { display: false }, ticks: { color: theme.textColor, font: { size: 11, weight: '600' } } },
          y: { beginAtZero: true, grace: '14%', grid: { color: theme.gridColor }, ticks: { color: theme.textColor } }
        }
      }
    });
  }
}

// 3. District Wise Analysis (In MDR and regional surveillance)
function renderDistrictChart(data, theme) {
  const mode = appState.temporalViews.district || 'yearly';
  const canvas = document.getElementById('chart-district');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (appState.charts.district) appState.charts.district.destroy();

  // Aggregate top districts
  const counts = {};
  data.forEach(r => {
    const d = r.district || 'Nagpur';
    counts[d] = (counts[d] || 0) + 1;
  });

  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 10);
  const topDistricts = sorted.map(s => s[0]);

  if (mode === 'monthly') {
    const months = ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'];
    const top5 = topDistricts.slice(0, 5);
    const districtPalette = [palette.indigo, palette.blue, palette.rose, palette.amber, palette.emerald];

    const datasets = top5.map((dist, idx) => {
      const countsArr = months.map(m => {
        return data.filter(r => (r.district === dist || (!r.district && dist === 'Nagpur')) && r.month && r.month.toLowerCase().startsWith(m.toLowerCase())).length;
      });
      return {
        label: dist,
        data: countsArr,
        backgroundColor: districtPalette[idx % districtPalette.length],
        borderRadius: 4
      };
    });

    appState.charts.district = new Chart(ctx, {
      type: 'bar',
      data: { labels: months, datasets: datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        layout: { padding: { top: 22 } },
        plugins: {
          legend: { position: 'top', labels: { color: theme.textColor, font: { size: 10, weight: '600' }, boxWidth: 10 } },
          tooltip: { backgroundColor: theme.tooltipBg, titleColor: theme.tooltipText, bodyColor: theme.tooltipText }
        },
        scales: {
          x: { grid: { display: false }, ticks: { color: theme.textColor, font: { size: 10 } } },
          y: { beginAtZero: true, grace: '12%', grid: { color: theme.gridColor }, ticks: { color: theme.textColor } }
        }
      }
    });
  } else {
    // Yearly / Rank-order horizontal bar chart: Labels OUTSIDE the right of the bar
    const labels = topDistricts;
    const values = sorted.map(s => s[1]);

    appState.charts.district = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: 'Number of Cases',
          data: values,
          backgroundColor: [
            palette.indigo,
            palette.blue,
            palette.cyan,
            palette.purple,
            palette.rose,
            palette.amber,
            palette.emerald,
            palette.teal,
            palette.orange,
            '#94a3b8'
          ],
          borderRadius: 6
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        layout: { padding: { right: 35 } },
        plugins: {
          legend: { display: false },
          tooltip: { backgroundColor: theme.tooltipBg, titleColor: theme.tooltipText, bodyColor: theme.tooltipText }
        },
        scales: {
          x: { beginAtZero: true, grace: '10%', grid: { color: theme.gridColor }, ticks: { color: theme.textColor } },
          y: { grid: { display: false }, ticks: { color: theme.textColor, font: { size: 10, weight: '600' } } }
        }
      }
    });
  }
}

// 4. Place of Death Doughnut Chart with Data Labels
function renderPodChart(data, theme, isCdr) {
  const canvas = document.getElementById('chart-pod');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (appState.charts.pod) appState.charts.pod.destroy();

  const counts = {};
  data.forEach(r => {
    let p = r.podGroup || r.placeOfDeath || 'Public Hospital';
    const pl = (p || '').toLowerCase();
    if (pl.includes('home')) {
      p = 'Home';
    } else if (pl.includes('private')) {
      p = 'Private Hospital';
    } else if (pl.includes('gmc') || pl.includes('iggmc') || pl.includes('daga') || pl.includes('mayo')) {
      p = 'Public Hospital (GMC/IGGMC/Daga)';
    } else if (pl.includes('public') || pl.includes('hospital') || pl.includes('health facility')) {
      p = 'Public Hospital';
    } else {
      p = r.podGroup || 'Public Hospital (GMC/IGGMC/Daga)';
    }
    counts[p] = (counts[p] || 0) + 1;
  });

  const order = ['Public Hospital (GMC/IGGMC/Daga)', 'Public Hospital', 'Private Hospital', 'Home'];
  const labels = [];
  const values = [];
  order.forEach(o => {
    if (counts[o] !== undefined) {
      labels.push(o);
      values.push(counts[o]);
    }
  });
  Object.keys(counts).forEach(k => {
    if (!labels.includes(k)) {
      labels.push(k);
      values.push(counts[k]);
    }
  });

  const podColors = {
    'Public Hospital (GMC/IGGMC/Daga)': '#6366f1',
    'Public Hospital': '#38bdf8',
    'Private Hospital': '#f43f5e',
    'Home': '#10b981'
  };

  const bgColors = labels.map(l => podColors[l] || palette.amber);

  appState.charts.pod = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: labels,
      datasets: [{
        data: values,
        backgroundColor: bgColors,
        borderWidth: 0,
        hoverOffset: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'right',
          labels: {
            color: theme.textColor,
            font: { size: 10, weight: '600' },
            boxWidth: 12,
            padding: 8
          }
        },
        tooltip: {
          backgroundColor: theme.tooltipBg,
          titleColor: theme.tooltipText,
          bodyColor: theme.tooltipText,
          borderColor: theme.tooltipBorder,
          borderWidth: 1
        }
      },
      cutout: '62%'
    }
  });
}

// 5. Child Age at Demise (or Mother Age in MDR) Bar Chart with Data Labels Above Bar
function renderAgeBreakdownChart(data, theme, isCdr) {
  const canvas = document.getElementById('chart-breakdown-1');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (appState.charts.breakdown1) appState.charts.breakdown1.destroy();

  let labels = [];
  let counts = [];
  let bgColors = [];

  const titleEl = document.getElementById('chart-title-breakdown-1');
  const subEl = document.getElementById('chart-sub-breakdown-1');

  if (isCdr) {
    if (titleEl) titleEl.innerHTML = '<i class="fas fa-child" style="color:var(--accent-amber);"></i> Child Age at Demise';
    if (subEl) subEl.textContent = 'Early Neonatal vs Late Neonatal vs Child stages';
    labels = ['Day 0-1', '1-7 Days', '8-28 Days', '1-12 Mos', '1-5 Yrs'];
    counts = [
      data.filter(r => (r.ageGroup && (r.ageGroup.includes('Day 0') || r.ageGroup.includes('<24')))).length,
      data.filter(r => (r.ageGroup && r.ageGroup.includes('1-7 Days'))).length,
      data.filter(r => (r.ageGroup && r.ageGroup.includes('8-28 Days'))).length,
      data.filter(r => (r.ageGroup && (r.ageGroup.includes('1-12') || r.ageGroup.includes('Post-Neonatal')))).length,
      data.filter(r => (r.ageGroup && (r.ageGroup.includes('1 - 5') || r.ageGroup.includes('Child')))).length
    ];
    bgColors = ['#f43f5e', '#f97316', '#f59e0b', '#6366f1', '#10b981'];
  } else {
    if (titleEl) titleEl.innerHTML = '<i class="fas fa-female" style="color:var(--accent-amber);"></i> Mother Age Demographics';
    if (subEl) subEl.textContent = 'Adolescent and maternal age brackets';
    labels = ['< 20 Yrs', '20-24 Yrs', '25-29 Yrs', '30-34 Yrs', '35+ Yrs'];
    counts = [
      data.filter(r => (r.ageGroup && r.ageGroup.includes('< 20'))).length,
      data.filter(r => (r.ageGroup && r.ageGroup.includes('20 - 24'))).length,
      data.filter(r => (r.ageGroup && r.ageGroup.includes('25 - 29'))).length,
      data.filter(r => (r.ageGroup && r.ageGroup.includes('30 - 34'))).length,
      data.filter(r => (r.ageGroup && r.ageGroup.includes('35+'))).length
    ];
    bgColors = ['#f43f5e', '#f97316', '#f59e0b', '#6366f1', '#10b981'];
  }

  appState.charts.breakdown1 = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: isCdr ? 'Child Demises' : 'Maternal Demises',
        data: counts,
        backgroundColor: bgColors,
        borderRadius: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      layout: { padding: { top: 22 } },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: theme.tooltipBg,
          titleColor: theme.tooltipText,
          bodyColor: theme.tooltipText,
          borderColor: theme.tooltipBorder,
          borderWidth: 1
        }
      },
      scales: {
        x: { grid: { display: false }, ticks: { color: theme.textColor, font: { size: 10, weight: '600' } } },
        y: { beginAtZero: true, grace: '12%', grid: { color: theme.gridColor }, ticks: { color: theme.textColor } }
      }
    }
  });
}

// 6. Birth Weight Profile (or Demise Timing in MDR) Bar Chart with Data Labels Above Bar
function renderSecondaryBreakdownChart(data, theme, isCdr) {
  const canvas = document.getElementById('chart-breakdown-2');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (appState.charts.breakdown2) appState.charts.breakdown2.destroy();

  let labels = [];
  let counts = [];
  let bgColors = [];

  const titleEl = document.getElementById('chart-title-breakdown-2');
  const subEl = document.getElementById('chart-sub-breakdown-2');

  if (isCdr) {
    if (titleEl) titleEl.innerHTML = '<i class="fas fa-balance-scale" style="color:var(--accent-emerald);"></i> Birth Weight Profile';
    if (subEl) subEl.textContent = 'ELBW (<1kg), VLBW (1–1.5kg), LBW (1.5–2.5kg), Normal';
    labels = ['<1000g', '1-1.5kg', '1.5-2.5kg', '>=2.5kg', 'Unknown'];
    counts = [
      data.filter(r => (r.birthWeightCategory && r.birthWeightCategory.includes('ELBW'))).length,
      data.filter(r => (r.birthWeightCategory && r.birthWeightCategory.includes('VLBW'))).length,
      data.filter(r => (r.birthWeightCategory && (r.birthWeightCategory.includes('LBW') && !r.birthWeightCategory.includes('VLBW') && !r.birthWeightCategory.includes('ELBW')))).length,
      data.filter(r => (r.birthWeightCategory && r.birthWeightCategory.includes('Normal'))).length,
      data.filter(r => (!r.birthWeightCategory || r.birthWeightCategory === 'Unknown')).length
    ];
    bgColors = ['#a855f7', '#38bdf8', '#f59e0b', '#10b981', '#f43f5e'];
  } else {
    if (titleEl) titleEl.innerHTML = '<i class="fas fa-clock" style="color:var(--accent-emerald);"></i> Demise Timing in Pregnancy';
    if (subEl) subEl.textContent = 'Antepartum (ANC), Intrapartum, Postpartum (PNC)';
    labels = ['Postpartum (PNC)', 'Antepartum (ANC)', 'Intrapartum (Delivery)', 'Unspecified'];
    counts = [
      data.filter(r => (r.deathTiming && r.deathTiming.includes('Postpartum'))).length,
      data.filter(r => (r.deathTiming && r.deathTiming.includes('Antepartum'))).length,
      data.filter(r => (r.deathTiming && r.deathTiming.includes('Intrapartum'))).length,
      data.filter(r => (!r.deathTiming || r.deathTiming.includes('Unspecified'))).length
    ];
    bgColors = ['#a855f7', '#38bdf8', '#f59e0b', '#f43f5e'];
  }

  appState.charts.breakdown2 = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: isCdr ? 'Infants' : 'Mothers',
        data: counts,
        backgroundColor: bgColors,
        borderRadius: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      layout: { padding: { top: 22 } },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: theme.tooltipBg,
          titleColor: theme.tooltipText,
          bodyColor: theme.tooltipText,
          borderColor: theme.tooltipBorder,
          borderWidth: 1
        }
      },
      scales: {
        x: { grid: { display: false }, ticks: { color: theme.textColor, font: { size: 10, weight: '600' } } },
        y: { beginAtZero: true, grace: '12%', grid: { color: theme.gridColor }, ticks: { color: theme.textColor } }
      }
    }
  });
}

// Table rendering and modal interactions
function renderTable() {
  const isCdr = appState.activeModule === 'CDR';
  const thead = document.getElementById('table-head');
  const tbody = document.getElementById('table-body');
  tbody.innerHTML = '';

  if (isCdr) {
    thead.innerHTML = `
      <tr>
        <th style="width: 50px;">Sr #</th>
        <th style="width: 90px;">Year</th>
        <th>Child & Mother's Name</th>
        <th>Gender</th>
        <th>Age</th>
        <th>Place of Death</th>
        <th>Clinical Diagnosis / Cause</th>
      </tr>
    `;
  } else {
    thead.innerHTML = `
      <tr>
        <th style="width: 50px;">Sr #</th>
        <th style="width: 90px;">Year</th>
        <th>Deceased Mother</th>
        <th>Age</th>
        <th>Timing of Demise</th>
        <th>Place of Death</th>
        <th>Clinical Cause of Death</th>
      </tr>
    `;
  }

  const total = appState.filteredData.length;
  const start = (appState.currentPage - 1) * appState.pageSize;
  const end = Math.min(start + appState.pageSize, total);
  const pageData = appState.filteredData.slice(start, end);

  document.getElementById('table-count-summary').textContent = `Showing ${start + 1} - ${end} of ${total} ${isCdr ? 'Child Deaths' : 'Maternal Deaths'}`;

  const totalPages = Math.ceil(total / appState.pageSize) || 1;
  document.getElementById('page-indicator').textContent = `Page ${appState.currentPage} of ${totalPages}`;
  document.getElementById('btn-prev-page').disabled = appState.currentPage <= 1;
  document.getElementById('btn-next-page').disabled = appState.currentPage >= totalPages;

  if (pageData.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding: 2.5rem; color:var(--text-muted);">No records found matching the active filters.</td></tr>`;
    return;
  }

  pageData.forEach(r => {
    const tr = document.createElement('tr');
    tr.onclick = () => openCaseModal(r);

    const facBadge = `<span class="badge badge-${(r.facility || 'gmc').toLowerCase().replace(/[^a-z]/g, '')}">${escapeHtml(r.facility || 'Hospital')}</span>`;
    const areaBadge = `<span class="badge badge-${(r.areaCategory || 'nmc').toLowerCase().replace(/[^a-z]/g, '')}">${escapeHtml(r.areaCategory || 'NMC (Urban)')}</span>`;

    if (isCdr) {
      const sexBadge = r.sex === 'FEMALE' 
        ? `<span class="badge badge-female"><i class="fas fa-venus"></i> Female</span>`
        : `<span class="badge badge-male"><i class="fas fa-mars"></i> Male</span>`;

      tr.innerHTML = `
        <td style="font-weight:700; color:var(--text-muted);">${r.srNo || '—'}</td>
        <td><span class="kpi-pill" style="font-size:0.72rem;">${r.year}</span></td>
        <td>
          <div style="font-weight:600; color:var(--text-primary);">${escapeHtml(r.childName || 'Unnamed Baby')}</div>
          <div style="font-size:0.75rem; color:var(--text-secondary);">M/o ${escapeHtml(r.motherName || 'Unknown')}</div>
        </td>
        <td>${sexBadge}</td>
        <td>${facBadge}</td>
        <td>${areaBadge}</td>
        <td style="max-width:280px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
          <span title="${escapeHtml(r.cause)}">${escapeHtml(r.cause)}</span>
        </td>
      `;
    } else {
      const timingBadge = `<span class="badge badge-postneonatal">${escapeHtml(r.deathTiming)}</span>`;

      tr.innerHTML = `
        <td style="font-weight:700; color:var(--text-muted);">${r.srNo || '—'}</td>
        <td><span class="kpi-pill" style="font-size:0.72rem; background:rgba(244,63,94,0.15); color:#fb7185;">${r.year}</span></td>
        <td>
          <div style="font-weight:600; color:var(--text-primary);">${escapeHtml(r.deceasedName || 'Unknown')}</div>
          <div style="font-size:0.75rem; color:var(--text-secondary);">${escapeHtml(r.address || '')}</div>
        </td>
        <td><span class="kpi-pill">${escapeHtml(r.district || 'Nagpur')}</span></td>
        <td>${facBadge}</td>
        <td>${areaBadge}</td>
        <td style="max-width:280px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
          <span title="${escapeHtml(r.cause)}">${escapeHtml(r.cause)}</span>
        </td>
      `;
    }
    tbody.appendChild(tr);
  });
}

// Modal view
function openCaseModal(rec) {
  const modal = document.getElementById('case-modal');
  const isCdr = rec.recordType === 'CDR';
  const grid = document.getElementById('modal-content-grid');

  if (isCdr) {
    document.getElementById('modal-case-title').textContent = `CDR Case #${rec.srNo}: ${rec.childName || 'Unnamed Baby'} (${rec.year})`;
    grid.innerHTML = `
      <div class="detail-item">
        <span class="detail-label">Mother's Name</span>
        <span class="detail-value">${escapeHtml(rec.motherName || 'Not recorded')}</span>
      </div>
      <div class="detail-item">
        <span class="detail-label">Gender & Category</span>
        <span class="detail-value">${escapeHtml(rec.sex || 'N/A')} • ${escapeHtml(rec.category || 'N/A')}</span>
      </div>
      <div class="detail-item">
        <span class="detail-label">Age at Demise</span>
        <span class="detail-value">${escapeHtml(rec.rawAge || 'N/A')} (${escapeHtml(rec.ageGroup)})</span>
      </div>
      <div class="detail-item">
        <span class="detail-label">Year & Month</span>
        <span class="detail-value">${escapeHtml(rec.year)} • ${escapeHtml(rec.month || 'N/A')}</span>
      </div>
      <div class="detail-item">
        <span class="detail-label">Health Facility</span>
        <span class="detail-value" style="color:var(--accent-indigo); font-weight:700;">${escapeHtml(rec.facility)} (${escapeHtml(rec.placeOfDeath || 'Hospital')})</span>
      </div>
      <div class="detail-item">
        <span class="detail-label">Area Classification</span>
        <span class="detail-value" style="color:var(--accent-blue); font-weight:700;">${escapeHtml(rec.areaCategory)}</span>
      </div>
      <div class="detail-item">
        <span class="detail-label">Village / Location</span>
        <span class="detail-value">${escapeHtml(rec.village || 'Nagpur')}</span>
      </div>
      <div class="detail-item">
        <span class="detail-label">Birth Weight Recorded</span>
        <span class="detail-value">${escapeHtml(rec.rawBirthWeight || 'Not recorded')} (${escapeHtml(rec.birthWeightCategory)})</span>
      </div>
      <div class="detail-item modal-full-width">
        <span class="detail-label">Epidemiological Cause Category</span>
        <span class="detail-value" style="color:var(--accent-blue); font-weight:700;">${escapeHtml(rec.causeCategory)}</span>
      </div>
      <div class="detail-item modal-full-width detail-box-alert">
        <span class="detail-label" style="color:var(--accent-rose);">Assigned Diagnosis / Cause of Death</span>
        <span class="detail-value">${escapeHtml(rec.cause || 'No diagnosis recorded')}</span>
      </div>
    `;
  } else {
    document.getElementById('modal-case-title').textContent = `MDR Case #${rec.srNo}: ${rec.deceasedName} (${rec.year})`;
    grid.innerHTML = `
      <div class="detail-item">
        <span class="detail-label">Deceased Mother</span>
        <span class="detail-value">${escapeHtml(rec.deceasedName)}</span>
      </div>
      <div class="detail-item">
        <span class="detail-label">Age & Caste</span>
        <span class="detail-value">${escapeHtml(rec.age || 'N/A')} Yrs • ${escapeHtml(rec.caste || 'Others')}</span>
      </div>
      <div class="detail-item">
        <span class="detail-label">Residence District</span>
        <span class="detail-value" style="color:var(--accent-amber); font-weight:800; font-size:1rem;">${escapeHtml(rec.district || 'Nagpur')}</span>
      </div>
      <div class="detail-item">
        <span class="detail-label">Area Classification</span>
        <span class="detail-value" style="color:var(--accent-blue); font-weight:700;">${escapeHtml(rec.areaCategory)}</span>
      </div>
      <div class="detail-item">
        <span class="detail-label">Health Facility</span>
        <span class="detail-value" style="color:var(--accent-indigo); font-weight:700;">${escapeHtml(rec.facility)} (${escapeHtml(rec.placeOfDeath || 'Hospital')})</span>
      </div>
      <div class="detail-item">
        <span class="detail-label">Timing of Death</span>
        <span class="detail-value" style="color:var(--accent-rose); font-weight:700;">${escapeHtml(rec.deathTiming)}</span>
      </div>
      <div class="detail-item modal-full-width">
        <span class="detail-label">Full Address / Location</span>
        <span class="detail-value">${escapeHtml(rec.address || 'Nagpur')}</span>
      </div>
      <div class="detail-item modal-full-width">
        <span class="detail-label">Cause Category</span>
        <span class="detail-value" style="color:var(--accent-rose); font-weight:700;">${escapeHtml(rec.causeCategory)}</span>
      </div>
      <div class="detail-item modal-full-width detail-box-alert">
        <span class="detail-label" style="color:var(--accent-rose);">Clinical Cause of Death (ICD10 / Audit Finding)</span>
        <span class="detail-value">${escapeHtml(rec.cause || 'Not recorded')}</span>
      </div>
    `;
  }

  modal.classList.add('active');
}

function closeModal() {
  document.getElementById('case-modal').classList.remove('active');
}

// Export active filtered table to CSV
function exportActiveViewToCsv() {
  if (appState.filteredData.length === 0) {
    showToast('No records to export!', 'error');
    return;
  }

  const isCdr = appState.activeModule === 'CDR';
  let headers = [];
  let rows = [];

  if (isCdr) {
    headers = ['Sr. No.', 'Year', 'Child Name', "Mother's Name", 'Sex', 'Category', 'Age', 'Village', 'Birth Weight', 'Place of Death', 'Diagnosis', 'Cause Category'];
    rows = appState.filteredData.map(r => [
      `"${r.srNo}"`, `"${r.year}"`, `"${(r.childName || '').replace(/"/g, '""')}"`,
      `"${(r.motherName || '').replace(/"/g, '""')}"`, `"${r.sex}"`, `"${r.category}"`,
      `"${r.rawAge}"`, `"${(r.village || '').replace(/"/g, '""')}"`, `"${r.rawBirthWeight}"`,
      `"${(r.placeOfDeath || '').replace(/"/g, '""')}"`, `"${(r.cause || '').replace(/"/g, '""')}"`,
      `"${r.causeCategory}"`
    ]);
  } else {
    headers = ['Sr. No.', 'Year', 'Deceased Women', 'Age', 'Address', 'Timing', 'Place of Death', 'Clinical Cause', 'Cause Category'];
    rows = appState.filteredData.map(r => [
      `"${r.srNo}"`, `"${r.year}"`, `"${(r.deceasedName || '').replace(/"/g, '""')}"`,
      `"${r.age}"`, `"${(r.address || '').replace(/"/g, '""')}"`, `"${r.deathTiming}"`,
      `"${(r.placeOfDeath || '').replace(/"/g, '""')}"`, `"${(r.cause || '').replace(/"/g, '""')}"`,
      `"${r.causeCategory}"`
    ]);
  }

  const csv = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
  const uri = encodeURI(csv);
  const link = document.createElement('a');
  link.setAttribute('href', uri);
  link.setAttribute('download', `${appState.activeModule}_Mortality_Report_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  showToast(`Exported ${appState.filteredData.length} records!`, 'success');
}

function showToast(msg, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = 'toast';
  let icon = 'fa-info-circle';
  let color = palette.blue;
  if (type === 'success') { icon = 'fa-check-circle'; color = palette.emerald; }
  else if (type === 'error') { icon = 'fa-exclamation-triangle'; color = palette.rose; }

  toast.innerHTML = `<i class="fas ${icon}" style="color:${color};"></i> <span>${escapeHtml(msg)}</span>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

function escapeHtml(t) {
  if (!t) return '';
  return t.toString()
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function debounce(fn, wait) {
  let timer;
  return function(...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), wait);
  };
}
