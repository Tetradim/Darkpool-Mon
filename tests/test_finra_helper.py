import importlib


def test_finra_helper_imports_without_annotation_errors():
    module = importlib.import_module("finra_helper")

    assert hasattr(module, "aget_full_data")
    assert hasattr(module, "aget_finra_weeks")
    assert hasattr(module, "aget_finra_data")

