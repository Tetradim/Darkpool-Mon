# Darkpool Monitor First-Run Installer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Windows installer and first-run launcher that repairs missing Darkpool Monitor dependencies automatically.

**Architecture:** The launcher has two paths: installed EXE startup with VC++ runtime repair, and source checkout startup with Python/npm dependency installation. PyInstaller packages a `windows_entrypoint.py` wrapper that imports `server.py` before starting uvicorn, and `server.py` mounts the Vite build under `/app`.

**Tech Stack:** PowerShell, FastAPI, Vite, PyInstaller, Inno Setup, unittest static checks.

---

### Task 1: Static contract tests

**Files:**
- Create: `tests/test_windows_installer_bootstrap_static.py`

- [ ] Add tests for launcher dependency repair, packaged static mounting, GitHub Actions installer output, README instructions, and source launcher dependency installation.
- [ ] Run `python -m unittest discover -s tests -p "*static.py" -v` and verify the tests fail before implementation.

### Task 2: Runtime entrypoint and packaged UI

**Files:**
- Modify: `server.py`
- Modify: `vite.config.js`
- Create: `windows_entrypoint.py`

- [ ] Add static file discovery and mount the Vite build under `/app`.
- [ ] Set Vite `base` to `./` so `/app/` resolves bundled assets correctly.
- [ ] Add `windows_entrypoint.py` to import `server.app` and run uvicorn after all routes load.

### Task 3: Windows launcher

**Files:**
- Create: `Launch-Darkpool-Monitor.bat`
- Create: `Launch-Darkpool-Monitor.ps1`

- [ ] Add a batch wrapper with clear missing PowerShell/script diagnostics.
- [ ] Add installed EXE mode with Visual C++ Runtime check/download, `PORT` wiring, `/health` wait, and Desktop logs.
- [ ] Add source checkout mode with Python venv creation, pip install, npm install, backend/frontend startup, and `-InstallDeps`.
- [ ] Add `-SmokeTest` for parser and argument-quoting verification.

### Task 4: Installer workflow and docs

**Files:**
- Create: `.github/workflows/build.yml`
- Modify: `README.md`

- [ ] Add Windows CI build for frontend, PyInstaller, launcher copy, Inno Setup, and artifact upload.
- [ ] Document `DarkpoolMonitor-Setup-<version>.exe`, first-run runtime repair, source launcher behavior, and support logs.
- [ ] Run targeted static tests, launcher smoke test, and `git diff --check`.
