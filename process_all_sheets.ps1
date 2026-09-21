# Enhanced Multi-Worksheet Unified Processor for CDR & MDR
$cdrSheets = @(
    @{ Name = "CDR 23-24"; Gid = "185476409"; Year = "2023-24" },
    @{ Name = "CDR 24-25"; Gid = "1166650958"; Year = "2024-25" },
    @{ Name = "CDR 25-26"; Gid = "713354507"; Year = "2025-26" },
    @{ Name = "CDR 26-27"; Gid = "1478695836"; Year = "2026-27" }
)

$mdrSheets = @(
    @{ Name = "MDR 23-24"; Gid = "2012130671"; Year = "2023-24" },
    @{ Name = "MDR 24-25"; Gid = "416132890"; Year = "2024-25" },
    @{ Name = "MDR 25-26"; Gid = "481951976"; Year = "2025-26" },
    @{ Name = "MDR 26-27"; Gid = "1127478700"; Year = "2026-27" }
)

# Known districts in Vidarbha / Maharashtra and neighbor states
$districtsList = @("Nagpur", "Gondia", "Gondiya", "Bhandara", "Wardha", "Chandrapur", "Gadchiroli", "Amravati", "Yavatmal", "Akola", "Washim", "Buldhana", "Chhindwara", "Balaghat", "Seoni", "Betul", "Jabalpur")
$otherStates = @("Madhya Pradesh", "MP", "M.P.", "Chhindwara", "Balaghat", "Seoni", "Betul", "Chhattisgarh", "Telangana")

function Classify-Facility($pod, $block, $birthPlace) {
    $text = "$pod $block $birthPlace".ToUpper()
    if ($text -match '\bHOME\b') {
        return "Home"
    } elseif ($text -match '\bIGGMC\b|INDIRA GANDHI|MAYO') {
        return "IGGMC"
    } elseif ($text -match '\bDAGA\b') {
        return "DAGA"
    } elseif ($text -match '\bGMC\b|GMCH|GOVT MEDICAL') {
        return "GMC"
    } elseif ($text -match '\bUPHC\b|NMC|ZONE|CORPORATION|URBAN PHC|MUNICIPAL') {
        return "NMC (Urban)"
    } elseif ($text -match 'PRIVATE|NELSON|SEVAN|JAIN|MOGRE|NEW CARE|RAHIMI|JISWAL|CENTRAL|NEW ERA|LATA|KRIMS|CARE|HOSPITAL|NURSING') {
        return "Private Hospital"
    }
    return "GMC"
}

function Classify-Area($address, $village, $areaType, $district) {
    $text = "$address $village $areaType $district".ToUpper()
    
    # Check Other State
    if ($text -match 'MADHYA PRADESH|\bMP\b|\bM\.P\b|CHHINDWARA|BALAGHAT|SEONI|BETUL|CHHATTISGARH|TELANGANA') {
        return "Other State"
    }
    # Check Other District
    if ($text -match 'GONDIA|GONDIYA|BHANDARA|WARDHA|CHANDRAPUR|GADCHIROLI|AMRAVATI|YAVATMAL|AKOLA|WASHIM|BULDHANA') {
        return "Other District"
    }
    # Check Rural
    if ($text -match '\bRURAL\b|GRAMIN|RURAL AREA') {
        return "Rural"
    }
    # Default is NMC (Urban) for Nagpur city records
    return "NMC (Urban)"
}

$monthNames = @("Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec")

