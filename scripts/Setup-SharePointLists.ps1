<#
.SYNOPSIS
    SharePoint List 생성 스크립트 - Team Schedule 프로젝트

.DESCRIPTION
    PnP PowerShell을 사용하여 필요한 SharePoint List 5개를 생성합니다.
    - TeamMembers: 팀원 정보
    - Schedules: 일정 정보
    - AttendanceStatus: 근태 상태
    - Todos: 할 일
    - WorkloadStatus: 업무부하 상태

.PARAMETER SiteUrl
    SharePoint Site URL (예: https://contoso.sharepoint.com/sites/TeamSchedule)

.EXAMPLE
    .\Setup-SharePointLists.ps1 -SiteUrl "https://contoso.sharepoint.com/sites/TeamSchedule"
#>

param(
    [Parameter(Mandatory = $true)]
    [string]$SiteUrl
)

# ─── 연결 ─────────────────────────────────────────────────────
Write-Host "🔗 SharePoint에 연결 중..." -ForegroundColor Cyan
Connect-PnPOnline -Url $SiteUrl -Interactive

Write-Host "✅ 연결 완료: $SiteUrl" -ForegroundColor Green

# ─── 1. TeamMembers 리스트 ────────────────────────────────────
Write-Host "`n📋 TeamMembers 리스트 생성..." -ForegroundColor Yellow

$list = New-PnPList -Title "TeamMembers" -Template GenericList -ErrorAction SilentlyContinue
if (-not $list) {
    Write-Host "  ℹ️  TeamMembers 리스트가 이미 존재합니다." -ForegroundColor Gray
}

Add-PnPField -List "TeamMembers" -DisplayName "Color" -InternalName "Color" -Type Text -ErrorAction SilentlyContinue
Add-PnPField -List "TeamMembers" -DisplayName "Department" -InternalName "Department" -Type Text -ErrorAction SilentlyContinue
Add-PnPField -List "TeamMembers" -DisplayName "Role" -InternalName "Role" -Type Choice -Choices "Member","Leader" -ErrorAction SilentlyContinue
Add-PnPField -List "TeamMembers" -DisplayName "Email" -InternalName "Email" -Type Text -ErrorAction SilentlyContinue
Add-PnPField -List "TeamMembers" -DisplayName "IsActive" -InternalName "IsActive" -Type Boolean -ErrorAction SilentlyContinue

Write-Host "  ✅ TeamMembers 완료" -ForegroundColor Green

# ─── 2. Schedules 리스트 ──────────────────────────────────────
Write-Host "`n📋 Schedules 리스트 생성..." -ForegroundColor Yellow

$list = New-PnPList -Title "Schedules" -Template GenericList -ErrorAction SilentlyContinue
if (-not $list) {
    Write-Host "  ℹ️  Schedules 리스트가 이미 존재합니다." -ForegroundColor Gray
}

Add-PnPField -List "Schedules" -DisplayName "StartDate" -InternalName "StartDate" -Type DateTime -ErrorAction SilentlyContinue
Add-PnPField -List "Schedules" -DisplayName "EndDate" -InternalName "EndDate" -Type DateTime -ErrorAction SilentlyContinue
Add-PnPField -List "Schedules" -DisplayName "Description" -InternalName "Description" -Type Note -ErrorAction SilentlyContinue
Add-PnPField -List "Schedules" -DisplayName "Category" -InternalName "Category" -Type Choice -Choices "회의","업무","기타" -ErrorAction SilentlyContinue
Add-PnPField -List "Schedules" -DisplayName "IsRecurring" -InternalName "IsRecurring" -Type Boolean -ErrorAction SilentlyContinue
Add-PnPField -List "Schedules" -DisplayName "RecurrenceRule" -InternalName "RecurrenceRule" -Type Text -ErrorAction SilentlyContinue

# Lookup field (Assignee → TeamMembers)
$memberListId = (Get-PnPList -Identity "TeamMembers").Id
Add-PnPFieldFromXml -List "Schedules" -FieldXml "<Field Type='Lookup' DisplayName='Assignee' Required='FALSE' List='{$memberListId}' ShowField='Title' StaticName='Assignee' Name='Assignee' />" -ErrorAction SilentlyContinue

Write-Host "  ✅ Schedules 완료" -ForegroundColor Green

# ─── 3. AttendanceStatus 리스트 ───────────────────────────────
Write-Host "`n📋 AttendanceStatus 리스트 생성..." -ForegroundColor Yellow

$list = New-PnPList -Title "AttendanceStatus" -Template GenericList -ErrorAction SilentlyContinue
if (-not $list) {
    Write-Host "  ℹ️  AttendanceStatus 리스트가 이미 존재합니다." -ForegroundColor Gray
}

Add-PnPField -List "AttendanceStatus" -DisplayName "Date" -InternalName "Date" -Type DateTime -ErrorAction SilentlyContinue
Add-PnPField -List "AttendanceStatus" -DisplayName "Status" -InternalName "Status" -Type Choice -Choices "출근","출장","휴가","공가","재택" -ErrorAction SilentlyContinue
Add-PnPField -List "AttendanceStatus" -DisplayName "Note" -InternalName "Note" -Type Text -ErrorAction SilentlyContinue

# Lookup field (Member → TeamMembers)
Add-PnPFieldFromXml -List "AttendanceStatus" -FieldXml "<Field Type='Lookup' DisplayName='Member' Required='FALSE' List='{$memberListId}' ShowField='Title' StaticName='Member' Name='Member' />" -ErrorAction SilentlyContinue

Write-Host "  ✅ AttendanceStatus 완료" -ForegroundColor Green

# ─── 4. Todos 리스트 ──────────────────────────────────────────
Write-Host "`n📋 Todos 리스트 생성..." -ForegroundColor Yellow

$list = New-PnPList -Title "Todos" -Template GenericList -ErrorAction SilentlyContinue
if (-not $list) {
    Write-Host "  ℹ️  Todos 리스트가 이미 존재합니다." -ForegroundColor Gray
}

Add-PnPField -List "Todos" -DisplayName "Status" -InternalName "Status" -Type Choice -Choices "대기","진행중","완료" -ErrorAction SilentlyContinue
Add-PnPField -List "Todos" -DisplayName "Priority" -InternalName "Priority" -Type Choice -Choices "높음","보통","낮음" -ErrorAction SilentlyContinue
Add-PnPField -List "Todos" -DisplayName "DueDate" -InternalName "DueDate" -Type DateTime -ErrorAction SilentlyContinue
Add-PnPField -List "Todos" -DisplayName "Memo" -InternalName "Memo" -Type Note -ErrorAction SilentlyContinue

# Lookup field (Assignee → TeamMembers)
Add-PnPFieldFromXml -List "Todos" -FieldXml "<Field Type='Lookup' DisplayName='Assignee' Required='FALSE' List='{$memberListId}' ShowField='Title' StaticName='Assignee' Name='Assignee' />" -ErrorAction SilentlyContinue

Write-Host "  ✅ Todos 완료" -ForegroundColor Green

# ─── 5. WorkloadStatus 리스트 ─────────────────────────────────
Write-Host "`n📋 WorkloadStatus 리스트 생성..." -ForegroundColor Yellow

$list = New-PnPList -Title "WorkloadStatus" -Template GenericList -ErrorAction SilentlyContinue
if (-not $list) {
    Write-Host "  ℹ️  WorkloadStatus 리스트가 이미 존재합니다." -ForegroundColor Gray
}

Add-PnPField -List "WorkloadStatus" -DisplayName "Status" -InternalName "Status" -Type Choice -Choices "Normal","NeedSupport" -ErrorAction SilentlyContinue
Add-PnPField -List "WorkloadStatus" -DisplayName "UpdatedAt" -InternalName "UpdatedAt" -Type DateTime -ErrorAction SilentlyContinue
Add-PnPField -List "WorkloadStatus" -DisplayName "UpdatedBy" -InternalName "UpdatedBy" -Type User -ErrorAction SilentlyContinue

# Lookup field (Member → TeamMembers)
Add-PnPFieldFromXml -List "WorkloadStatus" -FieldXml "<Field Type='Lookup' DisplayName='Member' Required='FALSE' List='{$memberListId}' ShowField='Title' StaticName='Member' Name='Member' />" -ErrorAction SilentlyContinue

Write-Host "  ✅ WorkloadStatus 완료" -ForegroundColor Green

# ─── 초기 데이터 (팀원) ───────────────────────────────────────
Write-Host "`n👥 초기 팀원 데이터 입력..." -ForegroundColor Yellow

$teamMembers = @(
    @{ Title = "이봉철"; Color = "#0000FF"; Department = "개발팀"; Role = "Leader"; Email = "bclee@company.com"; IsActive = $true },
    @{ Title = "박상율"; Color = "#00AA00"; Department = "개발팀"; Role = "Member"; Email = "sypark@company.com"; IsActive = $true },
    @{ Title = "김철수"; Color = "#FF8800"; Department = "개발팀"; Role = "Member"; Email = "cskim@company.com"; IsActive = $true },
    @{ Title = "홍길동"; Color = "#9900CC"; Department = "개발팀"; Role = "Member"; Email = "gdhong@company.com"; IsActive = $true }
)

foreach ($member in $teamMembers) {
    $existing = Get-PnPListItem -List "TeamMembers" -Query "<View><Query><Where><Eq><FieldRef Name='Title'/><Value Type='Text'>$($member.Title)</Value></Eq></Where></Query></View>" -ErrorAction SilentlyContinue

    if (-not $existing) {
        Add-PnPListItem -List "TeamMembers" -Values $member | Out-Null
        Write-Host "  ✅ $($member.Title) 추가됨" -ForegroundColor Green
    } else {
        Write-Host "  ℹ️  $($member.Title) 이미 존재" -ForegroundColor Gray
    }
}

# ─── WorkloadStatus 초기화 ────────────────────────────────────
Write-Host "`n🔧 WorkloadStatus 초기화..." -ForegroundColor Yellow

$allMembers = Get-PnPListItem -List "TeamMembers"
foreach ($m in $allMembers) {
    $existing = Get-PnPListItem -List "WorkloadStatus" -Query "<View><Query><Where><Eq><FieldRef Name='Member' LookupId='TRUE'/><Value Type='Lookup'>$($m.Id)</Value></Eq></Where></Query></View>" -ErrorAction SilentlyContinue

    if (-not $existing) {
        Add-PnPListItem -List "WorkloadStatus" -Values @{
            Title = "workload_$($m.Id)"
            MemberId = $m.Id
            Status = "Normal"
            UpdatedAt = (Get-Date).ToString("yyyy-MM-ddTHH:mm:ssZ")
        } | Out-Null
        Write-Host "  ✅ $($m["Title"]) WorkloadStatus 초기화됨" -ForegroundColor Green
    }
}

# ─── 완료 ─────────────────────────────────────────────────────
Write-Host "`n" -NoNewline
Write-Host "═══════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  ✅ 모든 SharePoint List 생성 및 초기 데이터 입력 완료!  " -ForegroundColor Green
Write-Host "═══════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "`n생성된 리스트:"
Write-Host "  1. TeamMembers (팀원 정보)"
Write-Host "  2. Schedules (일정)"
Write-Host "  3. AttendanceStatus (근태 상태)"
Write-Host "  4. Todos (할 일)"
Write-Host "  5. WorkloadStatus (업무부하 상태)"
Write-Host ""

Disconnect-PnPOnline
