#Requires -Modules PnP.PowerShell
<#
.SYNOPSIS
    패키징기술파트 Schedule - Microsoft Lists 생성 스크립트

.DESCRIPTION
    Teams "기구코어기술Project" → "패키징기술파트" 채널 사이트에 아래 5개 List를 생성합니다:
    1. PKG_TeamMembers      - 팀원 정보
    2. PKG_Schedules        - 월간 일정
    3. PKG_AttendanceStatus - 근태 현황
    4. PKG_Todos            - To Do 목록
    5. PKG_WorkloadStatus   - 업무부하 현황

    ※ 리스트명에 PKG_ 접두사를 붙여 다른 파트와 구분합니다.

.PARAMETER SiteUrl
    Teams "패키징기술파트" 채널의 SharePoint 사이트 URL
    - 비공개 채널: https://your-tenant.sharepoint.com/sites/기구코어기술Project-패키징기술파트
    - 일반 채널: https://your-tenant.sharepoint.com/sites/기구코어기술Project

.EXAMPLE
    .\Setup-MicrosoftLists.ps1 -SiteUrl "https://contoso.sharepoint.com/sites/기구코어기술Project-패키징기술파트"
#>

param(
    [Parameter(Mandatory = $true)]
    [string]$SiteUrl
)

# ============================================================
# 연결
# ============================================================
Write-Host "🔗 SharePoint 사이트에 연결 중..." -ForegroundColor Cyan
Connect-PnPOnline -Url $SiteUrl -Interactive

Write-Host "✅ 연결 완료: $SiteUrl" -ForegroundColor Green

# ============================================================
# 1. PKG_TeamMembers List
# ============================================================
Write-Host "`n📋 [1/5] PKG_TeamMembers 리스트 생성 중..." -ForegroundColor Yellow

$listName = "PKG_TeamMembers"
$list = Get-PnPList -Identity $listName -ErrorAction SilentlyContinue
if ($null -eq $list) {
    New-PnPList -Title $listName -Template GenericList
    Write-Host "  리스트 생성됨" -ForegroundColor Green
} else {
    Write-Host "  리스트가 이미 존재합니다. 컬럼만 추가합니다." -ForegroundColor DarkYellow
}

# Title은 기본 존재 (이름으로 사용)
Add-PnPField -List $listName -DisplayName "Color" -InternalName "Color" -Type Text -ErrorAction SilentlyContinue
Add-PnPField -List $listName -DisplayName "Department" -InternalName "Department" -Type Text -ErrorAction SilentlyContinue
Add-PnPField -List $listName -DisplayName "Role" -InternalName "Role" -Type Choice -Choices "Member","Leader" -ErrorAction SilentlyContinue
Add-PnPField -List $listName -DisplayName "Email" -InternalName "Email" -Type Text -ErrorAction SilentlyContinue
Add-PnPField -List $listName -DisplayName "IsActive" -InternalName "IsActive" -Type Boolean -ErrorAction SilentlyContinue

# 기본 팀원 데이터 추가
$members = @(
    @{Title="홍길동"; Color="#0078D4"; Department="패키징기술파트"; Role="Leader"; Email="hong@company.com"; IsActive=$true},
    @{Title="김철수"; Color="#107C10"; Department="패키징기술파트"; Role="Member"; Email="kim@company.com"; IsActive=$true},
    @{Title="이영희"; Color="#FF8C00"; Department="패키징기술파트"; Role="Member"; Email="lee@company.com"; IsActive=$true}
)

foreach ($member in $members) {
    Add-PnPListItem -List $listName -Values $member -ErrorAction SilentlyContinue
}
Write-Host "  ✅ PKG_TeamMembers 완료 (샘플 데이터 3건)" -ForegroundColor Green

# ============================================================
# 2. PKG_Schedules List
# ============================================================
Write-Host "`n📅 [2/5] PKG_Schedules 리스트 생성 중..." -ForegroundColor Yellow

$listName = "PKG_Schedules"
$list = Get-PnPList -Identity $listName -ErrorAction SilentlyContinue
if ($null -eq $list) {
    New-PnPList -Title $listName -Template GenericList
    Write-Host "  리스트 생성됨" -ForegroundColor Green
} else {
    Write-Host "  리스트가 이미 존재합니다." -ForegroundColor DarkYellow
}

# Title = 일정 제목
Add-PnPField -List $listName -DisplayName "StartDate" -InternalName "StartDate" -Type DateTime -ErrorAction SilentlyContinue
Add-PnPField -List $listName -DisplayName "EndDate" -InternalName "EndDate" -Type DateTime -ErrorAction SilentlyContinue
Add-PnPField -List $listName -DisplayName "Description" -InternalName "Description0" -Type Note -ErrorAction SilentlyContinue
Add-PnPField -List $listName -DisplayName "Category" -InternalName "Category" -Type Choice -Choices "회의","업무","기타" -ErrorAction SilentlyContinue
Add-PnPField -List $listName -DisplayName "IsRecurring" -InternalName "IsRecurring" -Type Boolean -ErrorAction SilentlyContinue
Add-PnPField -List $listName -DisplayName "RecurrenceRule" -InternalName "RecurrenceRule" -Type Text -ErrorAction SilentlyContinue

# Lookup 필드 (Assignee → PKG_TeamMembers)
$teamMembersList = Get-PnPList -Identity "PKG_TeamMembers"
$teamMembersId = $teamMembersList.Id.ToString()
Add-PnPFieldFromXml -List $listName -FieldXml "<Field Type='Lookup' DisplayName='Assignee' Required='FALSE' List='{$teamMembersId}' ShowField='Title' />" -ErrorAction SilentlyContinue

