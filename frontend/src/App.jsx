import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { api, clearSession, jsonBody, saveSession } from './api';
import { Activity, ArrowRight, Building2, Check, ChevronDown, ChevronLeft, ChevronRight, CircleAlert, ClipboardCheck, Download, FileArchive, FileCheck2, FileText, Fingerprint, Gauge, GitBranch, History, Home, Layers3, ListChecks, LockKeyhole, LogOut, Menu, PanelLeftClose, Plus, RefreshCw, Search, ScanSearch, Shield, ShieldCheck, SlidersHorizontal, Upload, User, Users, X } from 'lucide-react';
import * as d3 from 'd3';
import JSZip from 'jszip';

const roles = { client: 'Client', auditor: 'Independent auditor', admin: 'Platform administrator' };
const nav = {
  client: [['Workspace', [['Overview', '', Home], ['Audit projects', 'projects', Layers3], ['New audit', 'new-audit', Plus]]], ['Evidence', [['Documents & records', 'documents', FileText], ['Audit trail', 'audit-trail', GitBranch], ['Audit archive', 'archive', FileArchive], ['Reports & scanning', 'reports', ScanSearch]]]],
  auditor: [['Workspace', [['Overview', '', Home], ['My audit projects', 'projects', Layers3]]], ['Audit execution', [['Documents & records', 'documents', FileText], ['Audit procedures', 'procedures', ListChecks], ['Risk & sampling', 'sampling', SlidersHorizontal], ['Exceptions', 'exceptions', ClipboardCheck], ['Procedure traceability', 'traceability', Fingerprint], ['Reports & review', 'reports', FileCheck2]]]],
  admin: [['Platform', [['Overview', '', Home], ['User management', 'users', Users], ['Company management', 'companies', Building2], ['Auditor management', 'auditors', Users], ['Audit requests', 'requests', ClipboardCheck]]], ['Operations', [['System monitoring', 'monitoring', Gauge], ['Audit logs', 'logs', History]]]]
};

