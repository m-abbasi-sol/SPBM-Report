# =============================================================================
#
# SCRIPT:         Generate Bandwidth Report
#
# DESCRIPTION:    Generates an interactive HTML report of user bandwidth usage
#                 from a 'Bandwidth Manager' SQLite database.
#
# =============================================================================

# =============================================================================
# SECTION 1: SCRIPT PARAMETERS
# Define configurable inputs for the script.
# =============================================================================
param (
    [string[]]$ExcludedUsers = @('Admins', 'Automation-PC', 'LocalHost', '512/256 KB', 'LocalHost - OUT', 'LocalHost - IN'),
    [string]$DbPath = "Bandwidth Manager.DB",
    [string]$BaseReportsPath = ".\Reports",
    [string]$ToolsFolder = "Report Tools", # Path to folder containing report_template.html, report_app.js, and libraries
    [string]$UserNamesFile = "user_names.txt" # Path to the file containing user ID to real name mappings
)

# =============================================================================
# SECTION 2: HELPER FUNCTIONS
# Contains reusable helper functions used throughout the script.
# =============================================================================

# -----------------------------------------------------------------------------
# Function: Test-DateFormat
# Description: Validates if a string is in 'yyyy-MM-dd' format.
# -----------------------------------------------------------------------------
function Test-DateFormat {
    param ([string]$DateString)
    try {
        [datetime]::ParseExact($DateString, "yyyy-MM-dd", $null) | Out-Null
        return $true
    }
    catch {
        return $false
    }
}

# =============================================================================
# SECTION 3: CORE SCRIPT LOGIC
# Main execution block of the script.
# =============================================================================

# Get the directory where the current script is located
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition

# Resolve full paths based on the script's directory
$ResolvedDbPath = Join-Path -Path $ScriptDir -ChildPath $DbPath
$ResolvedToolsFolder = Join-Path -Path $ScriptDir -ChildPath $ToolsFolder
$ResolvedUserNamesFilePath = Join-Path -Path $ResolvedToolsFolder -ChildPath $UserNamesFile
$ResolvedHtmlTemplatePath = Join-Path -Path $ResolvedToolsFolder -ChildPath "report_template.html"
$ResolvedReportAppJsPath = Join-Path -Path $ResolvedToolsFolder -ChildPath "report_app.js"
$ResolvedShamsiConverterJsPath = Join-Path -Path $ResolvedToolsFolder -ChildPath "shamsi-converter.js"
$ResolvedPrintCssPath = Join-Path -Path $ResolvedToolsFolder -ChildPath "print-styles.css"


# -----------------------------------------------------------------------------
# Dynamically set StartDate and EndDate to the last year (365 days)
# -----------------------------------------------------------------------------
$EndDate = (Get-Date).ToString("yyyy-MM-dd")
$StartDate = (Get-Date).AddDays(-365).ToString("yyyy-MM-dd") # Fetch data for the last 365 days (one year)

# -----------------------------------------------------------------------------
# Prerequisites Check & Input Validation
# -----------------------------------------------------------------------------
if (-not (Get-Command sqlite3 -ErrorAction SilentlyContinue)) {
    Write-Error "The 'sqlite3' command was not found. Please ensure SQLite3 is installed and available in your system's PATH."
    exit
}
if (-not (Test-DateFormat $StartDate)) { Write-Error "Invalid StartDate format ($StartDate). Please use yyyy-MM-dd format."; exit }
if (-not (Test-DateFormat $EndDate)) { Write-Error "Invalid EndDate format ($EndDate). Please use yyyy-MM-dd format."; exit }
if (-not (Test-Path $ResolvedDbPath)) { Write-Error "Database file not found at: $ResolvedDbPath"; exit }
if (-not (Test-Path $ResolvedToolsFolder)) { Write-Error "Tools folder not found at: $ResolvedToolsFolder"; exit }
if (-not (Test-Path $ResolvedUserNamesFilePath)) { Write-Error "User names file not found at: $ResolvedUserNamesFilePath. Please create 'user_names.txt' in your 'Report Tools' folder."; exit }
if (-not (Test-Path $ResolvedHtmlTemplatePath)) { Write-Error "HTML template file not found at: $ResolvedHtmlTemplatePath. Please create 'report_template.html' in your 'Report Tools' folder."; exit }
if (-not (Test-Path $ResolvedReportAppJsPath)) { Write-Error "Report App JS file not found at: $ResolvedReportAppJsPath. Please create 'report_app.js' in your 'Report Tools' folder."; exit }
if (-not (Test-Path $ResolvedShamsiConverterJsPath)) { Write-Error "Shamsi Converter JS file not found at: $ResolvedShamsiConverterJsPath. Please create 'shamsi-converter.js' in your 'Report Tools' folder."; exit }
if (-not (Test-Path $ResolvedPrintCssPath)) { Write-Error "Print Styles CSS file not found at: $ResolvedPrintCssPath. Please create 'print-styles.css' in your 'Report Tools' folder."; exit }


