@echo off
cd /d "%~dp0"
node --experimental-strip-types scripts/local-backup.mjs
pause
