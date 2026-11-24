import React, { useEffect, useRef, useState } from 'react';
import { Loader2, MessageSquarePlus, Send, Trash2 } from 'lucide-react';
import NeoButton, { cn } from '../components/NeoButton';
import BookCard from '../components/BookCard';
import { ErrorBox, Page, PageTitle, Spinner, timeAgo } from '../components/ui';
import { useAuth } from '../contexts/AuthContext';
import { deleteChatSession, errorMessage, getChatSession, getChatSessions, sendChatMessage } from '../services/api';
import SignInGate from '../components/SignInGate';

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
  const { me, loading: authLoading } = useAuth();
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
    return <SignInGate animal="fox" title="Ask for a book" text="Describe a mood, a plot or a book you loved. The assistant answers from the catalogue." button="Sign in to chat" prop="quill" seed={14} />;
  }

  return (
    <Page>
      <PageTitle animal="fox" prop="quill" kicker="( Assistant ) every suggestion comes from the catalogue">Ask for a book</PageTitle>
      <div className="grid md:grid-cols-[260px_1fr] gap-6">
        <aside className="space-y-3">
          <NeoButton fullWidth onClick={newChat}><MessageSquarePlus className="w-4 h-4 mr-2" /> New chat</NeoButton>
          <ul className="space-y-2 max-h-[60vh] overflow-y-auto">
            {sessions.map((s) => (
              <li key={s.session_id} className={cn('flex items-center rounded-[6px] transition-colors', s.session_id === sessionId ? 'bg-text-main text-bg-base' : 'hover:bg-surface-white')}>
                <button onClick={() => open(s.session_id)} className="flex-1 text-left px-3 py-2 min-w-0">
                  <span className="block text-[13px] truncate">{s.title}</span>
                  <span className="block text-[11px] opacity-60">{timeAgo(s.updated_at)}</span>
                </button>
                <button aria-label="Delete conversation" onClick={() => remove(s.session_id)} className="px-2 hover:text-accent-red"><Trash2 className="w-4 h-4" /></button>
              </li>
            ))}
          </ul>
          <p className="label">Conversations are saved in MongoDB so you can continue them later.</p>
        </aside>

        <section className="bg-surface-white rounded-[10px] flex flex-col h-[78vh] min-w-0 overflow-hidden">
          <div className="flex-1 overflow-y-auto p-5 md:p-8 space-y-8" data-lenis-prevent>
            {messages.length === 0 && (
              <div className="text-center py-10">
                <p className="font-serif text-[clamp(2rem,4vw,3.4rem)] leading-[1] mb-3">What do you <span className="text-accent-red">feel</span> like reading?</p>
                <p className="text-text-muted mb-8">Every suggestion comes from the BookLog catalogue, so nothing is made up.</p>
                <div className="flex flex-wrap justify-center gap-2">
                  {EXAMPLES.map((ex) => (
                    <button key={ex} onClick={() => send(ex)} className="h-10 px-4 rounded-full border border-border text-[13px] hover:bg-text-main hover:text-bg-base transition-colors">
                      {ex}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={cn('flex flex-col', m.role === 'user' ? 'items-end' : 'items-start')}>
                <span className="label mb-1.5">{m.role === 'user' ? 'You' : 'Assistant'}</span>
                <div className={cn('max-w-[90%]', m.role === 'user' ? 'bg-text-main text-bg-base rounded-[16px] rounded-br-[4px] px-4 py-2.5 text-[14px]' : 'font-serif text-[1.25rem] leading-[1.4]')}>
                  <p className="whitespace-pre-wrap break-words">{m.role === 'assistant' ? renderReply(m.content) : m.content}</p>
                </div>
                {m.books?.length > 0 && (
                  <div className="mt-6 w-full grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-5 gap-y-10">
                    {m.books.map((b, j) => (
                      <BookCard key={b.book_id} book={b} source="chatbot" colorScheme={['white', 'teal', 'blue', 'red'][j % 4]} />
                    ))}
                  </div>
                )}
              </div>
            ))}
            {sending && <div className="flex items-center gap-2 label"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Searching the catalogue…</div>}
            <div ref={bottom} />
          </div>
          <div className="border-t border-border p-3 md:p-4">
            <ErrorBox>{error}</ErrorBox>
            <form onSubmit={(e) => { e.preventDefault(); send(); }} className="flex gap-2">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="e.g. a short sci-fi book about AI"
                maxLength={2000}
                className="flex-1 min-w-0 px-5 h-12 rounded-full bg-bg-base text-[14px] focus:outline-none placeholder:text-text-muted"
              />
              <NeoButton type="submit" disabled={sending || !input.trim()} aria-label="Send" className="h-12 w-12 px-0"><Send className="w-4 h-4" /></NeoButton>
            </form>
          </div>
        </section>
      </div>
    </Page>
  );
};

export default ChatPage;
