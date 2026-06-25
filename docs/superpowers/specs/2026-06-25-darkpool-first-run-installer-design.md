# Darkpool Monitor first-run installer design

Date: 2026-06-25

## Goal

Windows beta testers should install Darkpool Monitor from `DarkpoolMonitor-Setup-<version>.exe`, double-click the installed shortcut, and have runtime dependencies handled automatically. Source checkout users should also be able to double-click the launcher and let it install Python and frontend package dependencies.

## Design

- Add `Launch-Darkpool-Monitor.bat` and `Launch-Darkpool-Monitor.ps1`.
- In an installed package, the launcher starts `DarkpoolMonitor.exe`, checks/downloads the Visual C++ Runtime when missing, waits for `/health`, and opens the bundled UI at `/app/`.
- In a source checkout, the same launcher creates `backend\.venv`, installs `requirements.txt`, runs `npm install` when `node_modules` is missing or `-InstallDeps` is passed, starts `server.py` with uvicorn, starts Vite, and opens the frontend.
- Package the Vite production build with PyInstaller through `windows_entrypoint.py`; importing `server.py` ensures all routes are registered before uvicorn starts.
- Mount packaged static files under `/app` so same-origin frontend API calls keep working.
- Add a GitHub Actions Windows build that produces `DarkpoolMonitor-Setup-<version>.exe`.

## Non-goals

- No database installation; the current repo keeps runtime state in memory.
- No provider API key onboarding beyond the existing UI/settings behavior.
- No macOS packaging in this change.
