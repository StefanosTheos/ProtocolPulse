"""Authorized live provider smoke; source data/gateway are explicitly synthetic test doubles."""
import asyncio
import json
import os
from pathlib import Path
import time

from dotenv import load_dotenv


async def main():
    load_dotenv('.env', override=False)
    os.environ['LLM_ENABLED'] = 'true'  # this test process only; preserve the default .env flag
    from ai.config import Settings
    from ai.entrypoints import run_agent
    from ai.evals.fixtures import gateway, request

    settings = Settings.from_environ()
    if not settings.configured:
        print('LIVE UNAVAILABLE: selected provider/model/key are not configured.')
        return 2
    started = time.perf_counter()
    result = await run_agent(request(), gateway())
    proof = {'mode': 'LIVE_GEMINI_SYNTHETIC_TEST_GATEWAY', 'provider': settings.provider,
             'model': settings.model, 'elapsed_seconds': round(time.perf_counter() - started, 3),
             'agent_result': result, 'root_env_modified': False}
    # A sanitized metadata read distinguishes transport/auth/model availability failures
    # without exposing exception strings, URLs, request bodies or the credential.
    from google import genai
    from google.genai import types
    client = genai.Client(api_key=settings.api_key, http_options=types.HttpOptions(
        timeout=10_000, retry_options=types.HttpRetryOptions(attempts=1))).aio
    try:
        info = await asyncio.wait_for(client.models.get(model=settings.model), timeout=10)
        proof['model_metadata_probe'] = {'status': 'AVAILABLE', 'name': info.name}
    except Exception as exc:
        code = getattr(exc, 'code', None)
        proof['model_metadata_probe'] = {'status': 'FAILED', 'exception_type': type(exc).__name__,
                                         'http_code': code if isinstance(code, int) else None}
    finally:
        await client.aclose()
    output = json.dumps(proof, indent=2)
    if settings.api_key in output:
        raise RuntimeError('Credential redaction guard rejected the evidence output')
    Path('artifacts/integration/live-provider-smoke.json').write_text(output, encoding='utf-8')
    print(json.dumps({'mode': proof['mode'], 'status': result['status'], 'error_code': result['error_code'],
        'model': settings.model, 'elapsed_seconds': proof['elapsed_seconds'],
        'tools': [entry['tool_name'] for entry in result['trace']],
        'model_metadata_probe': proof['model_metadata_probe']}))
    return 0 if result['status'] in ('SUCCEEDED', 'PARTIAL') else 1


if __name__ == '__main__':
    raise SystemExit(asyncio.run(main()))