Write-Host "  ✅ PKG_Schedules 완료" -ForegroundColor Green

# ============================================================
# 3. PKG_AttendanceStatus List
# ============================================================
Write-Host "`n🏢 [3/5] PKG_AttendanceStatus 리스트 생성 중..." -ForegroundColor Yellow

$listName = "PKG_AttendanceStatus"
$list = Get-PnPList -Identity $listName -ErrorAction SilentlyContinue
if ($null -eq $list) {
    New-PnPList -Title $listName -Template GenericList
    Write-Host "  리스트 생성됨" -ForegroundColor Green
} else {
    Write-Host "  리스트가 이미 존재합니다." -ForegroundColor DarkYellow
}

Add-PnPField -List $listName -DisplayName "Date" -InternalName "AttDate" -Type DateTime -ErrorAction SilentlyContinue
Add-PnPField -List $listName -DisplayName "Status" -InternalName "AttStatus" -Type Choice -Choices "출근","출장","휴가","공가","재택" -ErrorAction SilentlyContinue
Add-PnPField -List $listName -DisplayName "Note" -InternalName "AttNote" -Type Text -ErrorAction SilentlyContinue

# Lookup 필드 (Member → PKG_TeamMembers)
Add-PnPFieldFromXml -List $listName -FieldXml "<Field Type='Lookup' DisplayName='Member' Required='FALSE' List='{$teamMembersId}' ShowField='Title' />" -ErrorAction SilentlyContinue

Write-Host "  ✅ PKG_AttendanceStatus 완료" -ForegroundColor Green

# ============================================================
# 4. PKG_Todos List
# ============================================================
Write-Host "`n✅ [4/5] PKG_Todos 리스트 생성 중..." -ForegroundColor Yellow

$listName = "PKG_Todos"
$list = Get-PnPList -Identity $listName -ErrorAction SilentlyContinue
if ($null -eq $list) {
    New-PnPList -Title $listName -Template GenericList
    Write-Host "  리스트 생성됨" -ForegroundColor Green
} else {
    Write-Host "  리스트가 이미 존재합니다." -ForegroundColor DarkYellow
}

# Title = 업무명
Add-PnPField -List $listName -DisplayName "Status" -InternalName "TodoStatus" -Type Choice -Choices "대기","진행중","완료" -ErrorAction SilentlyContinue
Add-PnPField -List $listName -DisplayName "Priority" -InternalName "Priority" -Type Choice -Choices "높음","보통","낮음" -ErrorAction SilentlyContinue
Add-PnPField -List $listName -DisplayName "DueDate" -InternalName "DueDate" -Type DateTime -ErrorAction SilentlyContinue
Add-PnPField -List $listName -DisplayName "Memo" -InternalName "Memo" -Type Note -ErrorAction SilentlyContinue

# Lookup 필드 (Assignee → PKG_TeamMembers)
Add-PnPFieldFromXml -List $listName -FieldXml "<Field Type='Lookup' DisplayName='Assignee' Required='FALSE' List='{$teamMembersId}' ShowField='Title' />" -ErrorAction SilentlyContinue

Write-Host "  ✅ PKG_Todos 완료" -ForegroundColor Green

# ============================================================
# 5. PKG_WorkloadStatus List
# ============================================================
Write-Host "`n🔥 [5/5] PKG_WorkloadStatus 리스트 생성 중..." -ForegroundColor Yellow

$listName = "PKG_WorkloadStatus"
$list = Get-PnPList -Identity $listName -ErrorAction SilentlyContinue
if ($null -eq $list) {
    New-PnPList -Title $listName -Template GenericList
    Write-Host "  리스트 생성됨" -ForegroundColor Green
} else {
    Write-Host "  리스트가 이미 존재합니다." -ForegroundColor DarkYellow
}

Add-PnPField -List $listName -DisplayName "Status" -InternalName "WLStatus" -Type Choice -Choices "Normal","NeedSupport" -ErrorAction SilentlyContinue
Add-PnPField -List $listName -DisplayName "UpdatedAt" -InternalName "UpdatedAt" -Type DateTime -ErrorAction SilentlyContinue

# Lookup 필드 (Member → PKG_TeamMembers)
Add-PnPFieldFromXml -List $listName -FieldXml "<Field Type='Lookup' DisplayName='Member' Required='FALSE' List='{$teamMembersId}' ShowField='Title' />" -ErrorAction SilentlyContinue

Write-Host "  ✅ PKG_WorkloadStatus 완료" -ForegroundColor Green

# ============================================================
# 완료
# ============================================================
Write-Host "`n" -NoNewline
Write-Host "=====================================================" -ForegroundColor Cyan
Write-Host "🎉 패키징기술파트 - 모든 리스트 생성 완료!" -ForegroundColor Green
Write-Host "=====================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "생성된 리스트:" -ForegroundColor White
Write-Host "  1. PKG_TeamMembers      - 팀원 정보" 
Write-Host "  2. PKG_Schedules        - 월간 일정"
Write-Host "  3. PKG_AttendanceStatus - 근태 현황"
Write-Host "  4. PKG_Todos            - To Do 목록"
Write-Host "  5. PKG_WorkloadStatus   - 업무부하 현황"
Write-Host ""
Write-Host "Teams에서 확인:" -ForegroundColor White
Write-Host "  Teams → 기구코어기술Project → 패키징기술파트 채널 → + 탭 추가 → Lists"
Write-Host ""

Disconnect-PnPOnline
