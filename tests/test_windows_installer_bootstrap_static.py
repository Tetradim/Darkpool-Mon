"""Static checks for Darkpool Monitor Windows first-run installer support."""
from pathlib import Path
import unittest


ROOT = Path(__file__).resolve().parents[1]
LAUNCHER_BAT = ROOT / "Launch-Darkpool-Monitor.bat"
LAUNCHER_PS1 = ROOT / "Launch-Darkpool-Monitor.ps1"
BUILD_WORKFLOW = ROOT / ".github" / "workflows" / "build.yml"
README = ROOT / "README.md"
SERVER = ROOT / "server.py"
VITE_CONFIG = ROOT / "vite.config.js"
WINDOWS_ENTRYPOINT = ROOT / "windows_entrypoint.py"


class WindowsInstallerBootstrapStaticTests(unittest.TestCase):
    def test_launcher_supports_installed_and_source_modes(self):
        batch = LAUNCHER_BAT.read_text(encoding="utf-8")
        script = LAUNCHER_PS1.read_text(encoding="utf-8")

        self.assertIn("Launch-Darkpool-Monitor.ps1", batch)
        self.assertIn("DarkpoolMonitor-Setup", batch)
        self.assertIn("Darkpool Monitor - Installed App", script)
        self.assertIn("DarkpoolMonitor.exe", script)
        self.assertIn("Start-InstalledDarkpoolMonitor", script)
        self.assertIn("Start-SourceDarkpoolMonitor", script)
        self.assertIn("-InstallDeps", script)
        self.assertIn("-SmokeTest", script)
        self.assertIn("/health", script)
        self.assertIn("/app/", script)

    def test_launcher_downloads_missing_runtime_and_source_dependencies(self):
        script = LAUNCHER_PS1.read_text(encoding="utf-8")

        self.assertIn("Test-VcRuntimeInstalled", script)
        self.assertIn("vc_redist.x64.exe", script)
        self.assertIn("Ensure-InstalledRuntimeDependencies", script)
        self.assertIn("Ensure-SourcePythonDependencies", script)
        self.assertIn("python -m venv", script)
        self.assertIn("requirements.txt", script)
        self.assertIn("Ensure-SourceFrontendDependencies", script)
        self.assertIn("npm install", script)
        self.assertIn("node_modules", script)
        self.assertIn("Darkpool-Monitor.log", script)

    def test_packaged_server_serves_bundled_frontend(self):
        server = SERVER.read_text(encoding="utf-8")
        vite = VITE_CONFIG.read_text(encoding="utf-8")
        entrypoint = WINDOWS_ENTRYPOINT.read_text(encoding="utf-8")

        self.assertIn("StaticFiles", server)
        self.assertIn("def find_packaged_static_dir", server)
        self.assertIn('app.mount("/app"', server)
        self.assertIn("sys._MEIPASS", server)
        self.assertIn("base: './'", vite)
        self.assertIn("import server", entrypoint)
        self.assertIn("uvicorn.run(server.app", entrypoint)

    def test_build_workflow_creates_windows_installer(self):
        workflow = BUILD_WORKFLOW.read_text(encoding="utf-8")

        self.assertIn("Build Darkpool Monitor", workflow)
        self.assertIn("npm run build", workflow)
        self.assertIn("python -m PyInstaller", workflow)
        self.assertIn("windows_entrypoint.py", workflow)
        self.assertIn("Launch-Darkpool-Monitor.bat", workflow)
        self.assertIn("Launch-Darkpool-Monitor.ps1", workflow)
        self.assertIn("DarkpoolMonitor-Setup-{#MyAppVersion}", workflow)
        self.assertIn('Filename: "{app}\\Launch-Darkpool-Monitor.bat"', workflow)
        self.assertIn("actions/upload-artifact@v4", workflow)

    def test_readme_documents_installer_and_first_run_behavior(self):
        readme = README.read_text(encoding="utf-8")

        self.assertIn("DarkpoolMonitor-Setup-<version>.exe", readme)
        self.assertIn("downloads missing runtime dependencies on first launch", readme)
        self.assertIn("Visual C++ Runtime", readme)
        self.assertIn("Launch-Darkpool-Monitor.ps1 -InstallDeps", readme)
        self.assertIn("Darkpool-Monitor.log", readme)


if __name__ == "__main__":
    unittest.main()
