@echo off
rem Start YuE2 Studio (production build). Run install.cmd first.
cd /d "%~dp0app"
if not exist build\index.js call npm run build
start "" http://localhost:8000
npm start
