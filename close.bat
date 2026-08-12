@echo off
setlocal
set PORT=2000

echo Checking port %PORT%...

for /f "tokens=5" %%a in ('netstat -ano ^| findstr /r /c:"\:%PORT% "') do (
    echo Found process ID: %%a. Killing...
    taskkill /f /pid %%a
)

echo Done.
pause