function Parse-MdrReportingMonth($dodStr, $reviewStr, $defaultMonth = "Apr") {
    $clean = ($dodStr -replace '\s+', ' ').Trim()
    
    # 1. Textual month names (e.g. 15-Apr-2024 or April 2024)
    if ($clean -match '(?i)\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|January|February|March|April|May|June|July|August|September|October|November|December)\b') {
        $mStr = $matches[1].Substring(0, 3)
        return ($mStr.Substring(0,1).ToUpper() + $mStr.Substring(1,2).ToLower())
    }
    
    # 2. Date with DD/MM/YYYY, DD.MM.YYYY, DD-MM-YYYY allowing internal extra dots/spaces
    if ($clean -match '^\s*(\d{1,2})[\/\.\s]+(\d{1,2})[\/\.\s]+(\d{2,4})') {
        $mNum = [int]$matches[2]
        if ($mNum -ge 1 -and $mNum -le 12) {
            return $monthNames[$mNum - 1]
        }
    }

    # 3. Fallback: check Date of Review if present
    if ($reviewStr) {
        $cleanRev = ($reviewStr -replace '\s+', ' ').Trim()
        if ($cleanRev -match '(?i)\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|January|February|March|April|May|June|July|August|September|October|November|December)\b') {
            $mStr = $matches[1].Substring(0, 3)
            return ($mStr.Substring(0,1).ToUpper() + $mStr.Substring(1,2).ToLower())
        }
        if ($cleanRev -match '^\s*(\d{1,2})[\/\.\s]+(\d{1,2})[\/\.\s]+(\d{2,4})') {
            $mNum = [int]$matches[2]
            if ($mNum -ge 1 -and $mNum -le 12) {
                return $monthNames[$mNum - 1]
            }
        }
    }

    return $defaultMonth
}

