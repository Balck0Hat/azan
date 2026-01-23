<#
.SYNOPSIS
  سكربت PowerShell لمساعدة رفع المشروع الحالي إلى GitHub (يدعم gh، HTTPS+PAT، وSSH).
#>

function Write-Info($msg){ Write-Host "[INFO] $msg" -ForegroundColor Cyan }
function Write-ErrorAndExit($msg){ Write-Host "[ERROR] $msg" -ForegroundColor Red; exit 1 }

# Ensure Git exists
if (-not (Get-Command git -ErrorAction SilentlyContinue)){
  Write-ErrorAndExit "git غير مثبت. الرجاء تثبيت Git ثم إعادة المحاولة. https://git-scm.com/downloads"
}

$cwd = Get-Location
$defaultRepoName = Split-Path -Leaf $cwd.Path

Write-Info "المجلد الحالي: $cwd"

$repoName = Read-Host "اسم المستودع على GitHub (افتراضي: $defaultRepoName)"
if ([string]::IsNullOrWhiteSpace($repoName)) { $repoName = $defaultRepoName }

# Visibility
$visibility = Read-Host "الخصوصية (public / private) (افتراضي: public)"
if ([string]::IsNullOrWhiteSpace($visibility)) { $visibility = 'public' }
if ($visibility -ne 'public' -and $visibility -ne 'private') { Write-ErrorAndExit "الخصوصية يجب أن تكون 'public' أو 'private'" }

# Ensure git repo
if (-not (git rev-parse --is-inside-work-tree 2>$null)){
  Write-Info "تهيئة git في هذا المجلد..."
  git init
  git branch -M main 2>$null | Out-Null
}

# Add .gitignore and README if not present is handled separately; stage changes
Write-Info "إضافة الملفات إلى المرحلة وارتكابها إذا لم يكن هناك ارتكاب سابق..."
$hasCommit = $true
try { git rev-parse --verify HEAD > $null 2>&1 } catch { $hasCommit = $false }

if (-not $hasCommit){
  git add .
  git commit -m "Initial commit"
} else {
  Write-Info "يوجد ارتكابات سابقة، لن أنشئ ارتكاباً جديداً تلقائياً."
}

# Choose auth method
$ghAvailable = (Get-Command gh -ErrorAction SilentlyContinue) -ne $null
Write-Info "خيار المصادقة: "; if ($ghAvailable) { Write-Host "(موصى به) gh (GitHub CLI)" -ForegroundColor Green } else { Write-Host "gh غير مثبت" -ForegroundColor Yellow }

Write-Host "اختر طريقة المصادقة: [1] gh (إذا متوفّر)  [2] HTTPS + Personal Access Token  [3] SSH"
$method = Read-Host "الاختيار (1/2/3)".Trim()
if ($method -eq '1' -and -not $ghAvailable){ Write-ErrorAndExit "gh غير مثبت على النظام. اختر طريقة أخرى أو ثبّت gh." }

# Helper to push
function Do-PushWithRemote([string]$remoteUrl){
  if (git remote | Select-String -Pattern '^origin$'){
    git remote set-url origin $remoteUrl
  } else {
    git remote add origin $remoteUrl
  }
  Write-Info "دفع إلى $remoteUrl ..."
  $pushResult = git push -u origin main
  if ($LASTEXITCODE -ne 0){ Write-ErrorAndExit "فشل الدفع إلى remote. راجع الرسالة أعلاه." }
  Write-Info "تم الدفع بنجاح."
}

if ($method -eq '1'){
  # Use gh to create repo and push
  $ownerInput = Read-Host "(اختياري) اسم المستخدم/المنظمة على GitHub (أو اتركه فارغاً لاستخدم الحساب الحالي)"
  $nameArg = if ([string]::IsNullOrWhiteSpace($ownerInput)) { $repoName } else { "$ownerInput/$repoName" }
  $visFlag = if ($visibility -eq 'private') { '--private' } else { '--public' }
  Write-Info "إنشاء المستودع عبر gh: $nameArg ($visibility)"
  gh repo create $nameArg $visFlag --source . --remote origin --push --confirm
  if ($LASTEXITCODE -ne 0){ Write-ErrorAndExit "gh فشل في إنشاء المستودع أو دفعه." }
  Write-Info "العملية اكتملت عبر gh."
} elseif ($method -eq '2'){
  # HTTPS + PAT: create repo via API and push using embedded token temporarily
  Write-Info "ستحتاج إلى PAT (مع صلاحيات repo). لا تخزن التوكن في ملف."
  $securePat = Read-Host "أدخل GitHub Personal Access Token (إدخال مخفي)" -AsSecureString
  $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePat)
  $plainPat = [Runtime.InteropServices.Marshal]::PtrToStringAuto($bstr)
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)

  # Create repo via API
  Write-Info "أحاول إنشاء المستودع عبر GitHub API..."
  $createBody = @{ name = $repoName; private = ($visibility -eq 'private') } | ConvertTo-Json
  try {
    $resp = Invoke-RestMethod -Method Post -Uri https://api.github.com/user/repos -Headers @{ Authorization = "token $plainPat"; 'User-Agent' = 'push-to-github-ps1' } -Body $createBody
    $owner = $resp.owner.login
    Write-Info "تم إنشاء المستودع على حساب: $owner"
  } catch {
    Write-Host "فشل إنشاء المستودع عبر API. قد يكون المستودع موجوداً مسبقًا أو التوكن غير صالح. حاول إنشاء المستودع يدوياً أو تحقق من صلاحيات التوكن." -ForegroundColor Yellow
    $owner = Read-Host "ادخل اسم المستخدم/المنظمة على GitHub التي تريد رفع الريبو إليها (مثال: youruser)"
  }

  $remoteWithToken = "https://$plainPat@github.com/$owner/$repoName.git"
  try{
    Do-PushWithRemote $remoteWithToken
    # reset remote url to remove token
    git remote set-url origin "https://github.com/$owner/$repoName.git"
  } finally {
    # Clear token variable
    Remove-Variable -Name plainPat -ErrorAction SilentlyContinue
    $plainPat = $null
  }
} elseif ($method -eq '3'){
  # SSH method
  $owner = Read-Host "ادخل اسم المستخدم/المنظمة على GitHub (مثال: youruser)"
  $remote = "git@github.com:$owner/$repoName.git"
  Write-Info "سأحاول إضافة remote وادفعة عبر SSH. تأكد أن مفتاح SSH مُضاف إلى حساب GitHub الخاص بك."
  Do-PushWithRemote $remote
} else {
  Write-ErrorAndExit "اختيار غير صالح." }

Write-Info "انتهت العملية. راجع المستودع على GitHub وتحقق من الملفات."

# Quick checks
Write-Info "تفقد الحالة المحلية: git status --short"
git status --short
Write-Info "تفقد الريموتات: git remote -v"
git remote -v

Write-Host "ملاحظة: إذا استخدمت PAT، تأكد من حذف أي متغيرات تحمل التوكن من الجلسة." -ForegroundColor Yellow