function Btn({ children, kind = 'dark', className = '', ...props }) { return <button className={`btn btn-${kind} ${className}`.trim()} {...props}>{children}</button>; }
function Pill({ children }) { return <span className="pill">{children}</span>; }
function Header({ eyebrow, title, desc, action }) { return <div className="page-header"><div><small>{eyebrow}</small><h1>{title}</h1><p>{desc}</p></div>{action && <div>{action}</div>}</div>; }
function ErrorBox({ error }) { return error ? <div className="error"><CircleAlert/><span>{error}</span></div> : null; }
function Empty({ children = 'No records are available yet.' }) { return <p className="empty">{children}</p>; }
function Table({ headers, rows }) { return <div className="table-wrap"><table><thead><tr>{headers.map(h => <th key={h}>{h}</th>)}</tr></thead><tbody>{rows.map((row, i) => <tr key={i}>{row.map((cell, j) => <td key={j}>{cell ?? '—'}</td>)}</tr>)}</tbody></table></div>; }
function useApiData(path, dependencies = []) {
  const [data, setData] = useState(null), [error, setError] = useState(''), [loading, setLoading] = useState(Boolean(path));
  const reload = useCallback(async () => {
    if (!path) { setData(null); setLoading(false); return null; }
    setLoading(true); setError('');
    try { const value = await api(path); setData(value); return value; }
    catch (e) { setError(e.message); setData(null); return null; }
    finally { setLoading(false); }
  // Path and explicit dependency changes intentionally reload data from the API.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, ...dependencies]);
  useEffect(() => { reload(); }, [reload]);
  return { data, error, loading, reload };
}

function Landing() {
  const go = useNavigate();
  return <div className="marketing"><header className="site-nav"><Link className="brand" to="/">TRACE<span className="period">.</span></Link><nav><a href="#platform">Platform</a><a href="#workflow">Workflow</a><a href="#integrity">Integrity</a></nav><div className="nav-ctas"><Btn kind="quiet" onClick={() => go('/signin')}>Sign in</Btn><Btn onClick={() => go('/signup')}> <ArrowRight size={15}/></Btn></div></header>
    <section className="hero"><div className="hero-grid"/><div className="hero-copy"><div className="eyebrow"><i/> EVIDENCE-LED REVENUE ASSURANCE</div><h1>Every audit finding<br/>should lead back to<br/><em>the evidence.</em></h1><p>TRACE connects source records, audit procedures, findings, and review history in one controlled workspace.</p><div className="hero-ctas"><Btn onClick={() => go('/signup')}>Create an account <ArrowRight size={16}/></Btn><Link className="textlink" to="/signin">Sign in</Link></div><div className="proof"><span><ShieldCheck/> Permissioned evidence</span><span><GitBranch/> Traceable procedures</span><span><User/> Human review</span></div></div><div className="hero-preview"><div className="preview-top"><span>TRACE WORKFLOW</span><span>LIVE DATA AFTER SIGN IN</span></div><div className="preview-heading"><h3>Evidence to review</h3></div>{[['01','Upload source evidence'],['02','Run deterministic procedures'],['03','Review exceptions'],['04','Preserve the audit trail']].map(([n,label]) => <div className="preview-step" key={n}><span className="step-icon">{n}</span><strong>{label}</strong></div>)}</div></section>
    <section id="platform" className="section manifesto"><div className="section-tag">THE PLATFORM</div><div className="two-col"><h2>Keep the audit work<br/><em>connected to evidence.</em></h2><div className="body-copy"><p>Upload files into an engagement, run repeatable checks, review findings, and preserve the activity history.</p><p>Every account and engagement is backed by the TRACE API and database. No example company records or sample audit results are shown in the workspace.</p></div></div></section>
    <section id="workflow" className="section dark-section"><div className="section-tag light">WORKFLOW</div><div className="step-grid">{[['Evidence','Store uploaded source files with fingerprints.'],['Analysis','Profile supported tables and execute controlled checks.'],['Review','Record findings and evidence request decisions.'],['History','Verify the persisted engagement event chain.']].map(([title, text]) => <article className="step-card" key={title}><h3>{title}</h3><p>{text}</p></article>)}</div></section>
    <section id="integrity" className="section integrity"><div className="integrity-copy"><div className="eyebrow"><i/> ACCESS CONTROL</div><h2>Data access follows the server’s grants.</h2><p>Clients control assigned auditor access. Administrators manage operations without access to confidential client documents.</p><ul><li><Check/> API-enforced permissions</li><li><Check/> Versioned reports and snapshots</li><li><Check/> Tamper-evident event history</li></ul></div></section>
    <footer className="site-footer"><Link className="brand" to="/">TRACE<span className="period">.</span></Link><span>Evidence-led revenue assurance.</span><div><Link to="/signin">Sign in</Link><Link to="/signup"></Link></div></footer>
  </div>;
}

function Auth({ mode }) {
  const go = useNavigate(), [role, setRole] = useState(new URLSearchParams(useLocation().search).get('role') || 'client');
  const [form, setForm] = useState({ name: '', email: '', password: '', organization: '', date_of_birth: '' });
  const [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const update = key => event => setForm(old => ({ ...old, [key]: event.target.value }));
  async function submit(event) {
    event.preventDefault(); setError(''); setBusy(true);
    try {
      const result = mode === 'signin'
        ? await api('/auth/login', { method: 'POST', body: jsonBody({ email: form.email, password: form.password }) })
        : await api('/auth/register', { method: 'POST', body: jsonBody({ ...form, role }) });
      if (mode === 'signin' && result.user.role !== role) throw new Error(`This account is registered as ${roles[result.user.role]}. Select that role to continue.`);
      saveSession(result.access_token, result.user); go(`/app/${result.user.role}`);
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }
  return <div className={`auth auth-${mode}`}><aside className="auth-side"><Link className="brand inverse" to="/">TRACE<span className="period">.</span></Link><div className="auth-story"><div className="eyebrow light"><i/> TRACE WORKSPACE</div><h1>Evidence.<br/>Procedure.<br/><em>Review.</em></h1><p>Sign in to access records stored for your account and authorized engagements.</p></div></aside><main className="auth-main"><div className="auth-top"><Link to="/">‹ Back to TRACE</Link><span>{mode === 'signin' ? '' : 'Already registered?'} <button onClick={() => go(mode === 'signin' ? '/signup' : '/signin')}>{mode === 'signin' ? '' : 'Sign in'}</button></span></div><section className="auth-card"><div className="eyebrow"><i/> {mode === 'signin' ? 'ACCOUNT SIGN IN' : 'ACCOUNT REGISTRATION'}</div><h2>{mode === 'signin' ? 'Sign in to TRACE' : 'Create your account'}</h2><form className="auth-form" onSubmit={submit}>
      {mode === 'signin' && <label>Account role<select value={role} onChange={e => setRole(e.target.value)}><option value="client">Client</option><option value="auditor">Independent auditor</option><option value="admin">Platform administrator</option></select></label>}
      {mode === 'signup' && <><label>Account role<select value={role} onChange={e => setRole(e.target.value)}><option value="client">Client</option><option value="auditor">Independent auditor</option></select></label><label>Full name<input required minLength="2" value={form.name} onChange={update('name')}/></label><label>Organization<input required value={form.organization} onChange={update('organization')}/></label><label>Date of birth<input required type="date" value={form.date_of_birth} onChange={update('date_of_birth')}/></label></>}
      <label>Work email<input required type="email" autoComplete="username" value={form.email} onChange={update('email')}/></label><label>Password<input required minLength={mode === 'signup' ? 10 : undefined} type="password" autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} value={form.password} onChange={update('password')}/></label>
      <ErrorBox error={error}/><Btn disabled={busy}>{busy ? 'Working…' : mode === 'signin' ? 'Sign in' : ''} <ArrowRight size={15}/></Btn>
    </form><p className="auth-note"><LockKeyhole size={14}/> Roles and account details are verified by the API.</p></section></main></div>;
}

function EngagementSelect({ engagements, value, onChange }) { return <label>Engagement<select value={value} onChange={e => onChange(e.target.value)}><option value="">Select an engagement</option>{engagements.map(e => <option key={e.id} value={e.id}>{e.name} · {e.id}</option>)}</select></label>; }
function EngagementTable({ engagements, onAssign }) { return <Table headers={['Engagement', 'Organization', 'Period', 'Scope', 'Status', 'Updated', ...(onAssign ? ['Auditor access'] : [])]} rows={engagements.map(e => [<><strong>{e.name}</strong><small>{e.id}</small></>, e.organization, e.period, e.scope, e.status, e.updated_at ? new Date(e.updated_at).toLocaleString() : '—', ...(onAssign ? [<button className="textlink" onClick={() => onAssign(e)}>{e.auditor_id ? 'Manage access' : 'Assign auditor'}</button>] : [])])}/>; }

function NewAudit({ onCreated }) {
  const [form, setForm] = useState({ name: '', organization: '', period: '', scope: '', required_records: '' }), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const set = key => e => setForm(old => ({ ...old, [key]: e.target.value }));
  async function create(e) { e.preventDefault(); setBusy(true); setError(''); try { const result = await api('/engagements/', { method: 'POST', body: jsonBody({ ...form, required_records: form.required_records.split('\n').map(x => x.trim()).filter(Boolean) }) }); onCreated(result); } catch (err) { setError(err.message); } finally { setBusy(false); } }
  return <section className="panel new-engagement-panel"><header className="new-engagement-heading"><span className="new-engagement-icon"><Plus size={17}/></span><div><small>NEW ENGAGEMENT</small><h2>Engagement details</h2><p>Set up the organization, audit period, and records to review.</p></div></header><form className="formgrid new-engagement-form" onSubmit={create}><label>Organization<input required value={form.organization} onChange={set('organization')}/></label><label>Engagement name<input required value={form.name} onChange={set('name')}/></label><label>Period<input required value={form.period} onChange={set('period')}/></label><label>Scope<input required value={form.scope} onChange={set('scope')}/></label><label className="wide">Required records<textarea rows="3" value={form.required_records} onChange={set('required_records')} placeholder="One record type per line"/></label><div className="new-engagement-actions"><ErrorBox error={error}/><Btn className="create-engagement-btn" disabled={busy}>{busy ? 'Saving…' : 'Create engagement'}</Btn></div></form></section>;
}

function Assignment({ engagement, onDone }) {
  const [auditors, setAuditors] = useState([]), [files, setFiles] = useState([]), [error, setError] = useState(''), [loading, setLoading] = useState(true), [busy, setBusy] = useState(false);
  const [auditor, setAuditor] = useState(engagement.auditor_id ? String(engagement.auditor_id) : ''), [fields, setFields] = useState(['documents', 'transactions', 'checks', 'findings', 'events', 'report', 'sampling']), [allowedArtifactIds, setAllowedArtifactIds] = useState([]), [message, setMessage] = useState('');
  const allowed = ['organization', 'period', 'scope', 'required_records', 'documents', 'transactions', 'findings', 'events', 'report', 'checks', 'sampling', 'compliance'];
  useEffect(() => {
    let active = true;
    setLoading(true); setError('');
    Promise.all([
      api('/auditors'),
      api(`/uploads/${encodeURIComponent(engagement.id)}/uploads`),
      api(`/engagements/${encodeURIComponent(engagement.id)}/access`),
    ]).then(([auditorRows, fileRows, access]) => {
      if (!active) return;
      setAuditors(auditorRows); setFiles(fileRows); setAuditor(access.auditor_id ? String(access.auditor_id) : '');
      if (access.auditor_id) setFields(access.allowed_fields);
      setAllowedArtifactIds(access.allowed_artifact_ids || []);
    }).catch(e => { if (active) setError(e.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [engagement.id]);
  function toggleFile(id, checked) { setAllowedArtifactIds(ids => checked ? [...new Set([...ids, id])] : ids.filter(item => item !== id)); }
  async function assign() {
    setMessage(''); setError(''); setBusy(true);
    const body = { auditor_id: Number(auditor), allowed_fields: fields, allowed_artifact_ids: fields.includes('documents') ? allowedArtifactIds : [] };
    const existingAuditor = engagement.auditor_id && Number(auditor) === engagement.auditor_id;
    try {
      await api(`/engagements/${encodeURIComponent(engagement.id)}${existingAuditor ? '/access' : '/assign'}`, { method: existingAuditor ? 'PUT' : 'POST', body: jsonBody(existingAuditor ? { allowed_fields: body.allowed_fields, allowed_artifact_ids: body.allowed_artifact_ids } : body) });
      setMessage('Auditor and file access saved.'); onDone?.();
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }
  const documentsAllowed = fields.includes('documents');
  return <section className="panel pad"><div className="review-row"><h2>Auditor access</h2><button className="textlink" onClick={onDone}>Close</button></div><p>Choose the auditor’s workspace permissions and the specific uploaded files they can open.</p><ErrorBox error={error}/>{loading ? <p>Loading current access and uploaded files…</p> : <>
    <label>Auditor<select value={auditor} onChange={e => setAuditor(e.target.value)}><option value="">Select an auditor</option>{auditors.map(a => <option key={a.id} value={a.id}>{a.name} · {a.organization || a.email}</option>)}</select></label>
    <h3>Workspace permissions</h3><div className="checks">{allowed.map(field => <label key={field}><input type="checkbox" checked={fields.includes(field)} onChange={e => setFields(f => e.target.checked ? [...f, field] : f.filter(x => x !== field))}/>{field.replaceAll('_', ' ')}</label>)}</div>
    <div className="review-row"><h3>Files available to this auditor</h3><span>{documentsAllowed ? `${allowedArtifactIds.length} of ${files.length} selected` : 'Enable documents permission first'}</span></div>
    {!files.length ? <Empty>Upload files in Documents & records before selecting file access.</Empty> : <div className="assignment-files">{files.map(file => <label key={file.id}><input type="checkbox" disabled={!documentsAllowed} checked={documentsAllowed && allowedArtifactIds.includes(file.id)} onChange={e => toggleFile(file.id, e.target.checked)}/><span><strong>{file.filename}</strong><small>{new Date(file.created_at).toLocaleString()} · {(file.size / 1024).toFixed(1)} KB</small></span></label>)}</div>}
    <div className="actions"><Btn kind="soft" onClick={onDone}>Cancel</Btn><Btn disabled={!auditor || busy || loading || Boolean(error)} onClick={assign}>{busy ? 'Saving…' : engagement.auditor_id ? 'Save access' : 'Assign auditor'}</Btn></div>
  </>}{message && <p>{message}</p>}</section>;
}

function EngagementProgress({ engagementId }) {
  const path = engagementId ? `/engagements/${encodeURIComponent(engagementId)}/progress` : null;
  const { data, error, loading, reload } = useApiData(path, [engagementId]);
  return <section className="panel pad stage-panel">
    <div className="review-row stage-heading"><div><h2>Engagement progress</h2><p>Completed and remaining steps, based on saved engagement records.</p></div><Btn kind="soft" disabled={loading || !engagementId} onClick={reload}><RefreshCw size={14}/> Refresh</Btn></div>
    <ErrorBox error={error}/>
    {loading ? <p>Loading progress…</p> : data && <>
      <div className="stage-summary"><strong>{data.percent_complete}%</strong><span>{data.completed_steps} of {data.total_steps} steps complete</span></div>
      <div className="stage-progress" role="progressbar" aria-label="Engagement progress" aria-valuenow={data.percent_complete} aria-valuemin="0" aria-valuemax="100"><span style={{ width: `${data.percent_complete}%` }}/></div>
      <ol className="stage-list">{data.steps.map((step, index) => <li className={step.status === 'complete' ? 'complete' : 'pending'} key={step.key}>
        <span className="stage-marker" aria-label={step.status}>{step.status === 'complete' ? <Check size={14}/> : index + 1}</span>
        <div><strong>{step.title}</strong><small>{step.detail}</small></div>
        <Pill>{step.status === 'complete' ? 'Complete' : 'Remaining'}</Pill>
      </li>)}</ol>
      <p className="stage-note">This checklist reflects saved milestones. Formal engagement closure is not currently recorded by TRACE.</p>
    </>}
  </section>;
}

function Documents({ engagements, engagementId, setEngagementId }) {
  const [items, setItems] = useState([]), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const reload = useCallback(async () => { if (!engagementId) { setItems([]); return; } try { setError(''); setItems(await api(`/uploads/${encodeURIComponent(engagementId)}/uploads`)); } catch (e) { setError(e.message); setItems([]); } }, [engagementId]);
  useEffect(() => { reload(); }, [reload]);
  async function upload(files) { if (!engagementId || !files.length) return; setBusy(true); setError(''); try { for (const file of files) { const body = new FormData(); body.append('file', file); await api(`/uploads/${encodeURIComponent(engagementId)}/upload`, { method: 'POST', body }); } await reload(); } catch (e) { setError(e.message); } finally { setBusy(false); } }
  async function validate(id) { try { await api(`/uploads/${encodeURIComponent(engagementId)}/validate/${encodeURIComponent(id)}`, { method: 'POST' }); await reload(); } catch (e) { setError(e.message); } }
  async function download(item) { try { const response = await api(`/uploads/${encodeURIComponent(engagementId)}/uploads/${encodeURIComponent(item.id)}/download`); const blob = await response.blob(); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = item.filename; a.click(); URL.revokeObjectURL(url); } catch (e) { setError(e.message); } }
  return <div className="stack"><Header eyebrow="Evidence" title="Documents & records" desc="Files and dataset profiles stored by the TRACE API." action={<label className="btn btn-dark">{busy ? 'Uploading…' : 'Select files'}<input hidden type="file" multiple disabled={busy || !engagementId} accept=".csv,.tsv,.xlsx,.xlsm,.json,.pdf,.doc,.docx" onChange={e => { upload(Array.from(e.target.files || [])); e.target.value = ''; }}/></label>}/><div className="filters"><EngagementSelect engagements={engagements} value={engagementId} onChange={setEngagementId}/></div><ErrorBox error={error}/>{!engagementId ? <Empty>Select an engagement before uploading files.</Empty> : <><label className="dropzone"><Upload/><h3>Upload evidence</h3><p>CSV, TSV, XLSX, XLSM, JSON, PDF, DOC, or DOCX</p><small>Maximum file size is configured by the backend.</small><input hidden type="file" multiple disabled={busy} accept=".csv,.tsv,.xlsx,.xlsm,.json,.pdf,.doc,.docx" onChange={e => { upload(Array.from(e.target.files || [])); e.target.value = ''; }}/></label><section className="panel"><div className="panel-head"><h2>Evidence register</h2><Pill>{items.length} records</Pill><Btn kind="soft" onClick={reload}>Refresh</Btn></div>{items.length ? <Table headers={['File', 'Size', 'SHA-256', 'Status', 'Actions']} rows={items.map(item => [<><strong>{item.filename}</strong><small>{new Date(item.created_at).toLocaleString()}</small></>, `${(item.size / 1024).toFixed(1)} KB`, <code>{item.sha256}</code>, item.validation?.status || 'uploaded', <><button className="textlink" onClick={() => validate(item.id)}>Validate</button> · <button className="textlink" onClick={() => download(item)}>Download</button></>])}/> : <Empty>No files have been uploaded to this engagement.</Empty>}</section></>}</div>;
}

function Procedures({ engagements, engagementId, setEngagementId }) {
  const { data: catalog, error: catalogError, loading } = useApiData('/audit/checks/catalog');
  const [runs, setRuns] = useState([]), [error, setError] = useState(''), [busy, setBusy] = useState('');
  const reload = useCallback(async () => { if (!engagementId) { setRuns([]); return; } try { setError(''); setRuns(await api(`/audit/${encodeURIComponent(engagementId)}/checks`)); } catch (e) { setError(e.message); setRuns([]); } }, [engagementId]);
  useEffect(() => { reload(); }, [reload]);
  async function run(check) { setBusy(check.id); setError(''); try { await api(`/audit/${encodeURIComponent(engagementId)}/checks`, { method: 'POST', body: jsonBody({ procedure: check.id, version: '1.0' }) }); await reload(); } catch (e) { setError(e.message); } finally { setBusy(''); } }
  return <div className="stack"><Header eyebrow="Audit execution" title="Audit procedures" desc="Procedure definitions and execution results from the API."/><div className="filters"><EngagementSelect engagements={engagements} value={engagementId} onChange={setEngagementId}/></div><ErrorBox error={catalogError || error}/>{loading ? <p>Loading procedure catalog…</p> : !engagementId ? <Empty>Select an engagement to view and run procedures.</Empty> : <><section className="procedure-list">{(catalog || []).map((check, i) => <article className="procedure" key={check.id}><div className="proc-num">{String(i + 1).padStart(2, '0')}</div><div><small>{check.id} · VERSIONED RULE</small><h3>{check.name}</h3><p>{check.objective}</p><span>Executions recorded in the engagement database.</span></div><Btn disabled={Boolean(busy)} onClick={() => run(check)}>{busy === check.id ? 'Running…' : 'Run procedure'} <ArrowRight size={14}/></Btn></article>)}</section><section className="panel"><div className="panel-head"><h2>Persisted executions</h2><Btn kind="soft" onClick={reload}>Refresh</Btn></div>{runs.length ? runs.map(run => <article className="panel pad" key={run.id}><div className="review-row"><span>{run.procedure} · {run.version}</span><strong>{new Date(run.created_at).toLocaleString()}</strong></div><pre>{JSON.stringify(run.results, null, 2)}</pre><p>{run.note}</p></article>) : <Empty>No procedure runs for this engagement.</Empty>}</section></>}</div>;
}

function Sampling({ engagements, engagementId, setEngagementId }) {
  const [method, setMethod] = useState('random'), [size, setSize] = useState(30), [runs, setRuns] = useState([]), [error, setError] = useState('');
  const reload = useCallback(async () => { if (!engagementId) { setRuns([]); return; } try { setRuns(await api(`/audit/${encodeURIComponent(engagementId)}/sampling`)); } catch (e) { setError(e.message); setRuns([]); } }, [engagementId]);
  useEffect(() => { reload(); }, [reload]);
  async function run() { try { setError(''); await api(`/audit/${encodeURIComponent(engagementId)}/sampling?method=${encodeURIComponent(method)}&size=${size}`, { method: 'POST' }); await reload(); } catch (e) { setError(e.message); } }
  return <div className="stack"><Header eyebrow="Risk assessment" title="Risk & sampling" desc="Sampling runs and selected records persisted for the engagement."/><div className="filters"><EngagementSelect engagements={engagements} value={engagementId} onChange={setEngagementId}/></div><ErrorBox error={error}/>{engagementId && <section className="panel pad"><div className="formgrid"><label>Method<select value={method} onChange={e => setMethod(e.target.value)}><option value="random">Seeded random</option><option value="risk-based">Risk-based</option><option value="targeted">Targeted</option></select></label><label>Requested items<input type="number" min="1" max="10000" value={size} onChange={e => setSize(Number(e.target.value))}/></label></div><Btn onClick={run}>Create sampling run</Btn></section>}{runs.length ? runs.map(run => <section className="panel pad" key={run.id}><div className="review-row"><span>{run.method} · {run.sample_size}/{run.population_size}</span><strong>{new Date(run.created_at).toLocaleString()}</strong></div><p>Dataset SHA-256: {run.dataset_sha256}</p><pre>{JSON.stringify(run.selected_records, null, 2)}</pre><p>{run.note}</p></section>) : <Empty>{engagementId ? 'No sampling runs for this engagement.' : 'Select an engagement to view sampling records.'}</Empty>}</div>;
}

function Traceability({ engagements, engagementId, setEngagementId }) {
  const [events, setEvents] = useState([]), [integrity, setIntegrity] = useState(null), [error, setError] = useState('');
  const reload = useCallback(async () => { if (!engagementId) { setEvents([]); setIntegrity(null); return; } try { setError(''); const [rows, check] = await Promise.all([api(`/audit/${encodeURIComponent(engagementId)}/audit-events`), api(`/audit/${encodeURIComponent(engagementId)}/audit-integrity`)]); setEvents(rows); setIntegrity(check); } catch (e) { setError(e.message); setEvents([]); setIntegrity(null); } }, [engagementId]);
  useEffect(() => { reload(); }, [reload]);
  return <div className="stack"><Header eyebrow="Audit history" title="Procedure traceability" desc="Engagement events and integrity verification returned by the API."/><div className="filters"><EngagementSelect engagements={engagements} value={engagementId} onChange={setEngagementId}/><Btn kind="soft" onClick={reload}>Refresh</Btn></div><ErrorBox error={error}/>{integrity && <div className="notice"><Fingerprint/><div><strong>{integrity.valid ? 'Event chain verified' : 'Event chain verification failed'}</strong><p>{integrity.events_checked} events checked · {integrity.head_hash}</p></div></div>}{events.length ? <div className="event-list">{events.map(event => <article className="panel pad" key={event.id}><small>{event.type} · {new Date(event.created_at).toLocaleString()}</small><h3>{event.type.replaceAll('.', ' ')}</h3><p>Event {event.id} · actor {event.actor_id}</p><code>{event.previous_hash} → {event.event_hash}</code>{Object.keys(event.details || {}).length > 0 && <pre>{JSON.stringify(event.details, null, 2)}</pre>}</article>)}</div> : <Empty>{engagementId ? 'No events are stored for this engagement.' : 'Select an engagement to see its events.'}</Empty>}</div>;
}

function Reports({ engagements, engagementId, setEngagementId }) {
  const [report, setReport] = useState(null), [versions, setVersions] = useState([]), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const reloadVersions = useCallback(async () => { if (!engagementId) { setVersions([]); return; } try { setVersions(await api(`/audit/${encodeURIComponent(engagementId)}/report/versions`)); } catch (e) { setError(e.message); } }, [engagementId]);
  useEffect(() => { setReport(null); reloadVersions(); }, [reloadVersions]);
  async function generate() { setBusy(true); setError(''); try { setReport(await api(`/audit/${encodeURIComponent(engagementId)}/report`)); await reloadVersions(); } catch (e) { setError(e.message); } finally { setBusy(false); } }
  async function scan() { setBusy(true); setError(''); try { const result = await api(`/audit/${encodeURIComponent(engagementId)}/scan`, { method: 'POST' }); setReport(result); await reloadVersions(); } catch (e) { setError(e.message); } finally { setBusy(false); } }
  async function downloadCompleteReport() {
    setBusy(true); setError('');
    try {
      // The API enforces the caller's transaction-export grant before returning the CSV.
      const csvResponse = await api(`/audit/${encodeURIComponent(engagementId)}/exports/csv`);
      const csv = await csvResponse.text();
      const zip = new JSZip();
      const charts = reportChartsFromPage();
      charts.forEach((chart, index) => zip.file(`charts/chart-${String(index + 1).padStart(2, '0')}.svg`, chart.svg));
      const reportHtml = createDownloadableReport(report, charts);
      const safeId = String(engagementId).replace(/[^a-zA-Z0-9_-]/g, '_');
      zip.file(`${safeId}-report.html`, reportHtml);
      zip.file(`${safeId}-workpaper.csv`, csv);
      zip.file(`${safeId}-report.json`, JSON.stringify(report, null, 2));
      const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
      const url = URL.createObjectURL(blob), anchor = document.createElement('a');
      anchor.href = url; anchor.download = `${safeId}-complete-report.zip`; anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }
  async function printCompleteReport() {
    // Open synchronously from the click so the browser does not block the print window after the API call.
    const printWindow = window.open('', '_blank');
    if (!printWindow) { setError('Allow pop-ups for this site to print or save the report as a PDF.'); return; }
    setBusy(true); setError('');
    try {
      const csvResponse = await api(`/audit/${encodeURIComponent(engagementId)}/exports/csv`);
      const csv = await csvResponse.text();
      const html = createDownloadableReport(report, reportChartsFromPage(), csv);
      printWindow.document.open(); printWindow.document.write(html); printWindow.document.close();
      window.setTimeout(() => { printWindow.focus(); printWindow.print(); }, 300);
    } catch (e) { printWindow.close(); setError(e.message); }
    finally { setBusy(false); }
  }
  const analysis = report?.revenue_analysis;
  return <div className="stack"><Header eyebrow="Reports" title="Reports & continuous scanning" desc="Generate a pandas report from the selected engagement’s uploaded datasets."/><div className="filters"><EngagementSelect engagements={engagements} value={engagementId} onChange={setEngagementId}/></div><ErrorBox error={error}/>{engagementId && <div className="actions"><Btn disabled={busy} onClick={generate}>{busy ? 'Analyzing uploaded data…' : 'Generate report'}</Btn><Btn kind="soft" disabled={busy} onClick={scan}>Scan latest dataset versions</Btn>{report && <><Btn kind="soft" disabled={busy} onClick={downloadCompleteReport}><Download size={15}/> {busy ? 'Preparing download…' : 'Download complete report (.zip)'}</Btn><Btn kind="soft" disabled={busy} onClick={printCompleteReport}>{busy ? 'Preparing…' : 'Print full report / Save PDF'}</Btn></>}</div>}{analysis && <>
    <section className="stats report-stats">{[['Invoices', analysis.summary.invoice_count], ['Flagged', analysis.summary.flagged_invoice_count], ['Gross amount', analysis.summary.currency_count > 1 ? 'Multiple currencies' : formatAmount(analysis.summary.gross_total)], ['Check findings', analysis.discrepancy_count], ['Data files', analysis.datasets.length]].map(([label, value]) => <article className="stat" key={label}><small>{label}</small><strong>{value}</strong><em>From uploaded records</em></article>)}</section>
    {analysis.summary.currency_count > 1 && <section className="panel pad"><h2>Totals by currency</h2><Table headers={['Currency', 'Gross invoice amount', 'Taxable value', 'Tax and TCS']} rows={Object.keys(analysis.summary.gross_totals_by_currency).map(currency => [currency, formatAmount(analysis.summary.gross_totals_by_currency[currency]), formatAmount(analysis.summary.taxable_totals_by_currency[currency]), formatAmount(analysis.summary.tax_totals_by_currency[currency])])}/></section>}
    <section className="panel"><div className="panel-head"><h2>Source Audit_Flag values</h2><Pill>{analysis.source_audit_flags.flagged_count} flagged</Pill></div><p className="flag-note">Flag status is taken only from the uploaded Audit_Flag column. No other fields or checks change this status.</p>{analysis.source_audit_flags.flagged_records.length ? <Table headers={['Invoice ID', 'Bill no.', 'Audit_Flag', 'Issue type', 'Issue detail']} rows={analysis.source_audit_flags.flagged_records.map(x => [x.invoice_id, x.bill_no, x.audit_flag, x.audit_issue_type, x.audit_issue_detail])}/> : <Empty>No invoice rows have Audit_Flag marked as Flag.</Empty>}<p className="flag-note">Not flag: {analysis.source_audit_flags.not_flagged_count} · Unclassified/blank: {analysis.source_audit_flags.unclassified_count}</p></section>
    <div className="report-chart-grid">{analysis.charts.map(chart => <RevenueChart key={chart.id} chart={chart}/>)}</div>
    <section className="panel"><div className="panel-head"><h2>Discrepancy review</h2><Pill>{analysis.discrepancy_types} types</Pill></div>{analysis.discrepancies.some(x => x.count > 0) ? analysis.discrepancies.filter(x => x.count > 0).map(issue => <details className="analysis-issue" key={issue.code}><summary><span><strong>{issue.label}</strong><small>{issue.code}</small></span><b>{issue.count} rows</b></summary>{issue.amount != null && <p>Absolute variance total: {formatAmount(issue.amount)}</p>}{issue.examples?.length > 0 && <Table headers={['Invoice ID', 'Bill no.', 'Date', 'Business unit', 'Gross amount']} rows={issue.examples.map(x => [x.invoice_id, x.bill_no, x.invoice_date, x.business_unit, x.gross_invoice_amount])}/>}</details>) : <Empty>No discrepancy rows were found by the configured deterministic checks.</Empty>}</section>
    <section className="panel"><div className="panel-head"><h2>Analyzed uploads</h2><Pill>{analysis.datasets.length} files</Pill></div>{analysis.datasets.length ? <Table headers={['File', 'Recognized dataset', 'Rows', 'Columns']} rows={analysis.datasets.map(x => [x.filename, x.recognized_as, x.rows, x.columns])}/> : <Empty>No supported tabular uploads are stored for this engagement.</Empty>}</section>
    <section className="panel pad"><h2>Analysis notes</h2><p>Method: {analysis.method} · version {analysis.analysis_version}. All findings require human review.</p><ul className="analysis-notes">{analysis.limitations.map(note => <li key={note}>{note}</li>)}</ul></section>
    </>}{report && <details className="panel pad"><summary>Full generated report data</summary><pre>{JSON.stringify(report, null, 2)}</pre></details>}<section className="panel"><div className="panel-head"><h2>Stored report versions</h2><Pill>{versions.length} versions</Pill></div>{versions.length ? <Table headers={['Version', 'Snapshot', 'SHA-256', 'Created']} rows={versions.map(v => [v.version, v.snapshot_id ?? '—', <code>{v.report_hash}</code>, new Date(v.created_at).toLocaleString()])}/> : <Empty>No report versions are stored for this engagement.</Empty>}</section></div>;
}

function escapeReportHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
}

function reportColumnNames(dataset) {
  const columns = dataset?.column_names ?? dataset?.columns;
  if (Array.isArray(columns)) return columns.map(column => String(column)).join(', ');
  if (typeof columns === 'string') return columns;
  if (Number.isFinite(columns)) return `${columns} columns`;
  return '—';
}

function reportChartsFromPage() {
  return Array.from(document.querySelectorAll('.report-chart-grid .revenue-chart')).map((section, index) => {
    const svg = section.querySelector('svg')?.cloneNode(true);
    if (!svg) return null;
    svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    const title = section.querySelector('h2')?.textContent || `Chart ${index + 1}`;
    return { title, svg: svg.outerHTML };
  }).filter(Boolean);
}

function parseCsvRows(csvText) {
  const text = String(csvText || '').replace(/^\uFEFF/, '');
  const rows = [];
  let row = [], cell = '', quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quoted) {
      if (character === '"' && text[index + 1] === '"') { cell += '"'; index += 1; }
      else if (character === '"') quoted = false;
      else cell += character;
    } else if (character === '"' && cell.length === 0) quoted = true;
    else if (character === ',') { row.push(cell); cell = ''; }
    else if (character === '\n' || character === '\r') {
      row.push(cell); cell = '';
      if (row.some(value => value.length > 0)) rows.push(row);
      row = [];
      if (character === '\r' && text[index + 1] === '\n') index += 1;
    } else cell += character;
  }
  if (cell.length || row.length) {
    row.push(cell);
    if (row.some(value => value.length > 0)) rows.push(row);
  }
  return rows;
}

function createDownloadableReport(report, charts, csvText = null) {
  const analysis = report?.revenue_analysis;
  const summary = analysis?.summary;
  const summaryRows = summary ? [
    ['Invoices', summary.invoice_count],
    ['Flagged invoices', summary.flagged_invoice_count],
    ['Discrepancy rows', analysis.discrepancy_count],
    ['Analyzed files', analysis.datasets?.length ?? 0],
    ['Currency count', summary.currency_count],
  ].map(([label, value]) => `<tr><th>${escapeReportHtml(label)}</th><td>${escapeReportHtml(value)}</td></tr>`).join('') : '<tr><td colspan="2">This report contains a scan result rather than revenue analysis.</td></tr>';
  const chartMarkup = charts.length ? charts.map(chart => `<section><h2>${escapeReportHtml(chart.title)}</h2>${chart.svg}</section>`).join('') : '<p>No chart SVGs were available for this report.</p>';
  const discrepancyMarkup = (analysis?.discrepancies || []).filter(issue => Number(issue.count) > 0).map(issue => `<tr><td>${escapeReportHtml(issue.label)}</td><td>${escapeReportHtml(issue.code)}</td><td>${escapeReportHtml(issue.count)}</td><td>${escapeReportHtml(issue.amount ?? '—')}</td></tr>`).join('') || '<tr><td colspan="4">No discrepancy rows were found.</td></tr>';
  const datasetMarkup = (analysis?.datasets || []).map(dataset => `<tr><td>${escapeReportHtml(dataset.filename)}</td><td>${escapeReportHtml(dataset.recognized_as)}</td><td>${escapeReportHtml(dataset.rows)}</td><td>${escapeReportHtml(reportColumnNames(dataset))}</td></tr>`).join('') || '<tr><td colspan="4">No supported tabular uploads were analyzed.</td></tr>';
  const findingMarkup = (report?.findings || []).map(finding => `<tr><td>${escapeReportHtml(finding.title)}</td><td>${escapeReportHtml(finding.severity)}</td><td>${escapeReportHtml(finding.status)}</td><td>${escapeReportHtml(finding.description)}</td></tr>`).join('') || '<tr><td colspan="4">No findings are included.</td></tr>';
  const procedureMarkup = (report?.procedure_runs || []).map(run => `<li>Run ${escapeReportHtml(run.id)} · ${escapeReportHtml(run.created_at || '')} · ${escapeReportHtml(run.procedure || run.check_name || 'Procedure')}</li>`).join('') || '<li>No procedure runs are included.</li>';
  const csvRows = csvText === null ? [] : parseCsvRows(csvText);
  const columnCount = csvRows.reduce((count, row) => Math.max(count, row.length), 0);
  const csvHeaders = Array.from({ length: columnCount }, (_, index) => csvRows[0]?.[index] || `Column ${index + 1}`);
  const csvHeaderMarkup = csvHeaders.map(header => `<th>${escapeReportHtml(header)}</th>`).join('');
  const csvBodyMarkup = csvRows.slice(1).map(row => `<tr>${csvHeaders.map((_, index) => `<td>${escapeReportHtml(row[index] ?? '')}</td>`).join('')}</tr>`).join('');
  const csvMarkup = csvText === null ? '' : `<section class="workpaper-data"><h2>Complete workpaper data</h2><p>${Math.max(0, csvRows.length - 1)} data row(s) from the permission-checked CSV export. Long tables continue across pages.</p>${columnCount ? `<table><thead><tr>${csvHeaderMarkup}</tr></thead><tbody>${csvBodyMarkup}</tbody></table>` : '<p>The CSV export contains no tabular data.</p>'}</section>`;
  const rawData = escapeReportHtml(JSON.stringify(report, null, 2));
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>TRACE Complete Report</title><style>@page{size:A4 landscape;margin:12mm}*{box-sizing:border-box}html,body{background:#fff!important}body{font:12px/1.5 Arial,sans-serif;color:#24352b;max-width:1200px;margin:30px auto;padding:0 22px}h1,h2{color:#173e31}header{border-bottom:2px solid #dce5dc;padding-bottom:18px;margin-bottom:24px}.meta{color:#627168}table{border-collapse:collapse;width:100%;margin:12px 0 26px;table-layout:auto}th,td{text-align:left;border:1px solid #dce5dc;padding:6px;vertical-align:top;overflow-wrap:anywhere}th{background:#f2f5f0!important;print-color-adjust:exact;-webkit-print-color-adjust:exact}thead{display:table-header-group}tr{break-inside:avoid;page-break-inside:avoid}.charts{display:grid;grid-template-columns:1fr 1fr;gap:14px}.charts section{background:#fff;border:1px solid #dce5dc;border-radius:8px;padding:14px;break-inside:avoid;page-break-inside:avoid}.charts h2{font-size:17px}.charts svg{display:block;background:#fff;max-width:100%;height:auto}.workpaper-data{break-before:page;page-break-before:always}.workpaper-data table{font-size:7px;line-height:1.25}.workpaper-data th,.workpaper-data td{padding:3px}.workpaper-data td{white-space:pre-wrap}.notice{background:#f4f5ed;padding:12px;border-left:4px solid #527b58;print-color-adjust:exact;-webkit-print-color-adjust:exact}.summary-table{max-width:600px}pre{white-space:pre-wrap;overflow-wrap:anywhere;background:#f5f6f3;padding:14px;font-size:10px}@media screen{body{max-width:1200px;margin:30px auto}}@media print{body{max-width:none;margin:0;padding:0}.charts{grid-template-columns:1fr 1fr}a{color:inherit}}</style></head><body><header><h1>TRACE Audit Report</h1><div class="meta">Engagement: ${escapeReportHtml(report?.engagement?.name || report?.engagement_id || 'Selected engagement')} · Version: ${escapeReportHtml(report?.report_version ?? '—')} · Generated: ${escapeReportHtml(report?.generated_at || new Date().toISOString())}</div></header><p class="notice">This report summarizes uploaded data and deterministic checks. It requires human review and is not an audit opinion or assurance conclusion.</p><h2>Summary</h2><table class="summary-table"><tbody>${summaryRows}</tbody></table><h2>Visualizations</h2><div class="charts">${chartMarkup}</div><h2>Discrepancy review</h2><table><thead><tr><th>Issue</th><th>Code</th><th>Rows</th><th>Absolute variance</th></tr></thead><tbody>${discrepancyMarkup}</tbody></table><h2>Analyzed uploads</h2><table><thead><tr><th>File</th><th>Dataset type</th><th>Rows</th><th>Columns</th></tr></thead><tbody>${datasetMarkup}</tbody></table><h2>Findings</h2><table><thead><tr><th>Finding</th><th>Severity</th><th>Status</th><th>Description</th></tr></thead><tbody>${findingMarkup}</tbody></table><h2>Procedure runs</h2><ul>${procedureMarkup}</ul>${csvMarkup}<h2>Full report data</h2><details><summary>View JSON source</summary><pre>${rawData}</pre></details></body></html>`;
}

function formatAmount(value) { return value == null ? '—' : new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(Number(value)); }

function RevenueChart({ chart }) {
  const ref = useRef(null);
  useEffect(() => {
    const svg = d3.select(ref.current); svg.selectAll('*').remove();
    const data = (chart.data || []).filter(x => Number.isFinite(Number(x.value)) && Number(x.value) >= 0);
    const width = 640, height = 270;
    svg.attr('viewBox', `0 0 ${width} ${height}`).attr('role', 'img').attr('aria-label', chart.title);
    if (!data.length) { svg.append('text').attr('x', width / 2).attr('y', height / 2).attr('text-anchor', 'middle').attr('fill', '#819084').text('No chart data in uploaded records'); return; }
    if (chart.type === 'pie') {
      const radius = 92, centerX = 165, centerY = 128;
      const color = d3.scaleOrdinal(d3.schemeTableau10).domain(data.map(d => d.label));
      const pie = d3.pie().sort(null).value(d => Number(d.value));
      const arc = d3.arc().innerRadius(0).outerRadius(radius);
      svg.append('g').attr('transform', `translate(${centerX},${centerY})`).selectAll('path').data(pie(data)).join('path').attr('d', arc).attr('fill', d => color(d.data.label)).attr('stroke', '#fffefa').attr('stroke-width', 2).append('title').text(d => `${d.data.label}: ${d.data.value}`);
      const legend = svg.append('g').attr('transform', 'translate(300,38)');
      legend.selectAll('g').data(data.slice(0, 9)).join('g').attr('transform', (_, i) => `translate(0,${i * 23})`).each(function(d) { const row = d3.select(this); row.append('circle').attr('r', 5).attr('cy', 5).attr('fill', color(d.label)); row.append('text').attr('x', 13).attr('y', 9).attr('fill', '#445348').attr('font-size', 11).text(`${d.label} (${d.value})`); });
    } else {
      const margin = { top: 18, right: 18, bottom: 64, left: 65 };
      const x = d3.scaleBand().domain(data.map(d => d.label)).range([margin.left, width - margin.right]).padding(0.22);
      const y = d3.scaleLinear().domain([0, d3.max(data, d => Number(d.value)) || 1]).nice().range([height - margin.bottom, margin.top]);
      svg.append('g').attr('transform', `translate(0,${height - margin.bottom})`).call(d3.axisBottom(x).tickSizeOuter(0)).selectAll('text').attr('transform', 'rotate(-28)').style('text-anchor', 'end').attr('dx', '-.5em').attr('dy', '.3em');
      svg.append('g').attr('transform', `translate(${margin.left},0)`).call(d3.axisLeft(y).ticks(5).tickFormat(d3.format('~s'))).call(g => g.select('.domain').remove());
      svg.append('g').selectAll('rect').data(data).join('rect').attr('x', d => x(d.label)).attr('y', d => y(Number(d.value))).attr('width', x.bandwidth()).attr('height', d => y(0) - y(Number(d.value))).attr('rx', 3).attr('fill', '#527b58').append('title').text(d => `${d.label}: ${formatAmount(d.value)}`);
    }
  }, [chart]);
  return <section className="panel revenue-chart"><h2>{chart.title}</h2><small>{chart.unit === 'currency' ? 'Amount in source currency units' : 'Count of uploaded invoice records'}</small><svg ref={ref}/></section>;
}

function Findings({ engagements, engagementId, setEngagementId }) {
  const [findings, setFindings] = useState([]), [runs, setRuns] = useState([]), [error, setError] = useState('');
  const reload = useCallback(async () => { if (!engagementId) { setFindings([]); setRuns([]); return; } try { setError(''); const [f, r] = await Promise.all([api(`/audit/${encodeURIComponent(engagementId)}/findings`), api(`/audit/${encodeURIComponent(engagementId)}/checks`)]); setFindings(f); setRuns(r); } catch (e) { setError(e.message); } }, [engagementId]);
  useEffect(() => { reload(); }, [reload]);
  const exceptions = runs.flatMap(run => (run.results || []).filter(x => x.exception_count > 0).map(x => ({ ...x, run_id: run.id, created_at: run.created_at })));
  return <div className="stack"><Header eyebrow="Audit review" title="Findings & exceptions" desc="Findings and exception signals persisted by the audit API."/><div className="filters"><EngagementSelect engagements={engagements} value={engagementId} onChange={setEngagementId}/></div><ErrorBox error={error}/><section className="panel"><div className="panel-head"><h2>Recorded findings</h2><Pill>{findings.length} findings</Pill></div>{findings.length ? <Table headers={['Title', 'Severity', 'Status', 'Created']} rows={findings.map(f => [f.title, f.severity, f.status, new Date(f.created_at).toLocaleString()])}/> : <Empty>No findings are recorded for this engagement.</Empty>}</section><section className="panel"><div className="panel-head"><h2>Procedure exceptions</h2><Pill>{exceptions.length} signals</Pill></div>{exceptions.length ? exceptions.map((x, i) => <article className="panel pad" key={`${x.run_id}-${x.check_id}-${i}`}><small>{x.check_id} · {x.status} · {new Date(x.created_at).toLocaleString()}</small><h3>{x.check_name}</h3><p>{x.result_summary || x.reason}</p><p>{x.exception_count} records · source {x.source_artifact_id}</p><pre>{JSON.stringify(x.source_record_references, null, 2)}</pre></article>) : <Empty>No procedure exceptions have been returned by persisted runs.</Empty>}</section></div>;
}

function Archive({ engagements, engagementId, setEngagementId }) {
  const [files, setFiles] = useState([]), [error, setError] = useState('');
  const reload = useCallback(async () => { if (!engagementId) { setFiles([]); return; } try { setFiles(await api(`/uploads/${encodeURIComponent(engagementId)}/uploads`)); setError(''); } catch (e) { setError(e.message); setFiles([]); } }, [engagementId]);
  useEffect(() => { reload(); }, [reload]);
  return <div className="stack"><Header eyebrow="Evidence archive" title="Uploaded files" desc="The archive is populated from artifacts stored for the selected engagement."/><div className="filters"><EngagementSelect engagements={engagements} value={engagementId} onChange={setEngagementId}/></div><ErrorBox error={error}/>{files.length ? <Table headers={['File', 'Size', 'SHA-256', 'Uploaded']} rows={files.map(file => [file.filename, `${(file.size / 1024).toFixed(1)} KB`, <code>{file.sha256}</code>, new Date(file.created_at).toLocaleString()])}/> : <Empty>{engagementId ? 'No files are stored for this engagement.' : 'Select an engagement to see its uploaded files.'}</Empty>}</div>;
}

function AdminUsers() {
  const [users, setUsers] = useState([]), [form, setForm] = useState({ name: '', email: '', password: '', role: 'client', organization: '', date_of_birth: '' }), [error, setError] = useState('');
  const adultCutoff = new Date(); adultCutoff.setFullYear(adultCutoff.getFullYear() - 18);
  const maxDateOfBirth = `${adultCutoff.getFullYear()}-${String(adultCutoff.getMonth() + 1).padStart(2, '0')}-${String(adultCutoff.getDate()).padStart(2, '0')}`;
  const reload = useCallback(async () => { try { setUsers(await api('/admin/users')); setError(''); } catch (e) { setError(e.message); } }, []); useEffect(() => { reload(); }, [reload]);
  async function create(e) { e.preventDefault(); setError(''); try { await api('/admin/users', { method: 'POST', body: jsonBody(form) }); setForm({ name: '', email: '', password: '', role: 'client', organization: '', date_of_birth: '' }); await reload(); } catch (err) { setError(err.message); } }
  async function active(user) { try { await api(`/admin/users/${user.id}/active`, { method: 'PATCH', body: jsonBody({ active: !user.active }) }); await reload(); } catch (e) { setError(e.message); } }
  return <div className="stack"><Header eyebrow="Platform administration" title="Users" desc="Create accounts or restore access with a new temporary password."/><ErrorBox error={error}/><section className="panel pad"><h2>Provision / reset account</h2><form className="formgrid" onSubmit={create}><label>Name<input required minLength="2" maxLength="200" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}/></label><label>Email<input required maxLength="320" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })}/></label><label>Temporary password<input required minLength="10" maxLength="128" type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })}/><small>Use 10–128 characters.</small></label><label>Role<select value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}><option value="client">Client</option><option value="auditor">Auditor</option></select></label><label>Organization<input required maxLength="200" value={form.organization} onChange={e => setForm({ ...form, organization: e.target.value })}/></label><label>Date of birth (18+)<input required max={maxDateOfBirth} type="date" value={form.date_of_birth} onChange={e => setForm({ ...form, date_of_birth: e.target.value })}/></label><Btn>Create / reset account</Btn></form></section><section className="panel"><div className="panel-head"><h2>Accounts</h2><Btn kind="soft" onClick={reload}>Refresh</Btn></div>{users.length ? <Table headers={['Name', 'Email', 'Role', 'Organization', 'Status', 'Action']} rows={users.map(u => [u.name, u.email, roles[u.role] || u.role, u.organization || '—', u.active ? 'Active' : 'Disabled', <button className="textlink" onClick={() => active(u)}>{u.active ? 'Disable' : 'Enable'}</button>])}/> : <Empty>No user records are stored.</Empty>}</section></div>;
}

