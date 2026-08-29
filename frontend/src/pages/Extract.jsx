import React, { useEffect, useState } from 'react';
import {
  startExtract,
  getCrawlJob,
  getExtractTemplates,
  createExtractTemplate,
  deleteExtractTemplate,
} from '../api';
import { getSocket } from '../services/socket';
import {
  Wand2,
  Plus,
  Trash2,
  Loader2,
  Save,
  FileJson,
  AlertTriangle,
  CheckCircle,
} from 'lucide-react';

const FIELD_TYPES = ['string', 'number', 'boolean', 'string[]'];

const Extract = () => {
  const [url, setUrl] = useState('');
  const [mode, setMode] = useState('auto'); // 'auto' | 'selectors' | 'llm'
  const [fields, setFields] = useState([{ name: '', type: 'string', description: '' }]);
  const [selectors, setSelectors] = useState([{ field: '', selector: '' }]);

  const [templates, setTemplates] = useState([]);
  const [status, setStatus] = useState('idle'); // idle | queued | running | complete | error
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [saveName, setSaveName] = useState('');

  useEffect(() => {
    getExtractTemplates()
      .then((r) => setTemplates(r.data.data || []))
      .catch(() => {});
  }, []);

  const addField = () => setFields([...fields, { name: '', type: 'string', description: '' }]);
  const removeField = (i) => setFields(fields.filter((_, idx) => idx !== i));
  const updateField = (i, key, val) =>
    setFields(fields.map((f, idx) => (idx === i ? { ...f, [key]: val } : f)));

  const addSelector = () => setSelectors([...selectors, { field: '', selector: '' }]);
  const removeSelector = (i) => setSelectors(selectors.filter((_, idx) => idx !== i));
  const updateSelector = (i, key, val) =>
    setSelectors(selectors.map((s, idx) => (idx === i ? { ...s, [key]: val } : s)));

  const buildPayload = () => {
    const payload = { url, mode };
    const cleanFields = fields.filter((f) => f.name.trim());
    if (cleanFields.length) payload.fields = cleanFields;
    if (mode === 'selectors' || mode === 'auto') {
      const sel = {};
      selectors.forEach((s) => {
        if (s.field.trim() && s.selector.trim()) sel[s.field.trim()] = s.selector.trim();
      });
      if (Object.keys(sel).length) payload.selectors = sel;
    }
    return payload;
  };

  const pollJob = async (jobId) => {
    for (let i = 0; i < 300; i++) {
      const { data } = await getCrawlJob(jobId);
      setStatus(data.state === 'active' ? 'running' : status);
      if (data.state === 'completed') return data.result;
      if (data.state === 'failed') throw new Error(data.failedReason || 'Extraction failed');
      await new Promise((r) => setTimeout(r, 2000));
    }
    throw new Error('Extraction timed out');
  };

  const runExtract = async () => {
    if (!url) return;
    setStatus('queued');
    setResult(null);
    setError(null);
    try {
      const socket = getSocket();
      const resp = await startExtract(buildPayload(), socket?.id);
      const jobResult = await pollJob(resp.jobId);
      setResult(jobResult);
      setStatus('complete');
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Extraction failed');
      setStatus('error');
    }
  };

  const applyTemplate = (t) => {
    setMode(t.mode || 'auto');
    if (t.fields?.length) setFields(t.fields.map((f) => ({ name: f.name, type: f.type || 'string', description: f.description || '' })));
    if (t.selectors) setSelectors(Object.entries(t.selectors).map(([field, selector]) => ({ field, selector })));
  };

  const saveTemplate = async () => {
    if (!saveName.trim()) return;
    const cleanFields = fields.filter((f) => f.name.trim());
    if (!cleanFields.length) {
      setError('Add at least one field before saving a template');
      return;
    }
    const sel = {};
    selectors.forEach((s) => {
      if (s.field.trim() && s.selector.trim()) sel[s.field.trim()] = s.selector.trim();
    });
    try {
      const r = await createExtractTemplate({
        name: saveName.trim(),
        mode,
        fields: cleanFields,
        ...(Object.keys(sel).length ? { selectors: sel } : {}),
      });
      setTemplates([r.data.data, ...templates]);
      setSaveName('');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save template');
    }
  };

  const removeTemplate = async (id) => {
    await deleteExtractTemplate(id).catch(() => {});
    setTemplates(templates.filter((t) => t._id !== id));
  };

  const inputClass =
    'w-full rounded-lg border border-hairline bg-dark-light/60 px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-primary focus:outline-none';

  return (
    <div className="container mx-auto max-w-4xl px-6 py-10">
      <div className="mb-8 text-center">
        <h1 className="text-4xl font-extrabold tracking-tight">
          <span className="text-gradient">Extract structured data</span>
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-gray-400">
          Point at any URL and pull the exact fields you want — via CSS selectors or AI.
        </p>
      </div>

      {/* Templates */}
      {templates.length > 0 && (
        <div className="mb-6 flex flex-wrap gap-2">
          {templates.map((t) => (
            <div key={t._id} className="flex items-center gap-1 rounded-lg border border-hairline bg-dark-light/60 px-3 py-1.5 text-sm">
              <button onClick={() => applyTemplate(t)} className="text-gray-300 hover:text-white">{t.name}</button>
              <button onClick={() => removeTemplate(t._id)} className="text-gray-600 hover:text-danger"><Trash2 className="h-3.5 w-3.5" /></button>
            </div>
          ))}
        </div>
      )}

      <div className="glass-card space-y-5 rounded-2xl p-6">
        <input className={inputClass} placeholder="https://example.com/page" value={url} onChange={(e) => setUrl(e.target.value)} />

        {/* Mode toggle */}
        <div className="flex gap-2">
          {['auto', 'selectors', 'llm'].map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`rounded-lg px-4 py-1.5 text-sm font-medium capitalize transition-all ${
                mode === m ? 'bg-primary/20 text-primary-soft' : 'text-gray-400 hover:bg-white/5'
              }`}
            >
              {m === 'llm' ? 'AI' : m}
            </button>
          ))}
        </div>

        {/* Fields (used by auto + llm) */}
        {(mode === 'auto' || mode === 'llm') && (
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Fields to extract</p>
            {fields.map((f, i) => (
              <div key={i} className="flex gap-2">
                <input className={inputClass} placeholder="field name" value={f.name} onChange={(e) => updateField(i, 'name', e.target.value)} />
                <select className={`${inputClass} w-32`} value={f.type} onChange={(e) => updateField(i, 'type', e.target.value)}>
                  {FIELD_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
                <button onClick={() => removeField(i)} className="text-gray-600 hover:text-danger"><Trash2 className="h-4 w-4" /></button>
              </div>
            ))}
            <button onClick={addField} className="flex items-center gap-1 text-sm text-primary-soft hover:text-white"><Plus className="h-4 w-4" /> Add field</button>
          </div>
        )}

        {/* Selectors (used by auto + selectors) */}
        {(mode === 'auto' || mode === 'selectors') && (
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">CSS selectors (optional; use <code>@attr</code> for attributes)</p>
            {selectors.map((s, i) => (
              <div key={i} className="flex gap-2">
                <input className={inputClass} placeholder="field name" value={s.field} onChange={(e) => updateSelector(i, 'field', e.target.value)} />
                <input className={inputClass} placeholder="h1, a.link@href" value={s.selector} onChange={(e) => updateSelector(i, 'selector', e.target.value)} />
                <button onClick={() => removeSelector(i)} className="text-gray-600 hover:text-danger"><Trash2 className="h-4 w-4" /></button>
              </div>
            ))}
            <button onClick={addSelector} className="flex items-center gap-1 text-sm text-primary-soft hover:text-white"><Plus className="h-4 w-4" /> Add selector</button>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={runExtract}
            disabled={!url || status === 'queued' || status === 'running'}
            className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-primary to-secondary px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50"
          >
            {status === 'queued' || status === 'running' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
            {status === 'queued' ? 'Queued…' : status === 'running' ? 'Extracting…' : 'Extract'}
          </button>
          <div className="flex items-center gap-2">
            <input className={`${inputClass} w-40`} placeholder="save as template…" value={saveName} onChange={(e) => setSaveName(e.target.value)} />
            <button onClick={saveTemplate} className="flex items-center gap-1 rounded-lg border border-hairline px-3 py-2 text-sm text-gray-300 hover:text-white"><Save className="h-4 w-4" /> Save</button>
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mt-5 flex items-start gap-3 rounded-xl border border-danger/40 bg-danger/10 p-4 text-danger">
          <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0" />
          <p className="text-sm">{error}</p>
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="mt-5 glass-card rounded-2xl p-6">
          <h3 className="mb-3 flex items-center gap-2 text-lg font-bold text-white">
            <CheckCircle className="h-5 w-5 text-success" /> Extracted
            <span className="ml-2 rounded-md bg-primary/15 px-2 py-0.5 text-xs font-medium text-primary-soft">{result.mode} · {result.method}</span>
          </h3>
          {result.data && Object.keys(result.data).length > 0 && (
            <div className="mb-4 overflow-x-auto rounded-lg border border-hairline">
              <table className="w-full text-sm">
                <tbody>
                  {Object.entries(result.data).map(([k, v]) => (
                    <tr key={k} className="border-b border-hairline/50 last:border-0">
                      <td className="px-3 py-2 font-medium text-gray-400 align-top">{k}</td>
                      <td className="px-3 py-2 text-gray-200">{Array.isArray(v) ? v.join(' · ') : String(v ?? '—')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <details>
            <summary className="flex cursor-pointer items-center gap-1 text-sm text-primary-soft"><FileJson className="h-4 w-4" /> Raw JSON</summary>
            <pre className="mt-2 max-h-80 overflow-auto rounded-lg bg-dark/60 p-3 text-xs text-gray-300">{JSON.stringify(result, null, 2)}</pre>
          </details>
        </div>
      )}
    </div>
  );
};

export default Extract;