$allCdr = @()
foreach ($s in $cdrSheets) {
    $filePath = "d:\Dashboard\AIl Dashboard\CDR-MDR\data\sheet_$($s.Gid).csv"
    if (Test-Path $filePath) {
        $rows = Import-Csv -Path $filePath
        foreach ($r in $rows) {
            $child = $r.'2. Name'
            if (-not $child) { $child = $r.'Child Name' }
            $mother = $r.'3. Mother''s Name'
            if (-not $mother) { $mother = $r.'Mother''s Name' }
            if ((-not $child -or $child.Trim() -eq '') -and (-not $mother -or $mother.Trim() -eq '')) { continue }

            $rawAge = ($r.Age -replace '\r|\n', ' ').Trim()
            $ageGroup = "Unknown"
            $ageDays = -1
            if ($rawAge -match '(\d+(?:\.\d+)?)\s*(?:day|days|daya|dol)' -or $rawAge -match 'day\s*(\d+)' -or $rawAge -match 'dol-(\d+)') {
                $ageDays = [float]$matches[1]
            } elseif ($rawAge -match '(\d+(?:\.\d+)?)\s*(?:hor|hors|hrs|hours|hr|min|minute)') {
                $ageDays = 0.5
            } elseif ($rawAge -match '(\d+(?:\.\d+)?)\s*(?:month|months|mth|mnth)') {
                $ageDays = [float]$matches[1] * 30.4
            } elseif ($rawAge -match '(\d+(?:\.\d+)?)\s*(?:year|years|yrs|yr)') {
                $ageDays = [float]$matches[1] * 365
            }

            if ($ageDays -ge 0) {
                if ($ageDays -le 1) { $ageGroup = "Day 0 - 1 (<24-48h)" }
                elseif ($ageDays -le 7) { $ageGroup = "Early Neonatal (1-7 Days)" }
                elseif ($ageDays -le 28) { $ageGroup = "Late Neonatal (8-28 Days)" }
                elseif ($ageDays -le 365) { $ageGroup = "Post-Neonatal (1-12 Months)" }
                else { $ageGroup = "Child (1 - 5 Years)" }
            }

            $cause = $r.'21. Assigned Cause of Death / Final Diagnosis'
            if (-not $cause) { $cause = $r.'Assigned Cause of Death' }
            if (-not $cause) { $cause = $r.'16. Probable Cause of Death' }
            if (-not $cause) { $cause = $r.'24. Cause of Death Assigned in CBCDR' }
            $cause = ($cause -replace '\r|\n', ' ').Trim()

            $cu = $cause.ToUpper()
            $causeCategory = "Other / Unspecified"
            if ($cu -match 'SEPSIS|SEPTIC|SEPTICEMIA') { $causeCategory = "Sepsis & Septic Shock" }
            elseif ($cu -match 'RESPIRATORY|RDS|HMD|HYALINE|PNEUMONIA|LUNGS|PLEURAL|PNEUMOTHORAX') { $causeCategory = "Respiratory / RDS / Pneumonia" }
            elseif ($cu -match 'PRETERM|LBW|LOW BIRTH WEIGHT|ELBW|VLBW|PREMATURITY|IUGR') { $causeCategory = "Prematurity & Low Birth Weight" }
            elseif ($cu -match 'CONGENITAL|HEART|CARDIAC|CHD|CARDIOMYOPATHY|ANOMALY|ATRESIA') { $causeCategory = "Congenital Anomalies & Heart Diseases" }
            elseif ($cu -match 'ASPHYXIA|HIE|HYPOXIA|MECONIUM|ASPIRATION|ASPIRALION') { $causeCategory = "Birth Asphyxia & Aspiration" }
            elseif ($cu -match 'BURN|BLAST|ACCIDENT') { $causeCategory = "Injury / Accidental" }
            elseif ($cu -match 'FEVER|FIVER|ILLNESS|COLD|EILKNESS|LEUKEMIA|DIABETIS') { $causeCategory = "Infections & Illness" }

            $rawBw = $r.'11. Birth Weight (gm)'
            if (-not $rawBw) { $rawBw = $r.'Birth Weight (gm)' }
            $rawBw = ($rawBw -replace '\r|\n', ' ').Trim()
            $weightGrams = $null
            if ($rawBw -match '(\d+(?:\.\d+)?)\s*(?:kg|k\.g|kgs)') {
                $weightGrams = [math]::Round([float]$matches[1] * 1000)
            } elseif ($rawBw -match '(\d+(?:\.\d+)?)\s*(?:gm|gms|grms|g|gram|grams)') {
                $weightGrams = [math]::Round([float]$matches[1])
            } elseif ($rawBw -match '^\d{3,4}$') {
                $weightGrams = [int]$rawBw
            } elseif ($rawBw -match '^([1-5](?:\.\d+)?)$') {
                $weightGrams = [math]::Round([float]$matches[1] * 1000)
            }

            $weightCategory = "Unknown"
            if ($weightGrams) {
                if ($weightGrams -lt 1000) { $weightCategory = "ELBW (<1000g)" }
                elseif ($weightGrams -lt 1500) { $weightCategory = "VLBW (1000-1499g)" }
                elseif ($weightGrams -lt 2500) { $weightCategory = "LBW (1500-2499g)" }
                else { $weightCategory = "Normal (>=2500g)" }
            }

            $pod = ($r.'Place of Death' -replace '\r|\n', ' ').Trim()
            $block = $r.'Name of the Block'
            if (-not $block) { $block = $r.'Block Name' }
            $birthPlace = ($r.'Place of Birth' -replace '\r|\n', ' ').Trim()

            # Health Facility exact 6 classifications: GMC, IGGMC, DAGA, NMC (Urban), Private Hospital, Home
            $facility = Classify-Facility $pod $block $birthPlace

            # Month & Date
            $month = $r.Month
            if (-not $month) { $month = $r.'Month ' }
            $dod = $r.'14. Date of Death (DD/MM/YYYY)'
            if (-not $dod) { $dod = $r.'Date of Death' }

            $village = $r.'7. Village'
            if (-not $village) { $village = $r.Village }
            $areaType = ($r.'Urban/Rural/ Other State/ Other Dist.' -replace '\r|\n', ' ').Trim()

            # Area exact 4 classifications: NMC (Urban), Rural, Other District, Other State
            $areaCategory = Classify-Area "" $village $areaType ""

            $allCdr += [PSCustomObject]@{
                recordType = "CDR"
                year = $s.Year
                sheetName = $s.Name
                srNo = $r.'Sr. No.'
                block = ($block -replace '\r|\n', ' ').Trim()
                month = ($month -replace '\r|\n', ' ').Trim()
                childName = ($child -replace '\r|\n', ' ').Trim()
                motherName = ($mother -replace '\r|\n', ' ').Trim()
                sex = (($r.Sex -replace '\r|\n', ' ').Trim()).ToUpper()
                category = (($r.Category -replace '\r|\n', ' ').Trim()).ToUpper()
                rawAge = $rawAge
                ageDays = $ageDays
                ageGroup = $ageGroup
                village = ($village -replace '\r|\n', ' ').Trim()
                areaType = $areaType
                areaCategory = $areaCategory
                facility = $facility
                placeOfDeath = $pod
                podGroup = $facility
                birthPlace = $birthPlace
                rawBirthWeight = $rawBw
                birthWeightGrams = $weightGrams
                birthWeightCategory = $weightCategory
                deathDate = ($dod -replace '\r|\n', ' ').Trim()
                cause = $cause
                causeCategory = $causeCategory
            }
        }
    }
}
Write-Host "CDR Loaded: $($allCdr.Count)"