function AdminDirectory({ kind }) {
  const [items, setItems] = useState([]), [error, setError] = useState(''), [name, setName] = useState('');
  const path = kind === 'companies' ? '/admin/companies' : kind === 'requests' ? '/engagements/' : '/admin/users?role=auditor';
  const reload = useCallback(async () => { try { setItems(await api(path)); setError(''); } catch (e) { setError(e.message); } }, [path]); useEffect(() => { reload(); }, [reload]);
  async function createCompany(e) { e.preventDefault(); try { await api('/admin/companies', { method: 'POST', body: jsonBody({ legal_name: name }) }); setName(''); await reload(); } catch (err) { setError(err.message); } }
  const isCompanies = kind === 'companies', isRequests = kind === 'requests';
  return <div className="stack"><Header eyebrow="Platform administration" title={isCompanies ? 'Companies' : isRequests ? 'Engagement requests' : 'Auditors'} desc="Records returned by the TRACE API."/><ErrorBox error={error}/>{isCompanies && <section className="panel pad"><form className="formgrid" onSubmit={createCompany}><label>Legal name<input required value={name} onChange={e => setName(e.target.value)}/></label><Btn>Create company</Btn></form></section>}{items.length ? <Table headers={isCompanies ? ['Company', 'ID', 'Status'] : isRequests ? ['Engagement', 'Organization', 'Period', 'Scope', 'Status'] : ['Name', 'Email', 'Organization', 'Status']} rows={items.map(x => isCompanies ? [x.legal_name, x.id, x.active ? 'Active' : 'Disabled'] : isRequests ? [<><strong>{x.name}</strong><small>{x.id}</small></>, x.organization, x.period, x.scope, x.status] : [x.name, x.email, x.organization || '—', x.active ? 'Active' : 'Disabled'])}/> : <Empty>No records are stored.</Empty>}</div>;
}

