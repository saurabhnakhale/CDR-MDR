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

// Render dynamic filter controls based on active module
function renderFilterControls() {
  const container = document.getElementById('filter-grid-container');
  const isCdr = appState.activeModule === 'CDR';

  if (isCdr) {
    container.innerHTML = `
      <div class="filter-group">
        <label for="filter-gender"><i class="fas fa-venus-mars"></i> Child Gender</label>
        <select id="filter-gender" class="filter-select">
          <option value="ALL">All Genders</option>
          <option value="MALE">Male</option>
          <option value="FEMALE">Female</option>
        </select>
      </div>

      <div class="filter-group">
        <label for="filter-age-bracket"><i class="fas fa-baby"></i> Age Bracket</label>
        <select id="filter-age-bracket" class="filter-select">
          <option value="ALL">All Age Brackets</option>
          <option value="Day 0 - 1 (<24-48h)">Day 0 - 1 (<24-48h)</option>
          <option value="Early Neonatal (1-7 Days)">Early Neonatal (1-7 Days)</option>
          <option value="Late Neonatal (8-28 Days)">Late Neonatal (8-28 Days)</option>
          <option value="Post-Neonatal (1-12 Months)">Post-Neonatal (1-12 Mos)</option>
          <option value="Child (1 - 5 Years)">Child (1 - 5 Years)</option>
        </select>
      </div>

      <div class="filter-group">
        <label for="filter-place"><i class="fas fa-hospital-alt"></i> Place of Death</label>
        <select id="filter-place" class="filter-select">
          <option value="ALL">All Places</option>
          <option value="Public Hospital (GMC/IGGMC/Daga)">Public (GMC/IGGMC/Daga)</option>
          <option value="Private Hospital">Private Hospitals</option>
          <option value="Home">Home Deaths</option>
        </select>
      </div>

      <div class="filter-group">
        <label for="filter-cause"><i class="fas fa-stethoscope"></i> Clinical Cause</label>
        <select id="filter-cause" class="filter-select">
          <option value="ALL">All Cause Groups</option>
          <option value="Sepsis & Septic Shock">Sepsis & Septic Shock</option>
          <option value="Respiratory / RDS / Pneumonia">Respiratory / RDS / Pneumonia</option>
          <option value="Prematurity & Low Birth Weight">Prematurity & LBW</option>
          <option value="Congenital Anomalies & Heart Diseases">Congenital Heart & Anomalies</option>
          <option value="Birth Asphyxia & Aspiration">Birth Asphyxia & Aspiration</option>
          <option value="Infections & Illness">Infections & Illness</option>
        </select>
      </div>

      <div class="filter-group">
        <button id="btn-reset-filters" class="btn-reset-filters" title="Clear active filters">
          <i class="fas fa-undo"></i> Reset Filters
        </button>
      </div>
    `;
  } else {
    container.innerHTML = `
      <div class="filter-group">
        <label for="filter-timing"><i class="fas fa-hourglass-half"></i> Timing of Death</label>
        <select id="filter-timing" class="filter-select">
          <option value="ALL">All Timings</option>
          <option value="Postpartum (PNC)">Postpartum (PNC)</option>
          <option value="Antepartum (ANC)">Antepartum (ANC)</option>
          <option value="Intrapartum (Delivery)">Intrapartum (Delivery)</option>
        </select>
      </div>

      <div class="filter-group">
        <label for="filter-age-bracket"><i class="fas fa-female"></i> Mother's Age</label>
        <select id="filter-age-bracket" class="filter-select">
          <option value="ALL">All Age Groups</option>
          <option value="< 20 Yrs (Adolescent)">< 20 Yrs (Adolescent)</option>
          <option value="20 - 24 Yrs">20 - 24 Yrs</option>
          <option value="25 - 29 Yrs">25 - 29 Yrs</option>
          <option value="30 - 34 Yrs">30 - 34 Yrs</option>
          <option value="35+ Yrs">35+ Yrs</option>
        </select>
      </div>

      <div class="filter-group">
        <label for="filter-place"><i class="fas fa-hospital-alt"></i> Place of Death</label>
        <select id="filter-place" class="filter-select">
          <option value="ALL">All Places</option>
          <option value="Public Hospital (GMC/DH)">Public Hospital (GMC/DH)</option>
          <option value="Private Hospital">Private Hospital</option>
          <option value="Home">Home</option>
          <option value="In Transit / On Road">In Transit / On Road</option>
        </select>
      </div>

      <div class="filter-group">
        <label for="filter-cause"><i class="fas fa-stethoscope"></i> Clinical Cause</label>
        <select id="filter-cause" class="filter-select">
          <option value="ALL">All Causes</option>
          <option value="Hemorrhage / PPH / Severe Anemia">Hemorrhage / PPH / Severe Anemia</option>
          <option value="Hypertensive Disorders / Eclampsia">Eclampsia / Hypertension</option>
          <option value="Sepsis & Severe Infections">Sepsis & Severe Infections</option>
          <option value="Cardiac Failure & Heart Disease">Cardiac Failure & Heart Disease</option>
          <option value="Hepatic / Liver Disorders">Hepatic / Liver Disorders</option>
        </select>
      </div>

      <div class="filter-group">
        <button id="btn-reset-filters" class="btn-reset-filters" title="Clear active filters">
          <i class="fas fa-undo"></i> Reset Filters
        </button>
      </div>
    `;
  }

  // Bind change listeners on dynamically added selects
  const dynamicSelects = container.querySelectorAll('select');
  dynamicSelects.forEach(sel => sel.addEventListener('change', onDynamicFilterChange));
  const resetBtn = document.getElementById('btn-reset-filters');
  if (resetBtn) resetBtn.addEventListener('click', resetAllFilters);
}

