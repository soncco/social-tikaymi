// Administrador de proveedores de IA. Las claves viven SOLO en variables de entorno; en la base de datos
// (tabla settings) se guarda únicamente qué proveedor y modelo están activos.
const err = (status, message) => Object.assign(new Error(message), { status });

const PROVIDERS = {
  anthropic: {
    label: 'Anthropic (Claude)', keyEnv: 'ANTHROPIC_API_KEY', modelEnv: 'ANTHROPIC_MODEL', defaultModel: 'claude-sonnet-5',
    request: (key, model, { sistema, prompt }, budget) => ({
      url: 'https://api.anthropic.com/v1/messages',
      headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
      body: { model, max_tokens: budget, system: sistema, messages: [{ role: 'user', content: prompt }] },
    }),
    extract: d => (d?.content || []).filter(b => b?.type === 'text').map(b => b.text).join('\n'),
  },
  openai: {
    label: 'OpenAI', keyEnv: 'OPENAI_API_KEY', modelEnv: 'OPENAI_MODEL', defaultModel: 'gpt-4o',
    request: (key, model, p, budget) => ({ url: 'https://api.openai.com/v1/chat/completions', ...chat(key, model, p, budget) }),
    extract: d => d?.choices?.[0]?.message?.content,
  },
  deepseek: {
    label: 'DeepSeek', keyEnv: 'DEEPSEEK_API_KEY', modelEnv: 'DEEPSEEK_MODEL', defaultModel: 'deepseek-flash',
    request: (key, model, p, budget) => ({ url: 'https://api.deepseek.com/chat/completions', ...chat(key, model, p, budget) }),
    extract: d => d?.choices?.[0]?.message?.content,
  },
};

// OpenAI y DeepSeek comparten el formato "chat completions"
function chat(key, model, { sistema, prompt }, budget) {
  return {
    headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
    body: { model, max_tokens: budget, messages: [{ role: 'system', content: sistema }, { role: 'user', content: prompt }] },
  };
}

const getSetting = (db, k) => db.prepare('SELECT value FROM settings WHERE key=?').get(k)?.value;

function active(db) {
  const name = getSetting(db, 'llm_provider') || process.env.LLM_PROVIDER || 'anthropic';
  const p = PROVIDERS[name] || PROVIDERS.anthropic;
  const id = PROVIDERS[name] ? name : 'anthropic';
  return { provider: id, model: getSetting(db, 'llm_model_' + id) || process.env[p.modelEnv] || p.defaultModel };
}

// Estado para la UI: nunca expone las claves, solo si están configuradas.
function status(db) {
  const a = active(db);
  return {
    activo: a,
    proveedores: Object.entries(PROVIDERS).map(([id, p]) => ({
      id, label: p.label, clave_env: p.keyEnv, configurado: !!process.env[p.keyEnv],
      modelo: id === a.provider ? a.model : (getSetting(db, 'llm_model_' + id) || process.env[p.modelEnv] || p.defaultModel),
    })),
  };
}

function configure(db, { provider, model }) {
  if (!PROVIDERS[provider]) throw err(400, `Proveedor inválido: ${provider}. Opciones: ${Object.keys(PROVIDERS).join(', ')}`);
  const set = db.prepare('INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value');
  set.run('llm_provider', provider);
  if (model && String(model).trim()) set.run('llm_model_' + provider, String(model).trim());
  return status(db);
}

const DEFAULT_BUDGET = 4000;

async function complete(db, partes, fetchImpl, options = {}) {
  const { provider, model } = active(db);
  const p = PROVIDERS[provider];
  const key = process.env[p.keyEnv];
  if (!key) throw err(503, `Falta ${p.keyEnv}: configura la clave en el entorno (.env) para usar ${p.label}, o elige otro proveedor.`);
  const budget = Number(options.maxTokens || process.env.LLM_MAX_TOKENS || DEFAULT_BUDGET);
  const outputBudget = Number.isFinite(budget) && budget > 0 ? budget : DEFAULT_BUDGET;
  const req = p.request(key, model, partes, outputBudget);
  if (provider === 'deepseek') req.body.thinking = { type: process.env.DEEPSEEK_THINKING === 'enabled' ? 'enabled' : 'disabled' };
  let res;
  try {
    res = await (fetchImpl || globalThis.fetch)(req.url, { method: 'POST', headers: req.headers, body: JSON.stringify(req.body) });
  } catch (e) {
    console.error(`[llm] error de red con ${p.label}:`, e.message);
    throw err(502, `No se pudo contactar con la API de ${p.label}: ${e.message}`);
  }
  if (!res.ok) {
    const detalle = await res.text().catch(() => '');
    console.error(`[llm] ${p.label} respondió ${res.status}${res.status === 429 ? ' (límite de uso alcanzado)' : ''}: ${detalle.slice(0, 500)}`);
    throw err(res.status === 429 ? 429 : 502, res.status === 429
      ? `Límite de uso de la API de ${p.label} alcanzado; reintenta más tarde o cambia de proveedor.`
      : `La API de ${p.label} devolvió ${res.status}.`);
  }
  let data = await res.json();
  let texto = String(p.extract(data) || '').trim();
  // Algunos modelos de razonamiento (p. ej. DeepSeek) pueden consumir todo
  // el presupuesto en reasoning_content y devolver content vacío. Nunca
  // guardamos ese razonamiento como copy: hacemos una única recuperación con
  // presupuesto ampliado y una instrucción explícita de salida final.
  if (!texto && data?.choices?.[0]?.message?.reasoning_content && !options._retriedEmpty) {
    const retryBudget = Math.min(Math.max(outputBudget * 2, 8000), 12000);
    const retryPartes = { ...partes, prompt: `${partes.prompt}\n\nRESPUESTA FINAL OBLIGATORIA: omite cualquier razonamiento interno y devuelve únicamente el resultado solicitado. No dejes el campo content vacío.` };
    const retryReq = p.request(key, model, retryPartes, retryBudget);
    if (provider === 'deepseek') retryReq.body.thinking = { type: process.env.DEEPSEEK_THINKING === 'enabled' ? 'enabled' : 'disabled' };
    try {
      const retryRes = await (fetchImpl || globalThis.fetch)(retryReq.url, { method:'POST', headers:retryReq.headers, body:JSON.stringify(retryReq.body) });
      if (retryRes.ok) {
        data = await retryRes.json();
        texto = String(p.extract(data) || '').trim();
      }
    } catch (e) {
      console.error(`[llm] recuperación de respuesta vacía falló para ${p.label}:`, e.message);
    }
    if (texto) return { texto, provider, model, budget:retryBudget, stop_reason:data.stop_reason || data.choices?.[0]?.finish_reason || null, truncated:false, usage:data.usage || null, recovered_empty:true };
  }
  if (!texto) {
    console.error(`[llm] respuesta incompleta de ${p.label}: modelo=${model}, tiene_reasoning=${!!data?.choices?.[0]?.message?.reasoning_content}`);
    const detalle = data?.choices?.[0]?.message?.reasoning_content
      ? ' El modelo devolvió razonamiento sin respuesta final; reinicia el servidor para aplicar el modo de salida configurado.'
      : '';
    throw err(502, `La API de ${p.label} devolvió una respuesta sin texto.${detalle}`);
  }
  const stopReason = data.stop_reason || data.choices?.[0]?.finish_reason || null;
  const truncated = stopReason === 'max_tokens' || stopReason === 'length';
  return { texto, provider, model, budget:outputBudget, stop_reason: stopReason, truncated, usage: data.usage || null };
}

module.exports = { PROVIDERS, active, status, configure, complete };
