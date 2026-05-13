@echo off
echo ==============================================
echo Pushing AryaX World-Class UI & Branding Fixes...
echo ==============================================
git add public/index.html public/style.css
git commit -m "UI: Total Overhaul for Professional ASI Branding and Layout Fixes"
git push origin main
echo.
echo ==============================================
echo SUCCESS! AryaX now has a truly professional World-Class interface.
echo Please wait 1-2 minutes and refresh your Render website.
echo ==============================================
pause
