import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Heart, MessageCircle, Send, UserPlus, X } from 'lucide-react';
import { cn } from './NeoButton';
import { Avatar, CoverImage, EASE, timeAgo } from './ui';
import { useAuth } from '../contexts/AuthContext';
import { getContacts, getNotifications, getPulse, markNotificationsSeen, sendMessage } from '../services/api';

// ---------------------------------------------------------------------
// Pulse: unread counts + presence, polled while signed in
// ---------------------------------------------------------------------
const PulseContext = createContext({ messages: 0, notifications: 0, refresh: () => {} });
export const usePulse = () => useContext(PulseContext);

export const PulseProvider = ({ children }) => {
  const { currentUser } = useAuth();
  const [counts, setCounts] = useState({ messages: 0, notifications: 0 });
  const refresh = useCallback(() => {
    if (!currentUser) return;
    getPulse().then(setCounts).catch(() => {});
  }, [currentUser]);
  useEffect(() => {
    if (!currentUser) { setCounts({ messages: 0, notifications: 0 }); return undefined; }
    refresh();
    const id = setInterval(refresh, 20000);
    const onFocus = () => refresh();
    window.addEventListener('focus', onFocus);
    return () => { clearInterval(id); window.removeEventListener('focus', onFocus); };
  }, [currentUser, refresh]);
  return <PulseContext.Provider value={{ ...counts, refresh }}>{children}</PulseContext.Provider>;
};

export const CountBadge = ({ n, className }) => (
  <AnimatePresence>
    {n > 0 && (
      <motion.span
        key="b"
        initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}
        transition={{ type: 'spring', stiffness: 500, damping: 22 }}
        className={cn('absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-accent-red text-white text-[10px] font-semibold flex items-center justify-center tabular-nums', className)}
      >
        {n > 99 ? '99+' : n}
      </motion.span>
    )}
  </AnimatePresence>
);

export const OnlineDot = ({ on, className }) => (on ? (
  <span className={cn('absolute bottom-0 right-0 w-3 h-3 rounded-full bg-[#3BB273] ring-2 ring-bg-base', className)} title="Online now">
    <span className="absolute inset-0 rounded-full bg-[#3BB273] animate-ping opacity-60" />
  </span>
) : null);

// ---------------------------------------------------------------------
// Notifications panel
// ---------------------------------------------------------------------
const NOTE = {
  follow: [UserPlus, (n) => <>started following you</>, (n) => `/u/${n.actor}`],
  like_review: [Heart, (n) => <>liked your review of <b className="font-medium">{n.title}</b></>, (n) => `/book/${encodeURIComponent(n.title)}`],
  comment_review: [MessageCircle, (n) => <>commented on your review of <b className="font-medium">{n.title}</b></>, (n) => `/book/${encodeURIComponent(n.title)}`],
  comment_list: [MessageCircle, (n) => <>commented on your list <b className="font-medium">{n.title}</b></>, (n) => `/lists/${n.list_id}`],
  like_list: [Heart, (n) => <>liked your list <b className="font-medium">{n.title}</b></>, (n) => `/lists/${n.list_id}`],
};

export const NotificationsPanel = ({ open, onClose }) => {
  const { refresh } = usePulse();
  const [items, setItems] = useState(null);
  useEffect(() => {
    if (!open) return;
    getNotifications().then((n) => {
      setItems(n);
      markNotificationsSeen().then(refresh).catch(() => {});
    }).catch(() => setItems([]));
  }, [open, refresh]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0, y: -10, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -10, scale: 0.97 }}
          transition={{ duration: 0.35, ease: EASE }}
          className="absolute right-0 top-[calc(100%+12px)] w-[min(92vw,400px)] origin-top-right rounded-[22px] bg-espresso text-latte shadow-brutal-lg overflow-hidden z-50"
        >
          <div className="flex items-center justify-between px-5 pt-5 pb-3">
            <p className="font-wide font-semibold text-[20px]">Notifications</p>
            <button onClick={onClose} aria-label="Close" className="w-8 h-8 rounded-full hover:bg-latte/10 flex items-center justify-center"><X className="w-4 h-4" /></button>
          </div>
          <div className="max-h-[60vh] overflow-y-auto px-2 pb-3" data-lenis-prevent>
            {items === null && <p className="px-3 py-6 text-[13px] opacity-60">Loading…</p>}
            {items?.length === 0 && <p className="px-3 py-6 font-serif text-2xl opacity-70">All quiet. Follow some readers to get things moving.</p>}
            {items?.map((n, i) => {
              const [Icon, text, href] = NOTE[n.kind] || NOTE.follow;
              return (
                <motion.div key={`${n.kind}-${n.ts}-${i}`} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: Math.min(i, 10) * 0.03 }}>
                  <Link to={href(n)} onClick={onClose} className={cn('flex gap-3 items-start px-3 py-3 rounded-[14px] hover:bg-latte/[0.07] transition-colors', n.unread && 'bg-latte/[0.05]')}>
                    <span className="relative shrink-0">
                      <Avatar username={n.actor} size="w-10 h-10 text-base" />
                      <span className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-accent-red text-white flex items-center justify-center"><Icon className="w-3 h-3" /></span>
                    </span>
                    <span className="flex-1 min-w-0 text-[13px] leading-[1.4]">
                      <b className="font-semibold">@{n.actor}</b> {text(n)}
                      {n.snippet && <span className="block opacity-60 mt-0.5 line-clamp-2">“{n.snippet}”</span>}
                      <span className="block text-[11px] opacity-50 mt-1">{timeAgo(n.ts)}</span>
                    </span>
                    {n.unread && <span className="w-2 h-2 rounded-full bg-accent-red mt-2 shrink-0" />}
                  </Link>
                </motion.div>
              );
            })}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

