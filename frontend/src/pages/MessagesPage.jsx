import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, ArrowUpRight, BookOpen, Lock, Paperclip, Search, Send, X } from 'lucide-react';
import { cn } from '../components/NeoButton';
import { Avatar, CoverImage, EASE, timeAgo } from '../components/ui';
import { OnlineDot, usePulse } from '../components/social';
import { useAuth } from '../contexts/AuthContext';
import { getContacts, getConversation, getThreads, markThreadRead, searchBooks, sendMessage } from '../services/api';
import SignInGate from '../components/SignInGate';

const dayLabel = (iso) => {
  const d = new Date(iso);
  const today = new Date();
  const y = new Date(); y.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === y.toDateString()) return 'Yesterday';
  return d.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
};
const clock = (iso) => new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

/** A shared book inside a message bubble. */
const BookAttachment = ({ book, mine }) => (
  <Link to={`/book/${encodeURIComponent(book.title)}`} className={cn('flex gap-3 p-2.5 rounded-[14px] mb-1.5 group', mine ? 'bg-latte/10' : 'bg-text-main/[0.05]')}>
    <span className="w-12 aspect-[2/3] rounded-[3px] overflow-hidden shadow-cover shrink-0 transition-transform duration-500 group-hover:-rotate-3"><CoverImage book={book} /></span>
    <span className="min-w-0 py-0.5">
      <span className="block text-[10px] uppercase tracking-[0.1em] opacity-60">Shared a book</span>
      <span className="block font-serif text-[1.15rem] leading-tight line-clamp-2">{book.title}</span>
      <span className="block text-[11px] opacity-60 mt-0.5">{book.authors?.[0]} · ★ {Number(book.average_rating || 0).toFixed(1)}</span>
    </span>
    <ArrowUpRight className="w-4 h-4 shrink-0 opacity-50 group-hover:opacity-100" />
  </Link>
);

/** Inline book picker for attaching a book to a message. */
const BookPicker = ({ onPick, onClose }) => {
  const [q, setQ] = useState('');
  const [books, setBooks] = useState([]);
  useEffect(() => {
    if (!q.trim()) { setBooks([]); return undefined; }
    const id = setTimeout(() => searchBooks(q).then((r) => setBooks(r.books.slice(0, 8))).catch(() => {}), 220);
    return () => clearTimeout(id);
  }, [q]);
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} className="absolute bottom-full left-0 right-0 mb-2 rounded-[18px] bg-surface-white border border-border shadow-brutal-lg p-3 z-10">
      <div className="flex items-center gap-2 border-b border-border pb-2">
        <Search className="w-4 h-4 text-text-muted" />
        <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a book to share…" className="flex-1 bg-transparent outline-none text-[14px]" />
        <button onClick={onClose} aria-label="Close"><X className="w-4 h-4" /></button>
      </div>
      <div className="max-h-64 overflow-y-auto mt-2" data-lenis-prevent>
        {books.map((b) => (
          <button key={b.book_id} onClick={() => onPick(b)} className="w-full flex items-center gap-3 p-2 rounded-[10px] hover:bg-text-main/[0.05] text-left">
            <span className="w-8 aspect-[2/3] rounded-[2px] overflow-hidden shrink-0"><CoverImage book={b} /></span>
            <span className="min-w-0">
              <span className="block text-[13px] font-medium truncate">{b.title}</span>
              <span className="block text-[11px] text-text-muted truncate">{b.authors?.[0]}</span>
            </span>
          </button>
        ))}
        {q && !books.length && <p className="label p-2">Type a title or author…</p>}
      </div>
    </motion.div>
  );
};

