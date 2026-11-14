@echo off
rem Red Dust Outpost - play this version on a Windows computer.
rem Double-click this file. It starts a small local server and opens the game in your browser.
rem Keep the window open while you play. Close it to stop.
title Red Dust Outpost
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0play-server.ps1"
if errorlevel 1 pause
