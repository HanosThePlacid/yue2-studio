@echo off
rem Double-click or run from cmd. Passes any arguments to install.ps1, e.g. install.cmd -Backend vulkan
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0install.ps1" %*
if errorlevel 1 pause
