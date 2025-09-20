cd C:\Users\admin\thebase2
while ($true) {
  git fetch origin
  git merge --ff-only origin/main
  Start-Sleep -Seconds 3
}