const Conversation = ({ username, onSent }) => {
  const { refresh } = usePulse();
  const [conv, setConv] = useState(null);
  const [text, setText] = useState('');
  const [book, setBook] = useState(null);
  const [picker, setPicker] = useState(false);
  const [error, setError] = useState(null);
  const bottom = useRef(null);
  const count = useRef(0);

  const load = useCallback(async () => {
    try {
      const c = await getConversation(username);
      setConv(c);
      if (c.messages.some((m) => !m.mine && !m.read)) { await markThreadRead(username); refresh(); onSent?.(); }
    } catch (e) {
      setError(e?.response?.status === 404 ? 'No reader with that name.' : 'Could not load messages.');
    }
  }, [username, refresh, onSent]);

  useEffect(() => { setConv(null); setError(null); count.current = 0; load(); const id = setInterval(load, 4000); return () => clearInterval(id); }, [load]);
  useEffect(() => {
    if (conv && conv.messages.length !== count.current) {
      bottom.current?.scrollIntoView({ behavior: count.current ? 'smooth' : 'auto', block: 'end' });
      count.current = conv.messages.length;
    }
  }, [conv]);

  const submit = async (e) => {
    e?.preventDefault();
    if (!text.trim() && !book) return;
    const body = text.trim();
    const optimistic = { message_id: `tmp-${Date.now()}`, mine: true, text: body || null, book, created_at: new Date().toISOString(), pending: true };
    setConv((c) => ({ ...c, messages: [...c.messages, optimistic] }));
    setText(''); setBook(null); setPicker(false);
    try {
      await sendMessage(username, body, book?.book_id);
      load(); onSent?.();
    } catch (err) {
      setError(err?.response?.data?.detail || 'Message not sent');
      setConv((c) => ({ ...c, messages: c.messages.filter((m) => m.message_id !== optimistic.message_id) }));
    }
  };

  if (error && !conv) return <div className="h-full flex items-center justify-center font-serif text-3xl text-text-muted p-8 text-center">{error}</div>;
  if (!conv) return <div className="h-full flex items-center justify-center label">Opening conversation…</div>;

  let lastDay = null;
  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center gap-3 px-5 h-20 border-b border-border shrink-0">
        <Link to="/messages" className="lg:hidden w-9 h-9 rounded-full border border-border flex items-center justify-center" aria-label="Back"><ArrowLeft className="w-4 h-4" /></Link>
        <Link to={`/u/${conv.username}`} className="relative"><Avatar username={conv.username} size="w-11 h-11 text-lg" /><OnlineDot on={conv.online} /></Link>
        <div className="flex-1 min-w-0">
          <Link to={`/u/${conv.username}`} className="font-wide font-semibold text-[20px] leading-none hover:text-accent-red transition-colors">@{conv.username}</Link>
          <p className={cn('text-[12px] mt-1', conv.online ? 'text-[#2E9A5F]' : 'text-text-muted')}>{conv.online ? 'Active now' : 'Offline'}</p>
        </div>
        <Link to={`/u/${conv.username}`} className="h-9 px-4 rounded-full border border-border text-[12px] flex items-center hover:bg-text-main hover:text-bg-base transition-colors">Profile</Link>
      </div>

      <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-6 space-y-1.5" data-lenis-prevent>
        {conv.messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center">
            <Avatar username={conv.username} size="w-20 h-20 text-3xl" />
            <p className="font-serif text-3xl mt-4">Say hello to @{conv.username}</p>
            <p className="text-[13px] text-text-muted mt-2">Share a book with the paperclip, or just ask what they’re reading.</p>
          </div>
        )}
        {conv.messages.map((m, i) => {
          const day = dayLabel(m.created_at);
          const showDay = day !== lastDay;
          lastDay = day;
          const next = conv.messages[i + 1];
          const tail = !next || next.mine !== m.mine;
          return (
            <React.Fragment key={m.message_id}>
              {showDay && <p className="text-center text-[11px] uppercase tracking-[0.1em] text-text-muted py-3">{day}</p>}
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.98 }}
                animate={{ opacity: m.pending ? 0.6 : 1, y: 0, scale: 1 }}
                transition={{ duration: 0.35, ease: EASE }}
                className={cn('flex', m.mine ? 'justify-end' : 'justify-start', tail && 'mb-3')}
              >
                <div className={cn('max-w-[78%] sm:max-w-[62%] px-3.5 py-2.5 text-[14px] leading-[1.45]',
                  m.mine ? 'bg-espresso text-latte rounded-[20px]' : 'bg-surface-white border border-border rounded-[20px]',
                  tail && (m.mine ? 'rounded-br-[6px]' : 'rounded-bl-[6px]'))}
                >
                  {m.book && <BookAttachment book={m.book} mine={m.mine} />}
                  {m.text && <p className="whitespace-pre-wrap break-words">{m.text}</p>}
                  <p className={cn('text-[10px] mt-1 text-right', m.mine ? 'opacity-50' : 'text-text-muted')}>
                    {m.pending ? 'Sending…' : clock(m.created_at)}{m.mine && !m.pending && i === conv.messages.length - 1 ? ` · ${m.read ? 'Seen' : 'Sent'}` : ''}
                  </p>
                </div>
              </motion.div>
            </React.Fragment>
          );
        })}
        <div ref={bottom} />
      </div>

      <form onSubmit={submit} className="relative px-4 sm:px-6 py-4 border-t border-border shrink-0">
        <AnimatePresence>{picker && <BookPicker onPick={(b) => { setBook(b); setPicker(false); }} onClose={() => setPicker(false)} />}</AnimatePresence>
        {!conv.can_message ? (
          <p className="text-[13px] text-text-muted flex items-center gap-2"><Lock className="w-4 h-4" /> Follow @{conv.username} (or have them follow you) to send messages.</p>
        ) : (
          <>
            {book && (
              <div className="flex items-center gap-3 mb-2 p-2 rounded-[12px] bg-text-main/[0.05]">
                <span className="w-7 aspect-[2/3] rounded-[2px] overflow-hidden"><CoverImage book={book} /></span>
                <span className="flex-1 text-[13px] truncate"><BookOpen className="w-3.5 h-3.5 inline mr-1" />{book.title}</span>
                <button type="button" onClick={() => setBook(null)} aria-label="Remove book"><X className="w-4 h-4" /></button>
              </div>
            )}
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setPicker((p) => !p)} aria-label="Attach a book" className={cn('w-11 h-11 rounded-full border border-border flex items-center justify-center shrink-0 transition-colors', picker && 'bg-text-main text-bg-base')}>
                <Paperclip className="w-4 h-4" />
              </button>
              <input
                value={text}
                onChange={(e) => setText(e.target.value.slice(0, 1000))}
                placeholder={`Message @${conv.username}…`}
                className="flex-1 h-11 rounded-full border border-border bg-surface-white px-4 text-[14px] outline-none focus:border-text-main"
              />
              <motion.button whileTap={{ scale: 0.9 }} disabled={!text.trim() && !book} aria-label="Send" className="w-11 h-11 rounded-full bg-accent-red text-white flex items-center justify-center shrink-0 disabled:opacity-40">
                <Send className="w-4 h-4" />
              </motion.button>
            </div>
            {error && <p className="text-[12px] text-accent-red mt-2">{error}</p>}
          </>
        )}
      </form>
    </div>
  );
};

