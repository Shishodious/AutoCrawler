/**
 * LLM-powered extraction (the moat).
 * Feeds cleaned page text + a target field schema to Claude and forces a
 * JSON response via structured outputs, so the result validates against the
 * requested shape. Works on any page with no site-specific selectors.
 *
 * Gated on ANTHROPIC_API_KEY — without it, callers get a clear, catchable
 * error instead of a crash (so selector/structured-data paths still work).
 */
const Anthropic = require('@anthropic-ai/sdk');
const env = require('../../config/env');
const logger = require('../../config/logger');

// Configurable; defaults to Sonnet 5 for the extraction cost/quality balance.
const MODEL = env.LLM_MODEL || 'claude-sonnet-5';
const MAX_INPUT_CHARS = 24000; // keep prompt bounded; extraction rarely needs more

let client = null;
function getClient() {
  if (!process.env.ANTHROPIC_API_KEY) {
    const err = new Error(
      'LLM extraction unavailable: ANTHROPIC_API_KEY is not configured'
    );
    err.code = 'LLM_UNAVAILABLE';
    throw err;
  }
  if (!client) client = new Anthropic();
  return client;
}

function isLlmAvailable() {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

/**
 * Build a JSON Schema from the user's requested fields.
 * fields: [{ name, type?: 'string'|'number'|'boolean'|'string[]', description? }]
 */
function buildSchema(fields) {
  const properties = {};
  const required = [];
  for (const f of fields) {
    let prop;
    switch (f.type) {
      case 'number':
        prop = { type: ['number', 'null'] };
        break;
      case 'boolean':
        prop = { type: ['boolean', 'null'] };
        break;
      case 'string[]':
        prop = { type: ['array', 'null'], items: { type: 'string' } };
        break;
      default:
        prop = { type: ['string', 'null'] };
    }
    if (f.description) prop.description = f.description;
    properties[f.name] = prop;
    required.push(f.name);
  }
  return {
    type: 'object',
    properties,
    required,
    additionalProperties: false
  };
}

/**
 * @param {Object} params
 * @param {string} params.text - cleaned page text
 * @param {Array}  params.fields - requested fields (see buildSchema)
 * @param {string} [params.url]
 * @returns {Promise<Object>} extracted field → value (nulls where absent)
 */
async function extractWithLlm({ text, fields, url }) {
  const anthropic = getClient();
  const schema = buildSchema(fields);
  const truncated = (text || '').slice(0, MAX_INPUT_CHARS);

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 4096,
    thinking: { type: 'disabled' }, // extraction is a lookup task; skip thinking for cost/latency
    output_config: { format: { type: 'json_schema', schema } },
    system:
      'You extract structured data from web page text. Return only the requested ' +
      'fields. Use null for any field not present in the text. Do not invent values.',
    messages: [
      {
        role: 'user',
        content:
          `Extract the requested fields from this web page${url ? ` (${url})` : ''}.\n\n` +
          `PAGE TEXT:\n${truncated}`
      }
    ]
  });

  if (response.stop_reason === 'refusal') {
    const err = new Error('LLM extraction was declined for this content');
    err.code = 'LLM_REFUSAL';
    throw err;
  }

  const textBlock = response.content.find((b) => b.type === 'text');
  if (!textBlock) {
    throw new Error('LLM extraction returned no content');
  }

  try {
    return JSON.parse(textBlock.text);
  } catch (err) {
    logger.warn({ err: err.message }, '[LLM] Failed to parse extraction output');
    throw new Error('LLM extraction returned invalid JSON');
  }
}

module.exports = { extractWithLlm, isLlmAvailable, MODEL };
