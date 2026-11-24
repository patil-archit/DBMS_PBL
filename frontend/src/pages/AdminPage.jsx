import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Pencil, Plus, RefreshCw, Trash2 } from 'lucide-react';
import NeoButton from '../components/NeoButton';
import {
  Card, Empty, ErrorBox, Field, Input, Modal, Page, PageTitle, SectionTitle, Select, Spinner, Stars, Tabs, TextArea, UserLink, timeAgo,
} from '../components/ui';
import { useAuth } from '../contexts/AuthContext';
import { admin, errorMessage } from '../services/api';

const Table = ({ cols, rows, render }) => (
  <div className="overflow-x-auto border border-border bg-surface-white">
    <table className="w-full text-left">
      <thead className="bg-text-main text-bg-base">
        <tr>{cols.map((c) => <th key={c} className="px-3 py-2 font-medium whitespace-nowrap">{c}</th>)}</tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i} className="border-t border-border align-top">{render(r).map((cell, j) => <td key={j} className="px-3 py-2">{cell}</td>)}</tr>
        ))}
      </tbody>
    </table>
  </div>
);

// ---------------------------------------------------------------------
// Overview (materialized-view reports)
// ---------------------------------------------------------------------
const Overview = () => {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const load = useCallback(() => {
    setData(null);
    admin.analytics().then(setData).catch((e) => setError(errorMessage(e)));
  }, []);
  useEffect(load, [load]);
  if (error) return <ErrorBox>{error}</ErrorBox>;
  if (!data) return <Spinner label="Refreshing reports…" />;
  const max = Math.max(1, ...data.genre_trends.map((g) => g.logs));

  return (
    <div className="space-y-10">
      <div className="flex flex-wrap gap-4">
        {Object.entries(data.totals).map(([k, v]) => (
          <Card key={k} className="flex-1 min-w-[140px]">
            <div className="font-medium text-3xl">{v}</div>
            <div className="label text-text-muted">{k.replace('_', ' ')}</div>
          </Card>
        ))}
      </div>
      <div className="grid lg:grid-cols-2 gap-8">
        <section>
          <SectionTitle right={<NeoButton size="sm" variant="white" onClick={load}><RefreshCw className="w-4 h-4 mr-1" /> Refresh</NeoButton>}>Most read books</SectionTitle>
          {data.most_read.length ? (
            <Table cols={['Book', 'Readers', 'Logs', 'Avg rating', 'Likes']} rows={data.most_read} render={(r) => [
              <Link to={`/book/${encodeURIComponent(r.title)}`} className="font-medium hover:underline">{r.title}</Link>, r.readers, r.times_logged, <Stars value={r.avg_user_rating} />, r.likes,
            ]} />
          ) : <Empty title="No diary entries yet" />}
        </section>
        <section>
          <SectionTitle>Most active users</SectionTitle>
          <Table cols={['User', 'Entries', 'Reviews', 'Comments', 'Lists']} rows={data.active_users} render={(r) => [
            <UserLink username={r.username} />, r.entries, r.reviews, r.comments, r.lists,
          ]} />
        </section>
      </div>
      <section>
        <SectionTitle>Genre trends (last 12 months)</SectionTitle>
        {data.genre_trends.length ? (
          <ul className="space-y-2">
            {data.genre_trends.map((g) => (
              <li key={g.genre} className="grid grid-cols-[160px_1fr_auto] items-center gap-3">
                <span className="font-medium truncate">{g.genre}</span>
                <span className="h-6 bg-surface-white border border-border">
                  <span className="block h-full bg-accent-teal border-r border-border" style={{ width: `${(100 * g.logs) / max}%` }} />
                </span>
                <span className="label w-28 text-right">{g.logs} logs · {g.avg_rating ?? '–'}★</span>
              </li>
            ))}
          </ul>
        ) : <Empty title="No data yet" />}
      </section>
      <section>
        <SectionTitle>Database sync (Neo4j / MongoDB outbox)</SectionTitle>
        <Table cols={['Target', 'Pending', 'Failing', 'Last error']} rows={data.sync} render={(r) => [r.target, r.pending, r.failing, r.last_error || '–']} />
        <p className="text-sm text-text-muted mt-2 font-medium">PostgreSQL is the source of truth. Failed updates stay pending and are retried automatically.</p>
      </section>
    </div>
  );
};

