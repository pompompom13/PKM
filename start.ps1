# AsyncMeet — запуск всех серверов
Write-Host "Запуск AsyncMeet..." -ForegroundColor Cyan

# Бэкенд
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot\backend'; node server.js" -WindowStyle Normal

Start-Sleep -Seconds 2

# Фронтенд
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot\frontend'; npm run dev" -WindowStyle Normal

Start-Sleep -Seconds 3

Write-Host ""
Write-Host "Приложение запущено!" -ForegroundColor Green
Write-Host "Откройте браузер: http://localhost:5173" -ForegroundColor Yellow
Write-Host "Бэкенд API:       http://localhost:3001" -ForegroundColor Yellow

Start-Process "http://localhost:5173"
