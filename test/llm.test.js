const test = require('node:test');
const assert = require('node:assert');
const llm = require('../src/modules/llm');
const { open } = require('../src/db');

const KEYS = ['ANTHROPIC_API_KEY', 'OPENAI_API_KEY', 'DEEPSEEK_API_KEY', 'LLM_PROVIDER'];
async function conEnv(env, fn) {
  const prev = Object.fromEntries(KEYS.map(k => [k, process.env[k]]));
  KEYS.forEach(k => delete process.env[k]);
  Object.assign(process.env, env);
  try { return await fn(); } finally { KEYS.forEach(k => prev[k] === undefined ? delete process.env[k] : (process.env[k] = prev[k])); }
}
const fake = (json, cap = {}) => async (url, opts) => { cap.url = url; cap.opts = opts; cap.body = JSON.parse(opts.body); return { ok: true, json: async () => json }; };

test('por defecto Anthropic; status no expone claves y marca configurados', () => conEnv({ OPENAI_API_KEY: 'sk-secreta' }, () => {
  const s = llm.status(open(':memory:'));
  assert.equal(s.activo.provider, 'anthropic');
  assert.equal(s.proveedores.find(p => p.id === 'openai').configurado, true);
  assert.equal(s.proveedores.find(p => p.id === 'deepseek').configurado, false);
  assert.ok(!JSON.stringify(s).includes('sk-secreta'));
}));

test('configure valida proveedor y persiste proveedor y modelo', () => conEnv({}, () => {
  const d = open(':memory:');
  assert.throws(() => llm.configure(d, { provider: 'x' }), /inválido/);
  llm.configure(d, { provider: 'deepseek', model: 'deepseek-reasoner' });
  assert.deepEqual(llm.active(d), { provider: 'deepseek', model: 'deepseek-reasoner' });
}));

test('DeepSeek usa su endpoint con formato chat y devuelve texto', () => conEnv({ DEEPSEEK_API_KEY: 'k' }, async () => {
  const d = open(':memory:'); const cap = {};
  llm.configure(d, { provider: 'deepseek' });
  const r = await llm.complete(d, { sistema: 'S', prompt: 'P' }, fake({ choices: [{ message: { content: ' hola ' } }] }, cap));
  assert.equal(cap.url, 'https://api.deepseek.com/chat/completions');
  assert.equal(cap.opts.headers.authorization, 'Bearer k');
  assert.equal(cap.body.messages[0].role, 'system');
  assert.deepEqual([r.texto, r.provider], ['hola', 'deepseek']);
}));

test('OpenAI usa su endpoint; sin clave 503 nombrando la variable', () => conEnv({}, async () => {
  const d = open(':memory:'); llm.configure(d, { provider: 'openai' });
  await assert.rejects(llm.complete(d, { sistema: 'S', prompt: 'P' }), e => e.status === 503 && /OPENAI_API_KEY/.test(e.message));
  process.env.OPENAI_API_KEY = 'k'; const cap = {};
  await llm.complete(d, { sistema: 'S', prompt: 'P' }, fake({ choices: [{ message: { content: 'x' } }] }, cap));
  assert.equal(cap.url, 'https://api.openai.com/v1/chat/completions');
}));

test('429 y respuestas sin texto se reportan claramente', () => conEnv({ ANTHROPIC_API_KEY: 'k' }, async () => {
  const d = open(':memory:');
  await assert.rejects(llm.complete(d, { sistema: 'S', prompt: 'P' }, async () => ({ ok: false, status: 429, text: async () => '' })), e => e.status === 429);
  await assert.rejects(llm.complete(d, { sistema: 'S', prompt: 'P' }, fake({ content: [] })), e => e.status === 502);
}));