// ---------------------------------------------------------------------
// Moderation
// ---------------------------------------------------------------------
const Moderation = () => {
  const [status, setStatus] = useState('open');
  const [reports, setReports] = useState(null);
  const load = useCallback(() => admin.reports(status).then(setReports), [status]);
  useEffect(() => { load(); }, [load]);

  const resolve = async (id, action) => {
    if (action === 'remove' && !window.confirm('Remove this review permanently?')) return;
    await admin.resolveReport(id, action);
    load();
  };

  return (
    <>
      <Tabs active={status} onChange={setStatus} tabs={[{ id: 'open', label: 'Open' }, { id: 'dismissed', label: 'Dismissed' }, { id: 'removed', label: 'Removed' }]} />
      {reports === null ? <Spinner /> : reports.length === 0 ? <Empty title="Nothing to review" /> : (
        <ul className="space-y-4">
          {reports.map((r) => (
            <li key={r.report_id}>
              <Card>
                <p className="text-sm font-medium text-text-muted mb-2">
                  Reported by <UserLink username={r.reporter} /> {timeAgo(r.created_at)} · {r.open_reports} open report(s)
                  {r.resolved_by && <> · {r.status} by <UserLink username={r.resolved_by} /></>}
                </p>
                <p className="font-medium mb-2">Reason: <span className="font-medium">{r.reason}</span></p>
                <div className="bg-bg-base border border-border p-3 mb-3">
                  <p className="text-sm font-medium"><UserLink username={r.review_author} /> on <em>{r.book_title}</em> <Stars value={r.rating} size="w-3 h-3" /></p>
                  <p className="font-medium whitespace-pre-wrap">{r.review_text || '(rating only)'}</p>
                </div>
                {status === 'open' && (
                  <div className="flex gap-3">
                    <NeoButton size="sm" variant="white" onClick={() => resolve(r.report_id, 'dismiss')}>Keep review</NeoButton>
                    <NeoButton size="sm" variant="primary" onClick={() => resolve(r.report_id, 'remove')}>Remove review</NeoButton>
                  </div>
                )}
              </Card>
            </li>
          ))}
        </ul>
      )}
    </>
  );
};

// ---------------------------------------------------------------------
// Catalogue editors
// ---------------------------------------------------------------------
const emptyBook = { title: '', subtitle: '', isbn: '', language: 'en', description: '', pub_year: '', page_count: '', cover_url: '', publisher: '', authors: '', genres: '' };