# -----------------------------------------------------------------------------
# Build Report Paths and Folders
# -----------------------------------------------------------------------------
$timestamp = Get-Date -Format "yyyy.MM.dd HH.mm.ss"
$ResolvedBaseReportsPath = Join-Path -Path $ScriptDir -ChildPath $BaseReportsPath

$dynamicReportFolder = Join-Path -Path (Join-Path -Path $ResolvedBaseReportsPath -ChildPath "HTML") -ChildPath $timestamp
$assetsFolder = Join-Path -Path $dynamicReportFolder -ChildPath "assets" # Create assets folder inside report folder
$libFolder = Join-Path -Path $assetsFolder -ChildPath "lib" # Create lib folder inside assets folder
$cssFolder = Join-Path -Path $assetsFolder -ChildPath "css"
$fontsFolder = Join-Path -Path $assetsFolder -ChildPath "fonts"

$OutputHtml = Join-Path -Path $dynamicReportFolder -ChildPath "report.html"
$OutputDataJs = Join-Path -Path $assetsFolder -ChildPath "data.js" # data.js goes inside assets folder


# Create directories
New-Item -Path $dynamicReportFolder -ItemType Directory -Force -ErrorAction Stop | Out-Null
New-Item -Path $assetsFolder -ItemType Directory -Force -ErrorAction Stop | Out-Null # Create assets folder
New-Item -Path $libFolder -ItemType Directory -Force -ErrorAction Stop | Out-Null # Create lib folder
New-Item -Path $cssFolder -ItemType Directory -Force -ErrorAction Stop | Out-Null # Create css folder
New-Item -Path $fontsFolder -ItemType Directory -Force -ErrorAction Stop | Out-Null # Create fonts folder


# -----------------------------------------------------------------------------
# Copy Library Files and other assets to their correct subfolders
# -----------------------------------------------------------------------------
# Library files go into assets/lib
$libFiles = @("react.min.js", "react-dom.min.js", "chart.min.js", "tailwind.min.js", "Vazir.css")
foreach ($fileName in $libFiles) {
    $sourcePath = Join-Path $ResolvedToolsFolder $fileName
    $destinationPath = Join-Path $libFolder $fileName 
    if (Test-Path $sourcePath) {
        Copy-Item -Path $sourcePath -Destination $destinationPath -Force
    }
    else {
        Write-Warning "Library file not found: $fileName at $sourcePath. Please ensure this file exists in your 'Report Tools' folder."
    }
}

# Custom JS/CSS files go into assets
$customAssetFiles = @("shamsi-converter.js", "print-styles.css", "report_app.js")
foreach ($fileName in $customAssetFiles) {
    $sourcePath = Join-Path $ResolvedToolsFolder $fileName
    $destinationPath = Join-Path $assetsFolder $fileName # Copy directly to assets folder
    if (Test-Path $sourcePath) {
        Copy-Item -Path $sourcePath -Destination $destinationPath -Force
    }
    else {
        Write-Warning "Custom asset file not found: $fileName at $sourcePath. Please ensure this file exists in your 'Report Tools' folder."
    }
}

