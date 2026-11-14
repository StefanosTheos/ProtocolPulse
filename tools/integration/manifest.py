"""Record the exact code/fixture/runtime identity without reading or serializing credentials."""
import hashlib
import importlib.metadata
import json
from pathlib import Path
import platform
import subprocess


def git(*args):
    return subprocess.check_output(['git', *args], text=True, encoding='utf-8').strip()


files = git('ls-files', '--cached', '--others', '--exclude-standard').splitlines()
hashes = {}
for name in files:
    if name.startswith('artifacts/') or name == 'INTEGRATION_REPORT.md':
        continue
    path = Path(name)
    if path.is_file():
        hashes[name] = hashlib.sha256(path.read_bytes()).hexdigest()
source_hash = hashlib.sha256(json.dumps(hashes, sort_keys=True).encode()).hexdigest()
result = {
    'baseline_commit': 'ea9748b77431f57d0f7d7722cf00f2a8028efb7e',
    'tested_code_commit': git('rev-parse', 'HEAD'),
    'code_commit_tree': git('rev-parse', 'HEAD^{tree}'),
    'source_fingerprint_sha256': source_hash,
    'contract': 'PP-S2-CF-20261114-01 / 1.0.0-rc2',
    'fixture': 'px104-protocol-v1',
    'python': platform.python_version(),
    'node': subprocess.check_output(['node', '--version'], text=True).strip(),
    'npm': subprocess.check_output(['npm.cmd', '--version'], text=True).strip(),
    'platform': platform.platform(),
    'python_packages': {name: importlib.metadata.version(name) for name in
        ['fastapi', 'pydantic', 'pydantic-settings', 'sqlalchemy', 'alembic', 'uvicorn',
         'pymupdf', 'google-genai', 'pytest', 'httpx']},
    'frontend_manifest': json.loads(Path('frontend/package.json').read_text(encoding='utf-8')),
    'source_file_sha256': hashes,
    'provider_evidence': 'LLM disabled; live provider not executed; SDK transport and models mocked in tests.',
}
Path('artifacts/integration/test-manifest.json').write_text(json.dumps(result, indent=2), encoding='utf-8')
print(json.dumps({key: result[key] for key in ['tested_code_commit', 'source_fingerprint_sha256', 'python', 'node', 'contract']}))