function AdminLogs() { const { data, error, loading, reload } = useApiData('/admin/audit-logs'); return <div className="stack"><Header eyebrow="Platform administration" title="Administrative audit log" desc="Recorded platform actions from the database." action={<Btn kind="soft" onClick={reload}>Refresh</Btn>}/><ErrorBox error={error}/>{loading ? <p>Loading…</p> : data?.length ? <Table headers={['Time', 'Action', 'Target', 'ID', 'Actor']} rows={data.map(x => [new Date(x.created_at).toLocaleString(), x.action, x.target_type, x.target_id, x.actor_id])}/> : <Empty>No administrative actions are recorded.</Empty>}</div>; }

function Dashboard({ role, engagements, onCreate }) {
  const [counts, setCounts] = useState({}); const [error, setError] = useState('');
  useEffect(() => { if (role !== 'admin') return; Promise.all([api('/admin/users'), api('/admin/companies')]).then(([users, companies]) => setCounts({ users: users.length, companies: companies.length })).catch(e => setError(e.message)); }, [role]);
  const stats = role === 'admin' ? [['Users', counts.users ?? '—'], ['Companies', counts.companies ?? '—'], ['Engagements', engagements.length]] : [['Engagements', engagements.length]];
  return <div className="stack"><Header eyebrow={`${roles[role]} workspace`} title="Overview" desc="Current records and activity available to your account." action={role === 'client' && <Btn onClick={onCreate}><Plus size={15}/> New engagement</Btn>}/><ErrorBox error={error}/><div className="stats">{stats.map(([label, value]) => <article className="stat" key={label}><small>{label}</small><strong>{value}</strong><em>From the API</em></article>)}</div><section className="panel"><div className="panel-head"><h2>{role === 'auditor' ? 'Assigned engagements' : role === 'admin' ? 'Engagement records' : 'Your engagements'}</h2></div>{engagements.length ? <EngagementTable engagements={engagements}/> : <Empty>No engagements are stored or assigned to this account.</Empty>}</section></div>;
}

