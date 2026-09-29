/* Claude coach and question generator, called with the student's own Anthropic API key.
   Loaded only when the coach or the generator is used. vendor/anthropic-sdk.js is the official
   @anthropic-ai/sdk (0.129.0, MIT) bundled for the browser with esbuild. */
import Anthropic from './vendor/anthropic-sdk.js';

const MODEL = 'claude-opus-5-5';
// If a safety classifier declines a request, the API retries it on its recommended fallback model.
const FALLBACK = { fallbacks: 'default', betas: ['server-side-fallback-2026-07-01'] };

function client(key){ return new Anthropic({ apiKey: key, dangerouslyAllowBrowser: true }); }

function mapError(e){
  if (e instanceof Anthropic.APIUserAbortError) return { code:'cancelled' };
  if (e instanceof Anthropic.AuthenticationError || e instanceof Anthropic.PermissionDeniedError) return { code:'bad_key' };
  if (e instanceof Anthropic.NotFoundError) return { code:'bad_model' };
  if (e instanceof Anthropic.RateLimitError) return { code:'rate_limited' };
  if (e instanceof Anthropic.APIConnectionError) return { code:'network' };
  if (e instanceof Anthropic.InternalServerError) return { code:'overloaded' };
  if (e instanceof Anthropic.APIError) return { code:'api', text: e.message };
  if (e && e.name === 'AbortError') return { code:'cancelled' };
  return e && e.code ? e : { code:'unknown' };
}
const textOf = msg => msg.content.filter(b => b.type === 'text').map(b => b.text).join('');

/* The API expects alternating turns that start with the user. */
function tidy(messages){
  const out = [];
  for (const m of messages){
    if (!out.length && m.role !== 'user') continue;
    const last = out[out.length - 1];
    if (last && last.role === m.role) last.content += '\n\n' + m.content;
    else out.push({ role: m.role, content: String(m.content) });
  }
  return out;
}

/* Streaming chat for the coach. onText receives the text so far. */
export async function chat(key, messages, { system, signal, onText } = {}){
  let text = '';
  try {
    const stream = client(key).beta.messages.stream({
      model: MODEL, max_tokens: 64000, system, messages: tidy(messages),
      output_config: { effort: 'medium' }, ...FALLBACK,
    }, { signal });
    stream.on('text', d => { text += d; if (onText) onText({ text }); });
    const msg = await stream.finalMessage();
    if (msg.stop_reason === 'refusal') throw { code:'refused' };
    return { text: textOf(msg) };
  } catch(e){ const m = mapError(e); if (m.code === 'cancelled' && text) m.text = text; throw m; }
}

/* One JSON object that matches `schema` (structured outputs). */
export async function json(key, prompt, { schema, signal } = {}){
  let msg;
  try {
    const stream = client(key).beta.messages.stream({
      model: MODEL, max_tokens: 64000, messages: [{ role:'user', content: prompt }],
      output_config: { effort: 'high', ...(schema ? { format: { type:'json_schema', schema } } : {}) }, ...FALLBACK,
    }, { signal });
    msg = await stream.finalMessage();
  } catch(e){ throw mapError(e); }
  if (msg.stop_reason === 'refusal') throw { code:'refused' };
  if (msg.stop_reason === 'max_tokens') throw { code:'invalid_json' };
  const t = textOf(msg);
  try { return JSON.parse(t); }
  catch(e){ const a = t.indexOf('{'), b = t.lastIndexOf('}'); if (a >= 0 && b > a){ try { return JSON.parse(t.slice(a, b + 1)); } catch(_){} } throw { code:'invalid_json' }; }
}