function onDynamicFilterChange() {
  const isCdr = appState.activeModule === 'CDR';
  if (isCdr) {
    appState.filters.sex = document.getElementById('filter-gender') ? document.getElementById('filter-gender').value : 'ALL';
  } else {
    appState.filters.deathTiming = document.getElementById('filter-timing') ? document.getElementById('filter-timing').value : 'ALL';
  }
  appState.filters.ageGroup = document.getElementById('filter-age-bracket') ? document.getElementById('filter-age-bracket').value : 'ALL';
  appState.filters.podGroup = document.getElementById('filter-place') ? document.getElementById('filter-place').value : 'ALL';
  appState.filters.causeCategory = document.getElementById('filter-cause') ? document.getElementById('filter-cause').value : 'ALL';

  appState.currentPage = 1;
  applyFilters();
}

function resetAllFilters() {
  appState.filters = {
    year: 'ALL',
    podGroup: 'ALL',
    category: 'ALL',
    ageGroup: 'ALL',
    causeCategory: 'ALL',
    sex: 'ALL',
    deathTiming: 'ALL',
    parity: 'ALL',
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
    if (f.podGroup !== 'ALL' && r.podGroup !== f.podGroup) return false;
    if (f.ageGroup !== 'ALL' && r.ageGroup !== f.ageGroup) return false;
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
                      (r.block && r.block.toLowerCase().includes(q)) ||
                      (r.placeOfDeath && r.placeOfDeath.toLowerCase().includes(q));
        if (!match) return false;
      } else {
        const match = (r.deceasedName && r.deceasedName.toLowerCase().includes(q)) ||
                      (r.cause && r.cause.toLowerCase().includes(q)) ||
                      (r.address && r.address.toLowerCase().includes(q)) ||
                      (r.placeOfDeath && r.placeOfDeath.toLowerCase().includes(q));
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

  if (isCdr) {
    if (f.sex !== 'ALL') chips.push(`Sex: ${f.sex}`);
  } else {
    if (f.deathTiming !== 'ALL') chips.push(`Timing: ${f.deathTiming}`);
  }
  if (f.ageGroup !== 'ALL') chips.push(`Age: ${f.ageGroup}`);
  if (f.podGroup !== 'ALL') chips.push(`Place: ${f.podGroup}`);
  if (f.causeCategory !== 'ALL') chips.push(`Cause: ${f.causeCategory}`);
  if (f.search) chips.push(`Search: "${f.search}"`);

  if (chips.length === 0) {
    const total = appState.filteredData.length;
    container.innerHTML = `<span style="font-size:0.75rem; color:var(--text-muted);">Showing all ${total} ${isCdr ? 'child deaths' : 'maternal deaths'} across registered years</span>`;
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

  // 4. Clinical Cause Classification Chart
  renderCausesChart(data, theme, isCdr);
}

// 1. Health Facility Wise Chart (Monthly / Yearly)
function renderFacilityChart(data, theme) {
  const facilities = ['GMC', 'IGGMC', 'DAGA', 'NMC (Urban)', 'Private Hospital', 'Home'];
  const mode = appState.temporalViews.facility || 'monthly';
  const ctx = document.getElementById('chart-facility').getContext('2d');
  if (appState.charts.facility) appState.charts.facility.destroy();

  if (mode === 'monthly') {
    const months = ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'];
    const datasets = facilities.map(fac => {
      const counts = months.map(m => {
        return data.filter(r => r.facility === fac && r.month && r.month.toLowerCase().startsWith(m.toLowerCase())).length;
      });
      return {
        label: fac,
        data: counts,
        backgroundColor: facilityColors[fac] || palette.blue,
        borderRadius: 4,
        stack: 'facilityStack'
      };
    });

    appState.charts.facility = new Chart(ctx, {
      type: 'bar',
      data: { labels: months, datasets: datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'top', labels: { color: theme.textColor, font: { size: 10, weight: '600' }, boxWidth: 10 } },
          tooltip: { backgroundColor: theme.tooltipBg, titleColor: theme.tooltipText, bodyColor: theme.tooltipText }
        },
        scales: {
          x: { grid: { display: false }, ticks: { color: theme.textColor, font: { size: 10 } } },
          y: { stacked: true, beginAtZero: true, grid: { color: theme.gridColor }, ticks: { color: theme.textColor } }
        }
      }
    });
  } else {
    // Yearly breakdown
    const years = ['2023-24', '2024-25', '2025-26', '2026-27'];
    const datasets = facilities.map(fac => {
      const counts = years.map(y => data.filter(r => r.facility === fac && r.year === y).length);
      return {
        label: fac,
        data: counts,
        backgroundColor: facilityColors[fac] || palette.blue,
        borderRadius: 4,
        stack: 'facilityYearStack'
      };
    });

    appState.charts.facility = new Chart(ctx, {
      type: 'bar',
      data: { labels: years, datasets: datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'top', labels: { color: theme.textColor, font: { size: 10, weight: '600' }, boxWidth: 10 } },
          tooltip: { backgroundColor: theme.tooltipBg, titleColor: theme.tooltipText, bodyColor: theme.tooltipText }
        },
        scales: {
          x: { grid: { display: false }, ticks: { color: theme.textColor, font: { size: 11, weight: '600' } } },
          y: { stacked: true, beginAtZero: true, grid: { color: theme.gridColor }, ticks: { color: theme.textColor } }
        }
      }
    });
  }
}

