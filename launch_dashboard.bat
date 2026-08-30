@echo off
setlocal

:: Set working directory to the folder where this batch file is located
cd /d "%~dp0"

echo ===================================================
echo   Counter-Drone Tactical Simulation Launch Setup
echo ===================================================
echo.

:: 1. Check if virtual environment exists, if not create one
if not exist "venv\Scripts\activate.bat" (
    echo [*] Virtual environment not found. Creating 'venv'...
    python -m venv venv
    if errorlevel 1 (
        echo [!] Failed to create virtual environment with 'python'. Trying 'py'...
        py -m venv venv
    )
)

:: 2. Activate virtual environment
if exist "venv\Scripts\activate.bat" (
    call venv\Scripts\activate.bat
    set "PYTHON_EXE=python"
) else (
    echo [!] Warning: Could not create/activate venv. Falling back to global python.
    set "PYTHON_EXE=python"
)

:: 3. Check and install dependencies if streamlit is missing
%PYTHON_EXE% -c "import streamlit" 2>nul
if errorlevel 1 (
    echo [*] Streamlit not detected. Installing dependencies from requirements.txt...
    %PYTHON_EXE% -m pip install --upgrade pip
    %PYTHON_EXE% -m pip install -r requirements.txt
    if errorlevel 1 (
        echo [!] Dependency installation failed. Please check your internet connection or Python setup.
        pause
        exit /b 1
    )
)

echo.
echo [*] Launching C-UAS Tactical Command Dashboard...
echo.

:: 4. Run Streamlit pointing to main.py
%PYTHON_EXE% -m streamlit run main.py

pause
