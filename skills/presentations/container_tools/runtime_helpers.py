import os
from pathlib import Path


def _required_runtime_path(env_name: str, *, directory: bool) -> Path:
    raw_value = os.environ.get(env_name)
    if not raw_value:
        raise RuntimeError(f"{env_name} is required.")
    value = Path(raw_value)
    if not value.is_absolute():
        raise RuntimeError(f"{env_name} must be an absolute path.")
    if directory and not value.is_dir():
        raise RuntimeError(f"{env_name} is not a directory: {value}")
    if not directory and not value.is_file():
        raise RuntimeError(f"{env_name} is not a file: {value}")
    return value


def _binary_candidates(bin_dir: Path, name: str) -> tuple[Path, ...]:
    suffixes = (".cmd", ".exe", "") if os.name == "nt" else ("",)
    return tuple(bin_dir / f"{name}{suffix}" for suffix in suffixes)


def runtime_node() -> str:
    node = _required_runtime_path("RUNTIME_NODE", directory=False)
    if os.name != "nt" and not os.access(node, os.X_OK):
        raise RuntimeError(f"RUNTIME_NODE is not executable: {node}")
    return str(node)


def runtime_binary(name: str) -> str:
    bin_dir = _required_runtime_path("RUNTIME_BIN_DIR", directory=True)
    for candidate in _binary_candidates(bin_dir, name):
        if candidate.is_file():
            return str(candidate)
    raise RuntimeError(f"RUNTIME_BIN_DIR is missing required binary {name}: {bin_dir}")


def runtime_bin_dir(*required_binaries: str) -> str:
    bin_dir = _required_runtime_path("RUNTIME_BIN_DIR", directory=True)
    missing = [
        name
        for name in required_binaries
        if not any(candidate.is_file() for candidate in _binary_candidates(bin_dir, name))
    ]
    if missing:
        raise RuntimeError(
            f"RUNTIME_BIN_DIR is missing required binaries {', '.join(missing)}: {bin_dir}"
        )
    return str(bin_dir)
