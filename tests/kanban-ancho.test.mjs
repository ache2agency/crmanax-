import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'
import * as runtime from 'react/jsx-runtime'
import { renderToStaticMarkup } from 'react-dom/server'

const root = new URL('../', import.meta.url)
const crmSource = readFileSync(new URL('app/crm.jsx', root), 'utf8')
const jsxOptions = { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX }
function load(source, mocks, globals = {}) {
  const exports = {}
  runInNewContext(ts.transpileModule(source, { compilerOptions: jsxOptions }).outputText, {
    exports, ...globals, require: name => {
      assert.ok(name in mocks, `Importación sin simular: ${name}`)
      return mocks[name]
    },
  })
  return exports.default
}

// Render del CRM real sin ejecutar efectos ni permitir red, con un admin ficticio.
export function crmTree(view = 'kanban', source = crmSource) {
  const fixture = {
    view, loading: false, currentProfile: { rol: 'admin' },
    leads: Array.from({ length: 579 }, (_, i) => ({
      id: `ficticio-${i}`, nombre: `Prospecto ${i}`, stage: 'nuevo_contacto', valor: 0,
    })),
  }
  const ast = ts.createSourceFile('crm.jsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JSX)
  assert.equal(ast.parseDiagnostics.length, 0)
  const replacements = []
  function visit(node) {
    if (ts.isVariableDeclaration(node) && ts.isArrayBindingPattern(node.name)) {
      const name = node.name.elements[0].getText(ast)
      if (Object.hasOwn(fixture, name)) {
        const arg = node.initializer.arguments[0]
        replacements.push([arg.getStart(ast), arg.end, `fixture.${name}`])
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(ast)
  for (const [start, end, text] of replacements.sort((a, b) => b[0] - a[0])) {
    source = source.slice(0, start) + text + source.slice(end)
  }
  const mocks = {
    'react/jsx-runtime': runtime,
    react: { useState: v => [v, () => {}], useEffect: () => {}, useRef: v => ({ current: v }), useMemo: fn => fn() },
    '@/utils/supabase/client': { createClient: () => ({}) },
    '@/lib/whatsapp/iniciar': { conversacionDelLead: () => null },
  }
  for (const match of source.matchAll(/import (\w+) from "(@\/components\/crm\/[^"\n]+)"/g)) {
    mocks[match[2]] = { default: () => runtime.jsx('div', { 'data-panel': match[1] }) }
  }
  mocks['@/components/crm/KanbanBoard'] = { default: load(
    readFileSync(new URL('components/crm/KanbanBoard.jsx', root), 'utf8'),
    { 'react/jsx-runtime': runtime },
  ) }
  return load(source, mocks, { fixture })()
}

export function nodes(tree) {
  if (Array.isArray(tree)) return tree.flatMap(nodes)
  if (!tree || typeof tree !== 'object') return []
  return [tree, ...nodes(tree.props?.children)]
}

test('43: stats y filtros quedan fuera del único scroll horizontal de las columnas', () => {
  const tree = crmTree()
  const all = nodes(tree)
  const outer = all.find(n => n.props?.className === 'kanban-wrapper')
  const scroll = all.find(n => n.props?.className === 'kanban-scroll')
  assert.equal(outer.props.style.overflowX, 'hidden')
  assert.equal(outer.props.children.props.style.minWidth, undefined)
  assert.equal(scroll.props.style.overflowX, 'auto')
  assert.equal(scroll.props.style.WebkitOverflowScrolling, 'touch')
  assert.equal(scroll.props.style.overscrollBehaviorX, 'contain')
  assert.equal(scroll.props.style.background, '#f5f7fa')
  const html = renderToStaticMarkup(tree)
  assert.match(html, /min-width:max-content/)
  const stats = all.find(n => n.props?.className === 'stat-card-grid')
  assert.ok(stats)
  assert.ok(!nodes(scroll).includes(stats))
  const filters = all.find(n => nodes(n.props?.children).some(c => c.type === 'input' && c.props.placeholder?.includes('Buscar lead')) && n.props?.style?.marginBottom === 24)
  assert.equal(filters.props.style.flexWrap, 'wrap')
  const actions = nodes(filters).find(n => n.props?.style?.marginLeft === 'auto')
  assert.equal(actions.props.style.flexWrap, 'wrap')
  assert.ok(!nodes(scroll).includes(filters))
})

for (const view of ['convs', 'agenda', 'disponibilidad', 'lista']) {
  test(`43: ${view} conserva su layout sin el scroll de Kanban`, () => {
    const tree = crmTree(view)
    assert.ok(!nodes(tree).some(n => n.props?.className === 'kanban-scroll'))
    assert.ok(!nodes(tree).some(n => n.props?.className === 'kanban-wrapper'))
    assert.doesNotMatch(renderToStaticMarkup(tree), /min-width:max-content/)
  })
}
