$baseUrl = "https://docs.google.com/spreadsheets/d/e/2PACX-1vTYY8-MSo8PZnT8ooA_suhCPM5aXPP4pOztl0UcHJWbkdlaSYNgqdA28uzQtny5sQgwX-D0wnWnxc_b/pub"
$htmlUrl = "$baseUrl`html"

Write-Host "Fetching Google Sheet published structure..."
$resp = Invoke-WebRequest -Uri $htmlUrl -UseBasicParsing
$content = $resp.Content

$tabs = @()
$matches = [regex]::Matches($content, 'itemid="sheet-button-([0-9]+)"[^>]*>([^<]+)<')
foreach ($m in $matches) {
    $gid = $m.Groups[1].Value
    $name = $m.Groups[2].Value.Trim()
    $tabs += [PSCustomObject]@{
        Name = $name
        Gid = $gid
    }
}

if ($tabs.Count -eq 0) {
    $matches2 = [regex]::Matches($content, 'name:\s*"([^"]+)",\s*pageUrl:[^}]+gid=([0-9]+)')
    foreach ($m in $matches2) {
        $gid = $m.Groups[2].Value
        $name = $m.Groups[1].Value.Trim()
        $tabs += [PSCustomObject]@{
            Name = $name
            Gid = $gid
        }
    }
}

Write-Host "Found $($tabs.Count) tabs:"
$tabs | Format-Table -AutoSize

# Download each sheet as CSV
$downloadDir = "d:\Dashboard\AIl Dashboard\CDR-MDR\data"
foreach ($t in $tabs) {
    $csvUrl = "$baseUrl`?gid=$($t.Gid)&single=true&output=csv"
    $destFile = Join-Path $downloadDir "sheet_$($t.Gid).csv"
    Write-Host "Downloading $($t.Name) (GID $($t.Gid))..."
    try {
        Invoke-WebRequest -Uri $csvUrl -OutFile $destFile -UseBasicParsing
        $fi = Get-Item $destFile
        Write-Host "Saved $($t.Name) -> $destFile ($($fi.Length) bytes)"
    } catch {
        Write-Host "Error downloading $($t.Name): $($_.Exception.Message)"
    }
}
Write-Host "All sheets downloaded successfully!"
