"""Record a local QA command's real output/exit code without recording environment secrets."""
import json
import os
from pathlib import Path
import subprocess
import sys
import time


def main():
    label, *command = sys.argv[1:]
    if not command or not label.replace('-', '').replace('_', '').isalnum():
        raise SystemExit('Usage: record.py label executable [arguments]')
    folder = Path('artifacts/integration')
    folder.mkdir(parents=True, exist_ok=True)
    env = {**os.environ, 'PYTHONIOENCODING': 'utf-8', 'PYTHONUTF8': '1', 'NEXT_TELEMETRY_DISABLED': '1'}
    started = time.perf_counter()
    result = subprocess.run(command, capture_output=True, text=True, encoding='utf-8', errors='replace', env=env)
    output = result.stdout + result.stderr
    (folder / f'{label}.log').write_text(output, encoding='utf-8')
    metadata = {'command': command, 'exit_code': result.returncode,
                'elapsed_seconds': round(time.perf_counter() - started, 3)}
    (folder / f'{label}.command.json').write_text(json.dumps(metadata, indent=2) + '\n', encoding='utf-8')
    print(json.dumps(metadata))
    print('\n'.join(output.splitlines()[-30:]))
    raise SystemExit(result.returncode)


if __name__ == '__main__':
    main()