# Flaticon files go into assets/css and assets/fonts
$sourceFlaticonCssPath = Join-Path $ResolvedToolsFolder "css\flaticon.css"
$destinationFlaticonCssPath = Join-Path $cssFolder "flaticon.css"
if (Test-Path $sourceFlaticonCssPath) {
    Copy-Item -Path $sourceFlaticonCssPath -Destination $destinationFlaticonCssPath -Force
} else {
    Write-Warning "Flaticon CSS file not found: $sourceFlaticonCssPath."
}

$sourceFlaticonTtfPath = Join-Path $ResolvedToolsFolder "fonts\flaticon.ttf"
$destinationFlaticonTtfPath = Join-Path $fontsFolder "flaticon.ttf"
if (Test-Path $sourceFlaticonTtfPath) {
    Copy-Item -Path $sourceFlaticonTtfPath -Destination $destinationFlaticonTtfPath -Force
} else {
    Write-Warning "Flaticon TTF file not found: $sourceFlaticonTtfPath."
}


# -----------------------------------------------------------------------------
# Load User Names Mapping
# -----------------------------------------------------------------------------
$UserMapping = @{}
Get-Content -Path $ResolvedUserNamesFilePath | ForEach-Object {
    $line = $_.Trim()
    if ($line -notmatch '^\s*$') { # Skip empty lines
        $parts = $line -split ',', 2 # Split only on the first comma
        if ($parts.Length -eq 2) {
            $UserID = $parts[0].Trim()
            $RealName = $parts[1].Trim()
            $UserMapping[$UserID] = $RealName
        }
    }
}


# -----------------------------------------------------------------------------
# Fetch Data from Database
# -----------------------------------------------------------------------------
$cacheQuery = "SELECT r.NAME, d.DAY, ROUND(d.RECV_BYTES / 1048576.0, 2), ROUND(d.SEND_BYTES / 1048576.0, 2), ROUND((d.RECV_BYTES + d.SEND_BYTES) / 1048576.0, 2) FROM DAY_USAGE d JOIN STREAM s ON d.STREAM_ID = s.ID JOIN RULE r ON s.RULE_ID = r.ID WHERE d.DAY BETWEEN '$StartDate' AND '$EndDate' ORDER BY r.NAME, d.DAY DESC"
$cacheData = sqlite3 -tabs $ResolvedDbPath $cacheQuery

$summaryQuery = "SELECT r.NAME, ROUND(SUM(d.RECV_BYTES) / 1048576.0, 2), ROUND(SUM(d.SEND_BYTES) / 1048576.0, 2), ROUND(SUM(d.RECV_BYTES + d.SEND_BYTES) / 1048576.0, 2) FROM DAY_USAGE d JOIN STREAM s ON d.STREAM_ID = s.ID JOIN RULE r ON s.RULE_ID = r.ID WHERE d.DAY BETWEEN '$StartDate' AND '$EndDate' GROUP BY r.NAME"
$summaryData = sqlite3 -tabs $ResolvedDbPath $summaryQuery

# New query to get monthly usage per user for highest consumer calculation
$monthlyUserUsageQuery = "
    SELECT
        STRFTIME('%Y-%m', d.DAY) AS Month,
        r.NAME AS UserName,
        ROUND(SUM(d.RECV_BYTES + d.SEND_BYTES) / 1048576.0, 2) AS TotalUsageMB
    FROM
        DAY_USAGE d
    JOIN
        STREAM s ON d.STREAM_ID = s.ID
    JOIN
        RULE r ON s.RULE_ID = r.ID
    WHERE
        d.DAY BETWEEN '$StartDate' AND '$EndDate'
    GROUP BY
        Month, UserName
    ORDER BY
        Month, TotalUsageMB DESC;
"
$monthlyUserUsageData = sqlite3 -tabs $ResolvedDbPath $monthlyUserUsageQuery


# -----------------------------------------------------------------------------
# Process Data (Apply User Names Mapping)
# -----------------------------------------------------------------------------
$data = @{ users = @(); dateRange = @{ startDate = $StartDate; endDate = $EndDate }; monthlyHighestConsumers = @{} }
$userData = @{}

$excludedUsersSet = New-Object System.Collections.Generic.HashSet[string]
$ExcludedUsers | ForEach-Object { [void]$excludedUsersSet.Add($_.Trim()) }

