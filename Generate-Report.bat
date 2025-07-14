@echo off
REM This batch file runs the PowerShell script to generate the bandwidth report.

REM Get the directory of the current batch file.
set "scriptDir=%~dp0"

REM Define the full path to your PowerShell script file.
set "psScriptPath=%scriptDir%Generate-Report.ps1"

REM Execute the PowerShell script.
powershell.exe -ExecutionPolicy Bypass -File "%psScriptPath%"