const BooksAdmin = () => {
  const [q, setQ] = useState('');
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState(null);
  const [error, setError] = useState(null);
  const load = useCallback(() => admin.books(q).then(setRows), [q]);
  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [load]);

  const edit = async (id) => {
    setError(null);
    if (!id) return setForm({ ...emptyBook });
    const b = await admin.book(id);
    setForm({ ...b, authors: b.authors.join(', '), genres: b.genres.join(', '), pub_year: b.pub_year ?? '', page_count: b.page_count ?? '' });
  };

  const save = async () => {
    try {
      const split = (s) => s.split(',').map((x) => x.trim()).filter(Boolean);
      await admin.saveBook({
        ...form,
        pub_year: form.pub_year === '' ? null : Number(form.pub_year),
        page_count: form.page_count === '' ? null : Number(form.page_count),
        authors: split(form.authors), genres: split(form.genres),
      }, form.book_id);
      setForm(null);
      load();
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  const remove = async (b) => {
    if (!window.confirm(`Delete “${b.title}”? Diary entries for it will be deleted too.`)) return;
    await admin.deleteBook(b.book_id);
    load();
  };

  const f = (k) => ({ value: form[k] ?? '', onChange: (e) => setForm({ ...form, [k]: e.target.value }) });

  return (
    <>
      <div className="flex gap-3 mb-4">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter by title or ISBN" />
        <NeoButton variant="navy" onClick={() => edit(null)}><Plus className="w-4 h-4 mr-1" /> Add book</NeoButton>
      </div>
      <Table cols={['Title', 'Authors', 'Year', 'Rating', '']} rows={rows} render={(b) => [
        <Link to={`/book/${encodeURIComponent(b.title)}`} className="font-medium hover:underline">{b.title}</Link>, b.authors, b.pub_year, `${b.avg_rating} (${b.ratings_count})`,
        <span className="flex gap-2"><button aria-label="Edit" onClick={() => edit(b.book_id)}><Pencil className="w-4 h-4" /></button><button aria-label="Delete" onClick={() => remove(b)} className="hover:text-accent-red"><Trash2 className="w-4 h-4" /></button></span>,
      ]} />
      <Modal open={!!form} onClose={() => setForm(null)} title={form?.book_id ? 'Edit book' : 'Add book'} wide>
        {form && (
          <>
            <ErrorBox>{error}</ErrorBox>
            <div className="grid sm:grid-cols-2 gap-x-4">
              <Field label="Title"><Input {...f('title')} /></Field>
              <Field label="Subtitle"><Input {...f('subtitle')} /></Field>
              <Field label="Authors" hint="Comma separated"><Input {...f('authors')} /></Field>
              <Field label="Genres" hint="Comma separated"><Input {...f('genres')} /></Field>
              <Field label="ISBN-13"><Input {...f('isbn')} maxLength={13} /></Field>
              <Field label="Publisher"><Input {...f('publisher')} /></Field>
              <Field label="Year"><Input type="number" {...f('pub_year')} /></Field>
              <Field label="Pages"><Input type="number" min={1} {...f('page_count')} /></Field>
              <Field label="Language"><Input {...f('language')} maxLength={10} /></Field>
              <Field label="Cover URL"><Input {...f('cover_url')} /></Field>
            </div>
            <Field label="Description"><TextArea {...f('description')} rows={5} /></Field>
            <div className="flex justify-end gap-3">
              <NeoButton variant="white" onClick={() => setForm(null)}>Cancel</NeoButton>
              <NeoButton variant="primary" onClick={save} disabled={!form.title?.trim()}>Save</NeoButton>
            </div>
          </>
        )}
      </Modal>
    </>
  );
};

const AuthorsAdmin = () => {
  const [q, setQ] = useState('');
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState(null);
  const [error, setError] = useState(null);
  const load = useCallback(() => admin.authors(q).then(setRows), [q]);
  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [load]);

  const save = async () => {
    try {
      await admin.saveAuthor(form, form.author_id);
      setForm(null);
      load();
    } catch (e) {
      setError(errorMessage(e));
    }
  };
  const remove = async (a) => {
    if (!window.confirm(`Delete author “${a.name}”?`)) return;
    await admin.deleteAuthor(a.author_id);
    load();
  };

  return (
    <>
      <div className="flex gap-3 mb-4">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter by name" />
        <NeoButton variant="navy" onClick={() => { setError(null); setForm({ name: '', bio: '', photo_url: '' }); }}><Plus className="w-4 h-4 mr-1" /> Add author</NeoButton>
      </div>
      <Table cols={['Name', 'Books', 'Bio', '']} rows={rows} render={(a) => [
        <Link to={`/author/${encodeURIComponent(a.name)}`} className="font-medium hover:underline">{a.name}</Link>, a.book_count,
        <span className="line-clamp-2 text-sm">{a.bio}</span>,
        <span className="flex gap-2"><button aria-label="Edit" onClick={() => { setError(null); setForm({ ...a, bio: a.bio || '', photo_url: a.photo_url || '' }); }}><Pencil className="w-4 h-4" /></button><button aria-label="Delete" onClick={() => remove(a)} className="hover:text-accent-red"><Trash2 className="w-4 h-4" /></button></span>,
      ]} />
      <Modal open={!!form} onClose={() => setForm(null)} title={form?.author_id ? 'Edit author' : 'Add author'}>
        {form && (
          <>
            <ErrorBox>{error}</ErrorBox>
            <Field label="Name"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
            <Field label="Photo URL"><Input value={form.photo_url} onChange={(e) => setForm({ ...form, photo_url: e.target.value })} /></Field>
            <Field label="Bio"><TextArea value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} /></Field>
            <div className="flex justify-end gap-3">
              <NeoButton variant="white" onClick={() => setForm(null)}>Cancel</NeoButton>
              <NeoButton variant="primary" onClick={save} disabled={!form.name.trim()}>Save</NeoButton>
            </div>
          </>
        )}
      </Modal>
    </>
  );
};

