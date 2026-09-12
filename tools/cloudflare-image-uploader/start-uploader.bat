@echo off
cd /d "%~dp0"
python uploader.py
if errorlevel 1 pause
