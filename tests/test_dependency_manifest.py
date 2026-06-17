from pathlib import Path


def test_requirements_include_runtime_auth_dependencies():
    requirements = Path("requirements.txt").read_text(encoding="utf-8").lower()

    assert "pyjwt" in requirements
    assert "email-validator" in requirements or "pydantic[email]" in requirements