function Workspace() {
  const location = useLocation(), go = useNavigate(); const [session, setSession] = useState(null), [authError, setAuthError] = useState(''), [engagements, setEngagements] = useState([]), [engagementError, setEngagementError] = useState(''), [engagementId, setEngagementId] = useState(''), [assignmentEngagement, setAssignmentEngagement] = useState(null), [collapsed, setCollapsed] = useState(false), [mobile, setMobile] = useState(false), [searchOpen, setSearchOpen] = useState(false), [search, setSearch] = useState('');
  const token = sessionStorage.getItem('trace-access-token');
  useEffect(() => { let alive = true; if (!token) { setAuthError('Sign in to continue.'); return; } api('/auth/me').then(user => { if (alive) { setSession(user); if (location.pathname.split('/')[2] !== user.role) go(`/app/${user.role}`, { replace: true }); } }).catch(e => { if (alive) { clearSession(); setAuthError(e.message); } }); return () => { alive = false; }; }, [token, location.pathname, go]);
  const role = session?.role; const base = role ? `/app/${role}` : '/app'; const slug = location.pathname.replace(base, '').replace(/^\//, '');
  useEffect(() => { let alive = true; if (!role) return; api('/engagements/').then(rows => { if (alive) { setEngagements(rows); setEngagementError(''); setEngagementId(current => rows.some(x => x.id === current) ? current : rows[0]?.id || ''); } }).catch(e => { if (alive) { setEngagementError(e.message); setEngagements([]); } }); return () => { alive = false; }; }, [role]);
  function logout() { clearSession(); setSession(null); go('/signin', { replace: true }); }
  if (authError) return <Navigate to="/signin" replace state={{ error: authError }}/>;
  if (!session) return <div className="workspace"><main className="workspace-main"><p>Loading account…</p></main></div>;
  const groups = nav[role] || []; const title = groups.flatMap(g => g[1]).find(x => x[1] === slug)?.[0] || 'Overview';
  const page = slug === 'profile' ? <Profile/> : slug === 'new-audit' && role === 'client' ? <NewAudit onCreated={item => { setEngagements(old => [item, ...old]); setEngagementId(item.id); go(`${base}/projects`); }}/> : slug === 'projects' || slug === 'requests' ? <div className="stack"><Header eyebrow={roles[role]} title={slug === 'requests' ? 'Engagement requests' : 'Audit projects'} desc={role === 'client' ? 'Track audit stages, upload evidence, and manage auditor file access.' : 'Engagements visible to this account.'}/><ErrorBox error={engagementError}/>{role === 'client' && engagements.length > 0 && <div className="filters"><EngagementSelect engagements={engagements} value={engagementId} onChange={setEngagementId}/></div>}{engagements.length ? <EngagementTable engagements={engagements} onAssign={role === 'client' ? setAssignmentEngagement : undefined}/> : <Empty>No engagements are available.</Empty>}{role === 'client' && engagementId && <EngagementProgress engagementId={engagementId}/>}{role === 'client' && assignmentEngagement && <Assignment key={assignmentEngagement.id} engagement={assignmentEngagement} onDone={async () => { setAssignmentEngagement(null); try { const rows = await api('/engagements/'); setEngagements(rows); } catch (e) { setEngagementError(e.message); } }}/>}</div> : slug === 'documents' ? <Documents engagements={engagements} engagementId={engagementId} setEngagementId={setEngagementId}/> : slug === 'archive' ? <Archive engagements={engagements} engagementId={engagementId} setEngagementId={setEngagementId}/> : slug === 'reports' ? <Reports engagements={engagements} engagementId={engagementId} setEngagementId={setEngagementId}/> : ['procedures', 'checks'].includes(slug) ? <Procedures engagements={engagements} engagementId={engagementId} setEngagementId={setEngagementId}/> : slug === 'sampling' ? <Sampling engagements={engagements} engagementId={engagementId} setEngagementId={setEngagementId}/> : ['traceability', 'audit-trail'].includes(slug) ? <Traceability engagements={engagements} engagementId={engagementId} setEngagementId={setEngagementId}/> : ['exceptions', 'findings'].includes(slug) ? <Findings engagements={engagements} engagementId={engagementId} setEngagementId={setEngagementId}/> : role === 'admin' && slug === 'users' ? <AdminUsers/> : role === 'admin' && slug === 'companies' ? <AdminDirectory kind="companies"/> : role === 'admin' && slug === 'auditors' ? <AdminDirectory kind="auditors"/> : role === 'admin' && slug === 'logs' ? <AdminLogs/> : role === 'admin' && slug === 'monitoring' ? <Monitoring/> : role === 'admin' && slug === 'security' ? <AdminLogs/> : <Dashboard role={role} engagements={engagements} onCreate={() => go(`${base}/new-audit`)}/>;
  return <div className={`workspace ${collapsed ? 'collapsed' : ''}`}><button className={`scrim ${mobile ? 'visible' : ''}`} onClick={() => setMobile(false)} aria-label="Close navigation"/><aside className={`sidebar ${mobile ? 'mobile-open' : ''}`}><div className="side-brand"><Link className="brand" to="/">TRACE<span className="period">.</span></Link><button className="iconbtn collapse" onClick={() => setCollapsed(!collapsed)} aria-label="Collapse sidebar"><PanelLeftClose/></button></div><div className="workspace-switch"><b>{session.name?.slice(0, 1).toUpperCase() || 'U'}</b><span><strong>{session.organization || session.name}</strong><small>{roles[role]}</small></span><ChevronDown size={14}/></div><nav>{groups.map(([group, items]) => <div className="navgroup" key={group}><small>{group}</small>{items.filter(([, path]) => !(role !== 'client' && path === 'new-audit')).map(([label, path, Icon]) => <Link key={path} to={base + (path ? `/${path}` : '')} className={slug === path ? 'active' : ''} title={collapsed ? label : ''}><Icon/><span>{label}</span></Link>)}</div>)}</nav><div className="side-bottom"><button onClick={() => go(`${base}/profile`)}><User/><span>Account</span></button><div className="side-user"><b>{session.name?.slice(0, 1).toUpperCase() || 'U'}</b><span><strong>{session.name}</strong><small>{session.email}</small></span><button aria-label="Sign out" onClick={logout}><LogOut/></button></div></div></aside><main className="workspace-main"><header className="topbar"><button className="iconbtn mobile-menu" onClick={() => setMobile(true)} aria-label="Open navigation"><Menu/></button><div className="crumb">TRACE <ChevronRight/> {roles[role]} <ChevronRight/> <strong>{title}</strong></div><div className="top-actions"><span className="env"><i/> CONNECTED API</span><button className="iconbtn" aria-label="Search" onClick={() => setSearchOpen(!searchOpen)}><Search/></button><button className="avatar" onClick={() => go(`${base}/profile`)}>{session.name?.slice(0, 1).toUpperCase()}</button></div></header>{searchOpen && <div className="global-search"><Search/><input autoFocus placeholder="Search workspace pages" value={search} onChange={e => setSearch(e.target.value)}/><button className="iconbtn" onClick={() => setSearchOpen(false)}><X/></button><div>{search ? groups.flatMap(g => g[1]).filter(x => x[0].toLowerCase().includes(search.toLowerCase())).map(x => <Link key={x[1]} to={base + (x[1] ? `/${x[1]}` : '')}>{x[0]}</Link>) : 'Search navigation'}</div></div>}<div className="content">{engagementError && <ErrorBox error={engagementError}/ >}{page}</div></main></div>;
}

function Monitoring() { const { data, error, loading, reload } = useApiData('/health'); return <div className="stack"><Header eyebrow="Operations" title="API health" desc="Live health response from the backend." action={<Btn kind="soft" onClick={reload}><RefreshCw size={15}/> Refresh</Btn>}/><ErrorBox error={error}/>{loading ? <p>Loading health…</p> : data ? <section className="panel pad"><h2>{data.status}</h2><p>Database: {data.database}</p><p>API version: {data.version}</p></section> : <Empty>Health data is unavailable.</Empty>}</div>; }

function Profile() { const { data, error, loading } = useApiData('/auth/me'); const [current, setCurrent] = useState(''), [next, setNext] = useState(''), [message, setMessage] = useState(''); async function change(e) { e.preventDefault(); setMessage(''); try { const result = await api('/auth/password', { method: 'POST', body: jsonBody({ current_password: current, new_password: next }) }); setMessage(result.status); setCurrent(''); setNext(''); } catch (err) { setMessage(err.message); } } return <div className="stack"><Header eyebrow="Account" title="Profile" desc="Identity details returned by the authenticated API."/><ErrorBox error={error}/>{loading ? <p>Loading account…</p> : data && <><section className="panel pad"><h2>{data.name}</h2><div className="review-row"><span>Email</span><strong>{data.email}</strong></div><div className="review-row"><span>Role</span><strong>{roles[data.role] || data.role}</strong></div><div className="review-row"><span>Organization</span><strong>{data.organization || '—'}</strong></div><div className="review-row"><span>Account status</span><strong>{data.active ? 'Active' : 'Disabled'}</strong></div></section><section className="panel pad"><h2>Change password</h2><form className="formgrid" onSubmit={change}><label>Current password<input required type="password" value={current} onChange={e => setCurrent(e.target.value)}/></label><label>New password<input required minLength="10" type="password" value={next} onChange={e => setNext(e.target.value)}/></label><Btn>Update password</Btn></form>{message && <p>{message}</p>}</section></>}</div>; }

export default function App() { return <Routes><Route path="/" element={<Landing/>}/><Route path="/signin" element={<Auth mode="signin"/>}/><Route path="/signup" element={<Auth mode="signup"/>}/><Route path="/app/*" element={<Workspace/>}/><Route path="*" element={<Navigate to="/" replace/>}/></Routes>; }