foreach ($line in $cacheData) {
    $fields = $line -split "`t"
    if ($fields.Count -eq 5) {
        $user = $fields[0].Trim() 
        if (-not $excludedUsersSet.Contains($user)) {
            $DisplayName = if ($UserMapping.ContainsKey($user)) { $UserMapping[$user] } else { $user } # Map UserID to RealName
            if (-not $userData.ContainsKey($DisplayName)) { $userData[$DisplayName] = @() }
            $userData[$DisplayName] += [PSCustomObject]@{ userId = $user; name = $DisplayName; day = $fields[1]; download = [double]$fields[2]; upload = [double]$fields[3]; totalUsage = [double]$fields[4] }
        }
    }
}

$summaryDataClean = @{}
foreach ($line in $summaryData) {
    $fields = $line -split "`t"
    if ($fields.Count -eq 4) {
        $user = $fields[0].Trim()
        if (-not $excludedUsersSet.Contains($user)) {
            $DisplayName = if ($UserMapping.ContainsKey($user)) { $UserMapping[$user] } else { $user } # Map UserID to RealName
            $summaryDataClean[$DisplayName] = [PSCustomObject]@{
                userId        = $user # Add UserID to summary data
                totalDownload = [double]$fields[1]
                totalUpload   = [double]$fields[2]
                totalUsage    = [double]$fields[3]
            }
        }
    }
}

# Process monthly highest consumer data
$currentMonth = ""
$highestConsumerThisMonth = ""
$highestConsumptionThisMonth = 0.0

foreach ($line in $monthlyUserUsageData) {
    $fields = $line -split "`t"
    if ($fields.Count -eq 3) {
        $month = $fields[0].Trim()
        $userName = $fields[1].Trim()
        $totalUsage = [double]$fields[2]

        # Check if user is excluded
        if ($excludedUsersSet.Contains($userName)) {
            continue
        }

        # Map UserID to RealName for display
        $DisplayName = if ($UserMapping.ContainsKey($userName)) { $UserMapping[$userName] } else { $userName }

        if ($month -ne $currentMonth) {
            # New month, store previous month's highest consumer if available
            if ($currentMonth -ne "") {
                $data.monthlyHighestConsumers[$currentMonth] = @{
                    userName = $highestConsumerThisMonth
                    totalUsage = $highestConsumptionThisMonth
                }
            }
            # Reset for the new month
            $currentMonth = $month
            $highestConsumerThisMonth = $DisplayName
            $highestConsumptionThisMonth = $totalUsage
        } else {
            # Same month, update if current user has higher consumption
            if ($totalUsage -gt $highestConsumptionThisMonth) {
                $highestConsumerThisMonth = $DisplayName
                $highestConsumptionThisMonth = $totalUsage
            }
        }
    }
}

# Store the last month's highest consumer
if ($currentMonth -ne "") {
    $data.monthlyHighestConsumers[$currentMonth] = @{
        userName = $highestConsumerThisMonth
        totalUsage = $highestConsumptionThisMonth
    }
}


$sortedUserKeys = $userData.Keys | Sort-Object
foreach ($user in $sortedUserKeys) {
    if ($summaryDataClean.ContainsKey($user)) {
        $data.users += @{
            userId    = $summaryDataClean[$user].userId # Use UserID from summary for consistency
            name      = $user
            dailyData = $userData[$user]
            summary   = $summaryDataClean[$user]
        }
    }
}

# -----------------------------------------------------------------------------
# Generate data.js file (contains window.reportData)
# -----------------------------------------------------------------------------
$jsonData = $data | ConvertTo-Json -Depth 5 -Compress
$jsContentForDataFile = "window.reportData = $jsonData;"
Set-Content -Path $OutputDataJs -Value $jsContentForDataFile -Encoding UTF8


# -----------------------------------------------------------------------------
# Generate Final HTML Report File by reading template
# -----------------------------------------------------------------------------
$htmlTemplateContent = Get-Content -Path $ResolvedHtmlTemplatePath -Raw -Encoding UTF8
Set-Content -Path $OutputHtml -Value $htmlTemplateContent -Encoding UTF8

# -----------------------------------------------------------------------------
# Finalization
# -----------------------------------------------------------------------------
Invoke-Item $OutputHtml