// 2. Area Wise Chart (NMC Urban, Rural, Other District, Other State)
function renderAreaChart(data, theme) {
  const areas = ['NMC (Urban)', 'Rural', 'Other District', 'Other State'];
  const mode = appState.temporalViews.area || 'monthly';
  const ctx = document.getElementById('chart-area').getContext('2d');
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
        borderRadius: 4,
        stack: 'areaStack'
      };
    });

    appState.charts.area = new Chart(ctx, {
      type: 'bar',
      data: { labels: months, datasets: datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'top', labels: { color: theme.textColor, font: { size: 10, weight: '600' }, boxWidth: 10 } },
          tooltip: { backgroundColor: theme.tooltipBg, titleColor: theme.tooltipText, bodyColor: theme.tooltipText }
        },
        scales: {
          x: { grid: { display: false }, ticks: { color: theme.textColor, font: { size: 10 } } },
          y: { stacked: true, beginAtZero: true, grid: { color: theme.gridColor }, ticks: { color: theme.textColor } }
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
        borderRadius: 4,
        stack: 'areaYearStack'
      };
    });

    appState.charts.area = new Chart(ctx, {
      type: 'bar',
      data: { labels: years, datasets: datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'top', labels: { color: theme.textColor, font: { size: 10, weight: '600' }, boxWidth: 10 } },
          tooltip: { backgroundColor: theme.tooltipBg, titleColor: theme.tooltipText, bodyColor: theme.tooltipText }
        },
        scales: {
          x: { grid: { display: false }, ticks: { color: theme.textColor, font: { size: 11, weight: '600' } } },
          y: { stacked: true, beginAtZero: true, grid: { color: theme.gridColor }, ticks: { color: theme.textColor } }
        }
      }
    });
  }
}

// 3. District Wise Analysis (In MDR and regional surveillance)
function renderDistrictChart(data, theme) {
  const mode = appState.temporalViews.district || 'yearly';
  const ctx = document.getElementById('chart-district').getContext('2d');
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
        plugins: {
          legend: { position: 'top', labels: { color: theme.textColor, font: { size: 10, weight: '600' }, boxWidth: 10 } },
          tooltip: { backgroundColor: theme.tooltipBg, titleColor: theme.tooltipText, bodyColor: theme.tooltipText }
        },
        scales: {
          x: { grid: { display: false }, ticks: { color: theme.textColor, font: { size: 10 } } },
          y: { beginAtZero: true, grid: { color: theme.gridColor }, ticks: { color: theme.textColor } }
        }
      }
    });
  } else {
    // Yearly / Rank-order bar chart
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
        plugins: {
          legend: { display: false },
          tooltip: { backgroundColor: theme.tooltipBg, titleColor: theme.tooltipText, bodyColor: theme.tooltipText }
        },
        scales: {
          x: { beginAtZero: true, grid: { color: theme.gridColor }, ticks: { color: theme.textColor } },
          y: { grid: { display: false }, ticks: { color: theme.textColor, font: { size: 10, weight: '600' } } }
        }
      }
    });
  }
}

