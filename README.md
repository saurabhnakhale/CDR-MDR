# CDR & MDR Public Health Mortality Surveillance Dashboard

[![Live Dashboard](https://img.shields.io/badge/Live%20Dashboard-Visit%20App-success?style=for-the-badge&logo=github)](https://saurabhnakhale.github.io/CDR-MDR/)

🔗 **Live URL**: **[https://saurabhnakhale.github.io/CDR-MDR/](https://saurabhnakhale.github.io/CDR-MDR/)**

Interactive Public Health Mortality Surveillance Dashboard analyzing **Child Death Review (CDR)** and **Maternal Death Review (MDR)** datasets for Nagpur Division across financial years 2023–2027.

Connected to live Google Sheets data:
`https://docs.google.com/spreadsheets/d/e/2PACX-1vTYY8-MSo8PZnT8ooA_suhCPM5aXPP4pOztl0UcHJWbkdlaSYNgqdA28uzQtny5sQgwX-D0wnWnxc_b/pub?output=csv`

---

## 🌟 Key Features

- **Dual-Program Surveillance Switcher**:
  - **Child Death Review (CDR)**: 1,886 audited child deaths across FY 2023–2027.
  - **Maternal Death Review (MDR)**: 417 audited maternal deaths across FY 2023–2027.
- **Executive Metric Cards (KPIs)**:
  - Total audited deaths, neonatal mortality (&le;28 days), gender ratio, institutional vs. home demises, low birth weight (<2.5kg) rates, and leading clinical cause factors.
  - Maternal mortality indicators: Postpartum (PNC) vs Antepartum (ANC) deaths, PPH / hemorrhage, eclampsia, and tertiary care referral rates.
- **Dynamic Chart.js Visualizations**:
  - Longitudinal mortality trends by financial year (2023–24, 2024–25, 2025–26, 2026–27).
  - Categorized clinical causes of death (Sepsis, RDS/Pneumonia, Congenital anomalies, Birth Asphyxia, PPH, Eclampsia).
  - Place of death distribution (GMC Nagpur, IGGMC, Daga, Private facilities, Home).
  - Age demographic risk profile (Early Neonatal, Late Neonatal, Post-Neonatal, Under-5 / Maternal age brackets).
  - Birth weight risk stratification (ELBW, VLBW, LBW, Normal).
- **Multi-Filter Surveillance Toolbar**:
  - Year selector chips (`All Years`, `2023-24`, `2024-25`, `2025-26`, `2026-27`).
  - Dropdown filters for gender, age brackets, place of death, clinical cause categories, and pregnancy timing.
- **Case Explorer & Investigation Audit Modal**:
  - Searchable, paginated case surveillance records.
  - Detailed modal audit sheet showing mother/child identity, village/area, birth weight, immunization status, CBCDR assigned findings, and dates.
  - One-click CSV export of any filtered dataset view.
- **Executive Dark & Light Mode**: Built with responsive CSS variables and glassmorphism styling.

---

## 📁 Repository Structure

```
.
├── index.html                  # Main dashboard application
├── css/
│   └── dashboard.css           # Executive responsive styling & design system
├── js/
│   └── app.js                  # Analytics engine, Chart.js integrations, filters & modals
├── data/
│   ├── dataset_all.json        # Compiled dataset across all 8 sheets (2,303 records)
│   ├── dataset.json            # Baseline 2023-24 records
│   ├── data_cdr_mdr.csv        # Raw initial CSV download
│   └── sheet_*.csv             # Raw extracted CSVs for all 8 worksheets
├── server.ps1                  # Lightweight local HTTP server (PowerShell)
└── README.md                   # Documentation & quickstart guide
```

---

## 🚀 Quick Start / Local Setup

### Option 1: Direct in Browser
Simply double-click `index.html` or open it in Chrome, Edge, or Firefox.

### Option 2: Local HTTP Server
Run the included PowerShell server script:
```powershell
powershell -ExecutionPolicy Bypass -File .\server.ps1
```
Then visit: `http://localhost:8088/index.html`

---

## 👥 Author & Repository
- **GitHub Profile**: [@saurabhnakhale](https://github.com/saurabhnakhale)
- **Project**: CDR & MDR Mortality Surveillance Dashboard