const MessagesPage = () => {
  const { username } = useParams();
  const navigate = useNavigate();
  const { currentUser, loading } = useAuth();
  const [threads, setThreads] = useState(null);
  const [contacts, setContacts] = useState([]);
  const [q, setQ] = useState('');

  const loadThreads = useCallback(() => { getThreads().then(setThreads).catch(() => setThreads([])); }, []);
  useEffect(() => {
    if (!currentUser) return undefined;
    loadThreads();
    getContacts().then(setContacts).catch(() => {});
    const id = setInterval(loadThreads, 8000);
    return () => clearInterval(id);
  }, [currentUser, loadThreads]);

  if (loading) return null;
  if (!currentUser) {
    return <SignInGate animal="rabbit" title="Messages" text="Talk books with the readers you follow. Share a title, swap recommendations, plan a read-along." button="Sign in to message" prop="beret" seed={8} />;
  }

  const inThreads = new Set((threads || []).map((t) => t.username));
  const startable = contacts.filter((c) => !inThreads.has(c.username) && c.username.toLowerCase().includes(q.toLowerCase()));
  const shownThreads = (threads || []).filter((t) => t.username.toLowerCase().includes(q.toLowerCase()));
  const online = contacts.filter((c) => c.online);

  return (
    <div className="px-3 sm:px-5 lg:px-8 pb-10">
      <div className="grid lg:grid-cols-[360px_1fr] h-[calc(100dvh-120px)] min-h-[560px] rounded-[26px] border border-border bg-bg-base overflow-hidden">
        {/* Thread list */}
        <aside className={cn('flex flex-col border-r border-border min-h-0', username && 'hidden lg:flex')}>
          <div className="px-5 pt-6 pb-4">
            <p className="font-statement text-[44px]">Inbox</p>
            <div className="mt-3 h-11 rounded-full border border-border bg-surface-white flex items-center gap-2 px-4">
              <Search className="w-4 h-4 text-text-muted" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search people" className="flex-1 bg-transparent outline-none text-[14px]" />
            </div>
          </div>
          {online.length > 0 && (
            <div className="px-5 pb-4">
              <p className="label mb-2">Online now</p>
              <div className="flex gap-3 overflow-x-auto pb-1" data-lenis-prevent>
                {online.map((c) => (
                  <button key={c.username} onClick={() => navigate(`/messages/${c.username}`)} className="flex flex-col items-center gap-1 shrink-0 w-14">
                    <span className="relative"><Avatar username={c.username} size="w-12 h-12 text-lg" /><OnlineDot on /></span>
                    <span className="text-[10px] truncate w-full text-center">{c.username}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="flex-1 overflow-y-auto px-2 pb-4 min-h-0" data-lenis-prevent>
            {threads === null && <p className="label px-3">Loading…</p>}
            {shownThreads.map((t) => (
              <Link
                key={t.username}
                to={`/messages/${t.username}`}
                className={cn('flex items-center gap-3 px-3 py-3 rounded-[16px] transition-colors', username === t.username ? 'bg-espresso text-latte' : 'hover:bg-text-main/[0.05]')}
              >
                <span className="relative"><Avatar username={t.username} size="w-12 h-12 text-lg" /><OnlineDot on={t.online} /></span>
                <span className="flex-1 min-w-0">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className={cn('text-[14px] truncate', t.unread ? 'font-semibold' : 'font-medium')}>@{t.username}</span>
                    <span className="text-[11px] opacity-50 shrink-0">{timeAgo(t.last.created_at)}</span>
                  </span>
                  <span className={cn('block text-[13px] truncate', t.unread ? 'font-medium' : 'opacity-60')}>
                    {t.last.mine ? 'You: ' : ''}{t.last.text || (t.last.book ? `📖 ${t.last.book.title}` : '')}
                  </span>
                </span>
                {t.unread > 0 && <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-accent-red text-white text-[11px] font-semibold flex items-center justify-center">{t.unread}</span>}
              </Link>
            ))}
            {startable.length > 0 && (
              <>
                <p className="label px-3 pt-5 pb-2">Start a conversation</p>
                {startable.map((c) => (
                  <Link key={c.username} to={`/messages/${c.username}`} className="flex items-center gap-3 px-3 py-2.5 rounded-[16px] hover:bg-text-main/[0.05]">
                    <span className="relative"><Avatar username={c.username} size="w-10 h-10 text-base" /><OnlineDot on={c.online} /></span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-[14px] font-medium truncate">@{c.username}</span>
                      <span className="block text-[11px] text-text-muted">{c.you_follow && c.follows_you ? 'You follow each other' : c.you_follow ? 'You follow them' : 'Follows you'}</span>
                    </span>
                  </Link>
                ))}
              </>
            )}
            {threads?.length === 0 && contacts.length === 0 && (
              <div className="px-3 py-8 text-center">
                <p className="font-serif text-2xl">No one to message yet</p>
                <p className="text-[13px] text-text-muted mt-2">Follow readers from People and they’ll show up here.</p>
                <Link to="/people" className="inline-flex mt-4 h-10 px-5 rounded-full bg-text-main text-bg-base text-[13px] items-center">Find people</Link>
              </div>
            )}
          </div>
        </aside>

        {/* Conversation */}
        <section className={cn('min-h-0', !username && 'hidden lg:block')}>
          {username ? (
            <Conversation key={username} username={username} onSent={loadThreads} />
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center p-8 bg-[radial-gradient(circle_at_50%_40%,rgba(216,50,43,0.08),transparent_60%)]">
              <motion.div initial={{ rotate: -8, y: 10, opacity: 0 }} animate={{ rotate: 0, y: 0, opacity: 1 }} transition={{ duration: 0.9, ease: EASE }} className="w-24 h-24 rounded-full bg-espresso text-latte flex items-center justify-center">
                <Send className="w-9 h-9" />
              </motion.div>
              <p className="font-statement text-[clamp(2.4rem,5vw,4.5rem)] mt-6">Your messages</p>
              <p className="font-serif text-xl text-text-muted mt-2 max-w-md">Pick a conversation, or start one with someone you follow. Books you share arrive as cards they can open.</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default MessagesPage;