// 4. Clinical Cause Classification Chart
function renderCausesChart(data, theme, isCdr) {
  const counts = {};
  data.forEach(r => {
    const c = r.causeCategory || 'Other / Unspecified';
    counts[c] = (counts[c] || 0) + 1;
  });

  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const labels = sorted.map(s => s[0]);
  const values = sorted.map(s => s[1]);

  const ctx = document.getElementById('chart-causes').getContext('2d');
  if (appState.charts.causes) appState.charts.causes.destroy();

  appState.charts.causes = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: 'Cases',
        data: values,
        backgroundColor: [
          palette.rose,
          palette.blue,
          palette.purple,
          palette.amber,
          palette.emerald,
          palette.cyan,
          palette.orange
        ],
        borderRadius: 6
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
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
        x: { beginAtZero: true, grid: { color: theme.gridColor }, ticks: { color: theme.textColor } },
        y: {
          grid: { display: false },
          ticks: {
            color: theme.textColor,
            font: { family: 'Plus Jakarta Sans', size: 10 },
            callback: function(val) {
              const label = this.getLabelForValue(val);
              return label.length > 25 ? label.substr(0, 25) + '...' : label;
            }
          }
        }
      }
    }
  });
}

function renderTrendChart(data, theme, isCdr) {
  const years = ['2023-24', '2024-25', '2025-26', '2026-27'];
  const counts = years.map(y => data.filter(r => r.year === y).length);

  const ctx = document.getElementById('chart-trend').getContext('2d');
  if (appState.charts.trend) appState.charts.trend.destroy();

  const accentColor = isCdr ? palette.indigo : palette.rose;

  appState.charts.trend = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: years,
      datasets: [{
        label: isCdr ? 'Child Deaths (CDR)' : 'Maternal Deaths (MDR)',
        data: counts,
        backgroundColor: accentColor,
        borderRadius: 8,
        barThickness: 45
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
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
        x: { grid: { display: false }, ticks: { color: theme.textColor, font: { family: 'Plus Jakarta Sans', weight: '600' } } },
        y: { beginAtZero: true, grid: { color: theme.gridColor }, ticks: { color: theme.textColor } }
      }
    }
  });
}

function renderCausesChart(data, theme, isCdr) {
  const counts = {};
  data.forEach(r => {
    const c = r.causeCategory || 'Other / Unspecified';
    counts[c] = (counts[c] || 0) + 1;
  });

  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const labels = sorted.map(s => s[0]);
  const values = sorted.map(s => s[1]);

  const ctx = document.getElementById('chart-causes').getContext('2d');
  if (appState.charts.causes) appState.charts.causes.destroy();

  appState.charts.causes = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: 'Demises',
        data: values,
        backgroundColor: [
          palette.rose,
          palette.blue,
          palette.purple,
          palette.amber,
          palette.emerald,
          palette.cyan,
          palette.orange
        ],
        borderRadius: 6
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
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
        x: { beginAtZero: true, grid: { color: theme.gridColor }, ticks: { color: theme.textColor } },
        y: {
          grid: { display: false },
          ticks: {
            color: theme.textColor,
            font: { family: 'Plus Jakarta Sans', size: 10 },
            callback: function(val) {
              const label = this.getLabelForValue(val);
              return label.length > 25 ? label.substr(0, 25) + '...' : label;
            }
          }
        }
      }
    }
  });
}

function renderPodChart(data, theme, isCdr) {
  const counts = {};
  data.forEach(r => {
    const p = r.podGroup || 'Hospital';
    counts[p] = (counts[p] || 0) + 1;
  });

  const labels = Object.keys(counts);
  const values = Object.values(counts);

  const ctx = document.getElementById('chart-pod').getContext('2d');
  if (appState.charts.pod) appState.charts.pod.destroy();

  appState.charts.pod = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: labels,
      datasets: [{
        data: values,
        backgroundColor: [palette.indigo, palette.blue, palette.rose, palette.emerald, palette.amber],
        borderWidth: 0
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'right', labels: { color: theme.textColor, font: { size: 10 }, boxWidth: 12 } },
        tooltip: {
          backgroundColor: theme.tooltipBg,
          titleColor: theme.tooltipText,
          bodyColor: theme.tooltipText,
          borderColor: theme.tooltipBorder,
          borderWidth: 1
        }
      },
      cutout: '68%'
    }
  });
}

