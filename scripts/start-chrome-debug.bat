@echo off
echo Chrome'u remote debugging ile baslatiyorum...
echo.
echo NOT: Tum Chrome pencerelerini kapatmaniz gerekiyor!
echo.
pause

"C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222 --user-data-dir="C:\temp\chrome-debug"

echo.
echo Chrome baslatildi! Simdi network-logger-existing-browser.js script'ini calistirin.
pause




