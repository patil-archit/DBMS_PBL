import React, { useEffect, useRef, useState } from 'react';
import { Bot, Loader2, MessageSquarePlus, Send, Trash2 } from 'lucide-react';
import NeoButton, { cn } from '../components/NeoButton';
import BookCard from '../components/BookCard';
import { ErrorBox, Page, PageTitle, Spinner, timeAgo } from '../components/ui';
import { useAuth } from '../contexts/AuthContext';
import { deleteChatSession, errorMessage, getChatSession, getChatSessions, sendChatMessage } from '../services/api';

const EXAMPLES = [
  'A dark fantasy under 400 pages',
  'Something like Dune but shorter',
  'Cosy mysteries rated 4+',
  'A classic I haven\'t read yet',
];

// Render **bold** titles from the bot's reply
const renderReply = (text) =>
  text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith('**') ? <strong key={i}>{part.slice(2, -2)}</strong> : <React.Fragment key={i}>{part}</React.Fragment>
  );

const ChatPage = () => {
  const { me, loginWithGoogle, loading: authLoading } = useAuth();
  const [sessions, setSessions] = useState([]);
  const [sessionId, setSessionId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const bottom = useRef(null);

  useEffect(() => {
    if (me) getChatSessions().then(setSessions).catch((e) => setError(errorMessage(e)));
  }, [me]);

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, sending]);

  const open = async (id) => {
    setError(null);
    const s = await getChatSession(id);
    setSessionId(id);
    setMessages(s.messages);
  };

  const newChat = () => {
    setSessionId(null);
    setMessages([]);
    setError(null);
  };

  const send = async (text) => {
    const content = (text ?? input).trim();
    if (!content || sending) return;
    setInput('');
    setError(null);
    setMessages((m) => [...m, { role: 'user', content }]);
    setSending(true);
    try {
      const r = await sendChatMessage(content, sessionId);
      setMessages((m) => [...m, { role: 'assistant', content: r.reply, books: r.books }]);
      if (!sessionId) {
        setSessionId(r.session_id);
        setSessions((s) => [{ session_id: r.session_id, title: r.title, updated_at: new Date().toISOString() }, ...s]);
      }
    } catch (e) {
      setError(errorMessage(e, 'The assistant is unavailable right now.'));
      setMessages((m) => m.slice(0, -1));
      setInput(content);
    } finally {
      setSending(false);
    }
  };

  const remove = async (id) => {
    await deleteChatSession(id);
    setSessions((s) => s.filter((x) => x.session_id !== id));
    if (id === sessionId) newChat();
  };

  if (authLoading) return <Spinner />;
  if (!me) {
    return (
      <Page className="text-center">
        <PageTitle>Book assistant</PageTitle>
        <NeoButton variant="primary" onClick={loginWithGoogle}>Sign in to chat</NeoButton>
      </Page>
    );
  }

  return (
    <Page>
      <PageTitle mark=">" color="text-accent-teal">Book assistant</PageTitle>
      <div className="grid md:grid-cols-[260px_1fr] gap-6">
        <aside className="space-y-3">
          <NeoButton fullWidth variant="navy" onClick={newChat}><MessageSquarePlus className="w-4 h-4 mr-2" /> New chat</NeoButton>
          <ul className="space-y-2 max-h-[60vh] overflow-y-auto">
            {sessions.map((s) => (
              <li key={s.session_id} className={cn('flex items-center border-[3px] border-border', s.session_id === sessionId ? 'bg-accent-teal text-white' : 'bg-surface-white')}>
                <button onClick={() => open(s.session_id)} className="flex-1 text-left px-3 py-2 min-w-0">
                  <span className="block font-bold truncate">{s.title}</span>
                  <span className="block text-xs opacity-80">{timeAgo(s.updated_at)}</span>
                </button>
                <button aria-label="Delete conversation" onClick={() => remove(s.session_id)} className="px-2 hover:text-accent-red"><Trash2 className="w-4 h-4" /></button>
              </li>
            ))}
          </ul>
          <p className="text-xs text-text-muted font-medium">Conversations are saved so you can continue them later.</p>
        </aside>

        <section className="bg-surface-white border-[3px] border-border shadow-brutal flex flex-col h-[78vh] min-w-0">
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 && (
              <div className="text-center py-10">
                <Bot className="w-14 h-14 mx-auto mb-3 text-accent-teal" />
                <p className="font-bold text-lg mb-1">Ask for books in plain words.</p>
                <p className="text-text-muted font-medium mb-5">Every suggestion comes from the BookLog catalogue.</p>
                <div className="flex flex-wrap justify-center gap-2">
                  {EXAMPLES.map((ex) => (
                    <button key={ex} onClick={() => send(ex)} className="px-3 py-1.5 border-2 border-border bg-bg-base font-bold text-sm hover:bg-accent-blue/30">
                      {ex}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={cn('flex flex-col', m.role === 'user' ? 'items-end' : 'items-start')}>
                <div className={cn('max-w-[90%] border-[3px] border-border p-3', m.role === 'user' ? 'bg-accent-navy text-white' : 'bg-bg-base')}>
                  <p className="whitespace-pre-wrap font-medium break-words">{m.role === 'assistant' ? renderReply(m.content) : m.content}</p>
                </div>
                {m.books?.length > 0 && (
                  <div className="mt-4 w-full grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {m.books.map((b, j) => (
                      <BookCard key={b.book_id} book={b} source="chatbot" colorScheme={['white', 'teal', 'blue', 'red'][j % 4]} />
                    ))}
                  </div>
                )}
              </div>
            ))}
            {sending && <div className="flex items-center gap-2 font-bold text-text-muted"><Loader2 className="w-4 h-4 animate-spin" /> Searching the catalogue…</div>}
            <div ref={bottom} />
          </div>
          <div className="border-t-[3px] border-border p-3">
            <ErrorBox>{error}</ErrorBox>
            <form onSubmit={(e) => { e.preventDefault(); send(); }} className="flex gap-2">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="e.g. a short sci-fi book about AI"
                maxLength={2000}
                className="flex-1 min-w-0 px-4 py-3 border-[3px] border-border font-medium focus:outline-none"
              />
              <NeoButton type="submit" variant="primary" disabled={sending || !input.trim()} aria-label="Send"><Send className="w-5 h-5" /></NeoButton>
            </form>
          </div>
        </section>
      </div>
    </Page>
  );
};

export default ChatPage;