// ---------------------------------------------------------------------
// Send a book to a friend (as a direct message)
// ---------------------------------------------------------------------
export const ShareToFriend = ({ open, onClose, book }) => {
  const navigate = useNavigate();
  const [contacts, setContacts] = useState(null);
  const [q, setQ] = useState('');
  const [note, setNote] = useState('');
  const [sent, setSent] = useState({});
  useEffect(() => {
    if (open) { setSent({}); setNote(''); getContacts().then(setContacts).catch(() => setContacts([])); }
  }, [open]);
  const send = async (u) => {
    setSent((s) => ({ ...s, [u]: 'sending' }));
    try { await sendMessage(u, note, book.book_id); setSent((s) => ({ ...s, [u]: 'sent' })); } catch { setSent((s) => ({ ...s, [u]: 'error' })); }
  };
  const shown = (contacts || []).filter((c) => c.username.toLowerCase().includes(q.toLowerCase()));

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-[140] bg-roast/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
          <motion.div
            className="w-full sm:max-w-md rounded-t-[26px] sm:rounded-[26px] bg-bg-base p-6 max-h-[85vh] flex flex-col"
            initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 60, opacity: 0 }} transition={{ duration: 0.45, ease: EASE }}
            onClick={(e) => e.stopPropagation()}
            data-lenis-prevent
          >
            <div className="flex items-start gap-4">
              <div className="w-14 aspect-[2/3] rounded-[3px] overflow-hidden shadow-cover shrink-0"><CoverImage book={book} /></div>
              <div className="flex-1 min-w-0">
                <p className="label">Send to a friend</p>
                <p className="font-serif text-2xl leading-tight line-clamp-2">{book.title}</p>
              </div>
              <button onClick={onClose} aria-label="Close" className="w-9 h-9 rounded-full border border-border flex items-center justify-center"><X className="w-4 h-4" /></button>
            </div>
            <input value={note} onChange={(e) => setNote(e.target.value.slice(0, 300))} placeholder="Add a note (optional)…" className="mt-5 h-11 rounded-full border border-border bg-surface-white px-4 text-[14px] outline-none focus:border-text-main" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search people…" className="mt-2 h-10 bg-transparent border-b border-border px-1 text-[13px] outline-none focus:border-text-main" />
            <div className="mt-3 flex-1 overflow-y-auto -mx-2">
              {contacts === null && <p className="label p-3">Loading…</p>}
              {contacts?.length === 0 && <p className="text-[13px] text-text-muted p-3">Follow someone first. You can message people you follow or who follow you.</p>}
              {shown.map((c) => (
                <div key={c.username} className="flex items-center gap-3 px-2 py-2 rounded-[12px] hover:bg-text-main/[0.04]">
                  <span className="relative"><Avatar username={c.username} size="w-10 h-10 text-base" /><OnlineDot on={c.online} /></span>
                  <span className="flex-1 text-[14px] font-medium">@{c.username}</span>
                  <button
                    onClick={() => (sent[c.username] === 'sent' ? navigate(`/messages/${c.username}`) : send(c.username))}
                    disabled={sent[c.username] === 'sending'}
                    className={cn('h-9 px-4 rounded-full text-[12px] font-medium transition-colors flex items-center gap-1.5', sent[c.username] === 'sent' ? 'bg-text-main text-bg-base' : 'bg-accent-red text-white hover:bg-text-main')}
                  >
                    {sent[c.username] === 'sent' ? 'Sent · open' : sent[c.username] === 'error' ? 'Retry' : <><Send className="w-3.5 h-3.5" /> Send</>}
                  </button>
                </div>
              ))}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
