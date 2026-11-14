"""Compare running OpenAPI routes/DTO presence and both independently owned AI tool mirrors."""
import json
from pathlib import Path
import re
from typing import get_args, get_origin, Literal

import httpx

from backend.app.schemas import common, dto
from backend.app.integrations import agent_adapter, evidence_gateway, tool_schemas
from ai.tools import schemas, selection


def main():
    folder = Path('artifacts/integration')
    spec = httpx.get('http://127.0.0.1:8000/openapi.json').json()
    (folder / 'openapi.json').write_text(json.dumps(spec, indent=2), encoding='utf-8')
    document = Path('docs/API_CONTRACTS.md').read_text(encoding='utf-8')
    expected = dict((tuple((method.lower(), path)), op) for method, path, op in re.findall(
        r'\| `(GET|POST|PUT|PATCH) (/api/v1/[^`]+)` \| `(\w+)`', document))
    actual = {(method, path): data for path, methods in spec['paths'].items()
              for method, data in methods.items() if method in ('get', 'post', 'put', 'patch')}
    issues = []
    for key in expected.keys() | actual.keys():
        if key not in actual or key not in expected:
            issues.append(f'Route mismatch: {key}')
        elif actual[key]['operationId'] != expected[key]:
            issues.append(f'Operation ID mismatch: {key}')
    declarations = json.loads((folder / 'typescript-contract.json').read_text())['declarations']
    for name, info in declarations.items():
        model = getattr(dto, name, getattr(common, name, None))
        if get_origin(model) is Literal:
            literals = re.findall(r"'([^']+)'", info['signature'])
            if set(literals) != set(get_args(model)):
                issues.append(f'{name}: enum mismatch')
        if info['fields'] is None or model is None or not hasattr(model, 'model_fields'):
            continue
        for field in info['fields']:
            if field['name'] not in model.model_fields:
                issues.append(f'{name}.{field["name"]}: missing backend field')
                continue
            backend_field = model.model_fields[field['name']]
            if not field['optional'] and not backend_field.is_required():
                issues.append(f'{name}.{field["name"]}: backend allows omission')
            schema = model.model_json_schema()['properties'][field['name']]
            nullable = any(t.get('type') == 'null' for t in schema.get('anyOf', []))
            if field['nullable'] != nullable:
                issues.append(f'{name}.{field["name"]}: nullability mismatch')
    for name in ('AgentRequest', 'AgentResult', 'EvidenceReference'):
        if set(getattr(agent_adapter, name).model_fields) != set(getattr(schemas, name).model_fields):
            issues.append(f'AI wire field mismatch: {name}')
    for role, names in evidence_gateway.ALLOWLIST.items():
        if set(selection.allowed_tools(role)) != names:
            issues.append(f'Tool role mismatch: {role}')
    for name, fields in tool_schemas.TOOL_FIELDS.items():
        own = set(selection.TOOL_INPUTS[name].model_fields)
        # AI validates tool arguments before E2 injects/validates the common scope.
        common_fields = {'protocol_version_id'} if name == 'classify_event_relevance' else set()
        if own != set(fields) | common_fields:
            issues.append(f'Tool argument fields mismatch: {name}')
    rows = [{'method': method.upper(), 'path': path, 'operation_id': data['operationId'],
             'success_statuses': [s for s in data['responses'] if s.startswith('2')]}
            for (method, path), data in actual.items()]
    result = {'contract': spec['info']['version'], 'route_count': len(actual), 'routes': rows, 'issues': issues}
    (folder / 'contract-audit.json').write_text(json.dumps(result, indent=2), encoding='utf-8')
    print(json.dumps(result, indent=2))
    raise SystemExit(bool(issues))


if __name__ == '__main__':
    main()