const GenresAdmin = () => {
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState(null);
  const [error, setError] = useState(null);
  const load = useCallback(() => admin.genres().then(setRows), []);
  useEffect(() => { load(); }, [load]);

  const save = async () => {
    try {
      await admin.saveGenre({ name: form.name, parent_genre_id: form.parent_genre_id ? Number(form.parent_genre_id) : null }, form.genre_id);
      setForm(null);
      load();
    } catch (e) {
      setError(errorMessage(e));
    }
  };
  const remove = async (g) => {
    if (!window.confirm(`Delete genre “${g.name}”? Books keep their other genres.`)) return;
    await admin.deleteGenre(g.genre_id);
    load();
  };

  return (
    <>
      <div className="mb-4"><NeoButton variant="navy" onClick={() => { setError(null); setForm({ name: '', parent_genre_id: '' }); }}><Plus className="w-4 h-4 mr-1" /> Add genre</NeoButton></div>
      <Table cols={['Genre', 'Parent', 'Books', '']} rows={rows} render={(g) => [
        <span className="font-medium">{g.name}</span>, g.parent_name || '–', g.book_count,
        <span className="flex gap-2"><button aria-label="Edit" onClick={() => { setError(null); setForm({ ...g, parent_genre_id: g.parent_genre_id || '' }); }}><Pencil className="w-4 h-4" /></button><button aria-label="Delete" onClick={() => remove(g)} className="hover:text-accent-red"><Trash2 className="w-4 h-4" /></button></span>,
      ]} />
      <Modal open={!!form} onClose={() => setForm(null)} title={form?.genre_id ? 'Edit genre' : 'Add genre'}>
        {form && (
          <>
            <ErrorBox>{error}</ErrorBox>
            <Field label="Name"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
            <Field label="Parent genre" hint="Genres can be nested (e.g. Space Opera under Science Fiction)">
              <Select value={form.parent_genre_id} onChange={(e) => setForm({ ...form, parent_genre_id: e.target.value })}>
                <option value="">None</option>
                {rows.filter((g) => g.genre_id !== form.genre_id).map((g) => <option key={g.genre_id} value={g.genre_id}>{g.name}</option>)}
              </Select>
            </Field>
            <div className="flex justify-end gap-3">
              <NeoButton variant="white" onClick={() => setForm(null)}>Cancel</NeoButton>
              <NeoButton variant="primary" onClick={save} disabled={!form.name.trim()}>Save</NeoButton>
            </div>
          </>
        )}
      </Modal>
    </>
  );
};

