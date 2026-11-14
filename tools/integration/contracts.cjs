// Compare actual TypeScript declarations with the normative contract block using the TS scanner.
const fs = require('node:fs');
const ts = require('../../frontend/node_modules/typescript');
const doc = fs.readFileSync('docs/API_CONTRACTS.md', 'utf8').match(/```typescript\s+([\s\S]*?)```/)[1];
function tokens(text) {
  const scanner = ts.createScanner(ts.ScriptTarget.Latest, true, ts.LanguageVariant.Standard, text);
  const parts = [];
  while (scanner.scan() !== ts.SyntaxKind.EndOfFileToken) parts.push(scanner.getTokenText());
  return parts.join(' ');
}
function declarations(text) {
  const source = ts.createSourceFile('contract.ts', text, ts.ScriptTarget.Latest, true);
  return Object.fromEntries(source.statements.filter(n => ts.isTypeAliasDeclaration(n) || ts.isInterfaceDeclaration(n))
    .map(n => [n.name.text, { signature: tokens(n.getText(source)), fields: ts.isInterfaceDeclaration(n)
      ? n.members.map(m => ({ name: m.name.getText(source), optional: !!m.questionToken,
        nullable: !!m.type && ts.isUnionTypeNode(m.type) && m.type.types.some(t =>
          ts.isLiteralTypeNode(t) && t.literal.kind === ts.SyntaxKind.NullKeyword) })) : null }]));
}
const expected = declarations(doc);
const actual = declarations(fs.readFileSync('frontend/lib/api/types.ts', 'utf8'));
const mismatches = Object.keys(expected).filter(name => expected[name].signature !== actual[name]?.signature);
fs.mkdirSync('artifacts/integration', {recursive:true});
fs.writeFileSync('artifacts/integration/typescript-contract.json', JSON.stringify({ count: Object.keys(expected).length, mismatches, declarations: expected }, null, 2));
console.log(JSON.stringify({ normative_declarations: Object.keys(expected).length, mismatches }));
process.exitCode = mismatches.length ? 1 : 0;
