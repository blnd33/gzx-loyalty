@echo off
cd /d "%~dp0"
call npm run local:reset-owner
echo.
echo Open data\OWNER-LOGIN.txt for the new login details.
pause