$allMdr = @()
foreach ($s in $mdrSheets) {
    $filePath = "d:\Dashboard\AIl Dashboard\CDR-MDR\data\sheet_$($s.Gid).csv"
    if (Test-Path $filePath) {
        $rawLines = Get-Content -Path $filePath
        $headerLine = -1
        for ($i = 0; $i -lt [math]::Min(15, $rawLines.Count); $i++) {
            if ($rawLines[$i] -match 'Name of Deceased Women') {
                $headerLine = $i
                break
            }
        }
        if ($headerLine -ge 0) {
            $mdrContent = ($rawLines[$headerLine..($rawLines.Count - 1)]) -join "`n"
            $mdrRows = ConvertFrom-Csv -InputObject $mdrContent -ErrorAction SilentlyContinue

            foreach ($m in $mdrRows) {
                $name = $m.'Name of Deceased Women'
                if (-not $name -or $name.Trim() -eq '' -or $name -match '^\d+$' -or $name -match '^Name') { continue }

                $age = ($m.Age -replace '\r|\n', ' ').Trim()
                $ageNum = 0
                if ($age -match '(\d+)') { $ageNum = [int]$matches[1] }

                $ageGroup = "Unknown"
                if ($ageNum -gt 0) {
                    if ($ageNum -lt 20) { $ageGroup = "< 20 Yrs (Adolescent)" }
                    elseif ($ageNum -le 24) { $ageGroup = "20 - 24 Yrs" }
                    elseif ($ageNum -le 29) { $ageGroup = "25 - 29 Yrs" }
                    elseif ($ageNum -le 34) { $ageGroup = "30 - 34 Yrs" }
                    else { $ageGroup = "35+ Yrs" }
                }

                $cause = $m.'Clinical cause of death (ICD10)'
                if (-not $cause) { $cause = $m.'Cause of Death' }
                $cause = ($cause -replace '\r|\n', ' ').Trim()

                $cu = $cause.ToUpper()
                $causeCategory = "Other Medical Conditions"
                if ($cu -match 'HEMORRHAGE|BLEED|PPH|APH|ANEMIA|SHOCK') { $causeCategory = "Hemorrhage / PPH / Severe Anemia" }
                elseif ($cu -match 'ECLAMPSIA|PREECLAMPSIA|HYPERTENSION|BP') { $causeCategory = "Hypertensive Disorders / Eclampsia" }
                elseif ($cu -match 'SEPSIS|SEPTIC|INFECTION|PNEUMONIA|COVID|MENINGITIS') { $causeCategory = "Sepsis & Severe Infections" }
                elseif ($cu -match 'HEART|CARDIAC|CARDIOMYOPATHY|ARREST') { $causeCategory = "Cardiac Failure & Heart Disease" }
                elseif ($cu -match 'HEPATIC|LIVER|JAUNDICE') { $causeCategory = "Hepatic / Liver Disorders" }

                $timing = ($m.'Death during ANC / Intranatal / PNC' -replace '\r|\n', ' ').Trim().ToUpper()
                $timingGroup = "Other / Unspecified"
                if ($timing -match 'PNC') { $timingGroup = "Postpartum (PNC)" }
                elseif ($timing -match 'ANC') { $timingGroup = "Antepartum (ANC)" }
                elseif ($timing -match 'INTRA') { $timingGroup = "Intrapartum (Delivery)" }

                $pod = ($m.'Place of Death SC/PHC/RH/SDH/GH/WH/DH/GMC/Private Medical College/Corporation Hospital/Private Hospital/Home/On Road' -replace '\r|\n', ' ').Trim()
                $facility = Classify-Facility $pod "" ""

                # Extract District for MDR
                $addr = ($m.Address -replace '\r|\n', ' ').Trim()
                $distRaw = ($m.'District as per Residence' -replace '\r|\n', ' ').Trim()
                $district = "Nagpur"

                if ($distRaw -and $distRaw.Trim() -ne '' -and $distRaw -ne '_') {
                    $district = $distRaw.Trim()
                } else {
                    # Search inside Address
                    foreach ($dName in $districtsList) {
                        if ($addr -match "(?i)\b$dName\b") {
                            $district = $dName
                            break
                        }
                    }
                }
                # Normalize district naming
                if ($district -match '(?i)Gondia|Gondiya') { $district = "Gondia" }
                elseif ($district -match '(?i)Nagpur') { $district = "Nagpur" }
                elseif ($district -match '(?i)Bhandara') { $district = "Bhandara" }
                elseif ($district -match '(?i)Wardha') { $district = "Wardha" }
                elseif ($district -match '(?i)Chandrapur') { $district = "Chandrapur" }
                elseif ($district -match '(?i)Gadchiroli') { $district = "Gadchiroli" }
                elseif ($district -match '(?i)Amravati') { $district = "Amravati" }
                elseif ($district -match '(?i)Yavatmal') { $district = "Yavatmal" }
                elseif ($district -match '(?i)Washim') { $district = "Washim" }
                elseif ($district -match '(?i)Akola') { $district = "Akola" }
                elseif ($district -match '(?i)Chhindwara') { $district = "Chhindwara (MP)" }
                elseif ($district -match '(?i)Balaghat') { $district = "Balaghat (MP)" }
                elseif ($district -match '(?i)Seoni') { $district = "Seoni (MP)" }
                elseif ($district -match '(?i)Betul') { $district = "Betul (MP)" }

                # Area Classification
                $areaCategory = Classify-Area $addr "" "" $district

                # Extract reporting month for MDR from Date of Death or Date of Review
                $dod = ($m.'Date of Death' -replace '\r|\n', ' ').Trim()
                $reviewDate = ($m.'Date of Review by HOM' -replace '\r|\n', ' ').Trim()
                $month = Parse-MdrReportingMonth $dod $reviewDate "Apr"

                $allMdr += [PSCustomObject]@{
                    recordType = "MDR"
                    year = $s.Year
                    sheetName = $s.Name
                    srNo = $m.'Sr. No.'
                    deceasedName = ($name -replace '\r|\n', ' ').Trim()
                    age = $age
                    ageNum = $ageNum
                    ageGroup = $ageGroup
                    address = $addr
                    district = $district
                    areaCategory = $areaCategory
                    facility = $facility
                    caste = (($m.'Caste(SC/ST/Others)' -replace '\r|\n', ' ').Trim()).ToUpper()
                    deathDate = $dod
                    month = $month
                    placeOfDeath = $pod
                    podGroup = $facility
                    deathTiming = $timingGroup
                    cause = $cause
                    causeCategory = $causeCategory
                    delayType = ($m.'Type of Delay 1/2/3' -replace '\r|\n', ' ').Trim()
                    haemoglobin = ($m.'Last reported Haemoglobin (Hb)' -replace '\r|\n', ' ').Trim()
                }
            }
        }
    }
}
Write-Host "MDR Loaded: $($allMdr.Count)"

$combined = @{
    cdr = $allCdr
    mdr = $allMdr
    meta = @{
        totalCdr = $allCdr.Count
        totalMdr = $allMdr.Count
        facilities = @("GMC", "IGGMC", "DAGA", "NMC (Urban)", "Private Hospital", "Home")
        areas = @("NMC (Urban)", "Rural", "Other District", "Other State")
        years = @("2023-24", "2024-25", "2025-26", "2026-27")
        generatedAt = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
    }
}

$json = $combined | ConvertTo-Json -Depth 6
[System.IO.File]::WriteAllText("d:\Dashboard\AIl Dashboard\CDR-MDR\data\dataset_all.json", $json, [System.Text.Encoding]::UTF8)
Write-Host "Re-generated dataset_all.json successfully!"