function renderAgeBreakdownChart(data, theme, isCdr) {
  let labels = [];
  let counts = [];

  if (isCdr) {
    document.getElementById('chart-title-breakdown-1').innerHTML = '<i class="fas fa-baby" style="color:var(--accent-amber);"></i> Child Age at Demise';
    document.getElementById('chart-sub-breakdown-1').textContent = 'Early Neonatal vs Late Neonatal vs Child stages';
    labels = ['Day 0-1', '1-7 Days', '8-28 Days', '1-12 Mos', '1-5 Yrs'];
    const groups = [
      'Day 0 - 1 (<24-48h)',
      'Early Neonatal (1-7 Days)',
      'Late Neonatal (8-28 Days)',
      'Post-Neonatal (1-12 Months)',
      'Child (1 - 5 Years)'
    ];
    counts = groups.map(g => data.filter(r => r.ageGroup === g).length);
  } else {
    document.getElementById('chart-title-breakdown-1').innerHTML = '<i class="fas fa-female" style="color:var(--accent-amber);"></i> Mother Age Demographics';
    document.getElementById('chart-sub-breakdown-1').textContent = 'Adolescent and maternal age brackets';
    labels = ['< 20 Yrs', '20-24 Yrs', '25-29 Yrs', '30-34 Yrs', '35+ Yrs'];
    const groups = ['< 20 Yrs (Adolescent)', '20 - 24 Yrs', '25 - 29 Yrs', '30 - 34 Yrs', '35+ Yrs'];
    counts = groups.map(g => data.filter(r => r.ageGroup === g).length);
  }

  const ctx = document.getElementById('chart-breakdown-1').getContext('2d');
  if (appState.charts.breakdown1) appState.charts.breakdown1.destroy();

  appState.charts.breakdown1 = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        data: counts,
        backgroundColor: [palette.rose, palette.orange, palette.amber, palette.indigo, palette.emerald],
        borderRadius: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { display: false }, ticks: { color: theme.textColor, font: { size: 10 } } },
        y: { beginAtZero: true, grid: { color: theme.gridColor }, ticks: { color: theme.textColor } }
      }
    }
  });
}

function renderSecondaryBreakdownChart(data, theme, isCdr) {
  let labels = [];
  let counts = [];

  if (isCdr) {
    document.getElementById('chart-title-breakdown-2').innerHTML = '<i class="fas fa-balance-scale" style="color:var(--accent-emerald);"></i> Birth Weight Profile';
    document.getElementById('chart-sub-breakdown-2').textContent = 'ELBW (<1kg), VLBW (1-1.5kg), LBW (1.5-2.5kg), Normal';
    labels = ['<1000g', '1-1.5kg', '1.5-2.5kg', '>=2.5kg', 'Unknown'];
    const groups = ['ELBW (<1000g)', 'VLBW (1000-1499g)', 'LBW (1500-2499g)', 'Normal (>=2500g)', 'Unknown'];
    counts = groups.map(g => data.filter(r => r.birthWeightCategory === g).length);
  } else {
    document.getElementById('chart-title-breakdown-2').innerHTML = '<i class="fas fa-clock" style="color:var(--accent-emerald);"></i> Demise Timing in Pregnancy';
    document.getElementById('chart-sub-breakdown-2').textContent = 'Antepartum (ANC), Intrapartum, Postpartum (PNC)';
    labels = ['Postpartum (PNC)', 'Antepartum (ANC)', 'Intrapartum (Delivery)', 'Unspecified'];
    counts = labels.map(l => data.filter(r => r.deathTiming === l).length);
  }

  const ctx = document.getElementById('chart-breakdown-2').getContext('2d');
  if (appState.charts.breakdown2) appState.charts.breakdown2.destroy();

  appState.charts.breakdown2 = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        data: counts,
        backgroundColor: [palette.purple, palette.blue, palette.amber, palette.emerald, palette.rose],
        borderRadius: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { display: false }, ticks: { color: theme.textColor, font: { size: 10 } } },
        y: { beginAtZero: true, grid: { color: theme.gridColor }, ticks: { color: theme.textColor } }
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