const UsersAdmin = () => {
  const { me } = useAuth();
  const [q, setQ] = useState('');
  const [rows, setRows] = useState([]);
  const [error, setError] = useState(null);
  const load = useCallback(() => admin.users(q).then(setRows), [q]);
  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [load]);

  const setRole = async (u, role) => {
    try {
      await admin.setRole(u.user_id, role);
      load();
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  return (
    <>
      <ErrorBox>{error}</ErrorBox>
      <div className="mb-4"><Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter by username or email" /></div>
      <Table cols={['User', 'Email', 'Entries', 'Joined', 'Role']} rows={rows} render={(u) => [
        <UserLink username={u.username} />, u.email || '–', u.entries, timeAgo(u.created_at),
        <Select value={u.role} disabled={u.user_id === me.user_id} onChange={(e) => setRole(u, e.target.value)} className="py-1">
          {['reader', 'moderator', 'admin'].map((r) => <option key={r}>{r}</option>)}
        </Select>,
      ]} />
    </>
  );
};

const AuditLog = () => {
  const [table, setTable] = useState('');
  const [rows, setRows] = useState(null);
  useEffect(() => { admin.audit(table || undefined).then(setRows); }, [table]);

  const summary = (r) => {
    const row = r.new_data || r.old_data || {};
    const name = row.title || row.name || row.username || (row.entry_id && `entry #${row.entry_id}`) || (row.report_id && `report #${row.report_id}`);
    if (r.operation !== 'UPDATE' || !r.old_data) return name;
    const changed = Object.keys(r.new_data).filter((k) => JSON.stringify(r.new_data[k]) !== JSON.stringify(r.old_data[k]));
    return `${name}: ${changed.join(', ')}`;
  };

  return (
    <>
      <div className="mb-4 max-w-xs">
        <Select value={table} onChange={(e) => setTable(e.target.value)}>
          <option value="">All tables</option>
          {['book', 'author', 'genre', 'publisher', 'users', 'diary_entry', 'review_report'].map((t) => <option key={t}>{t}</option>)}
        </Select>
      </div>
      {rows === null ? <Spinner /> : rows.length === 0 ? <Empty title="No changes recorded yet" /> : (
        <Table cols={['When', 'Who', 'Table', 'Action', 'What']} rows={rows} render={(r) => [
          timeAgo(r.changed_at), r.changed_by ? <UserLink username={r.changed_by} /> : 'script', r.table_name, r.operation, <span className="text-sm">{summary(r)}</span>,
        ]} />
      )}
    </>
  );
};

// ---------------------------------------------------------------------
const AdminPage = () => {
  const { isStaff, isAdmin, loading } = useAuth();
  const [tab, setTab] = useState(null);

  useEffect(() => {
    if (!loading) setTab(isAdmin ? 'overview' : 'moderation');
  }, [loading, isAdmin]);

  if (loading || !tab) return <Spinner />;
  if (!isStaff) return <Page><Empty title="Admins and moderators only" /></Page>;

  const tabs = isAdmin
    ? [{ id: 'overview', label: 'Reports' }, { id: 'moderation', label: 'Moderation' }, { id: 'books', label: 'Books' }, { id: 'authors', label: 'Authors' }, { id: 'genres', label: 'Genres' }, { id: 'users', label: 'Users & roles' }, { id: 'audit', label: 'Audit log' }]
    : [{ id: 'moderation', label: 'Moderation' }];

  return (
    <Page>
      <PageTitle animal="owl" kicker="( Staff ) catalogue, reports, analytics and audit log">{isAdmin ? 'Admin' : 'Moderation'}</PageTitle>
      <Tabs active={tab} onChange={setTab} tabs={tabs} />
      {tab === 'overview' && <Overview />}
      {tab === 'moderation' && <Moderation />}
      {tab === 'books' && <BooksAdmin />}
      {tab === 'authors' && <AuthorsAdmin />}
      {tab === 'genres' && <GenresAdmin />}
      {tab === 'users' && <UsersAdmin />}
      {tab === 'audit' && <AuditLog />}
    </Page>
  );
};

export default AdminPage;
