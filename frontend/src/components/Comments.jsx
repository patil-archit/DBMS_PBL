import React, { useEffect, useState } from 'react';
import { Trash2 } from 'lucide-react';
import NeoButton from './NeoButton';
import { Avatar, ErrorBox, TextArea, UserLink, timeAgo } from './ui';
import { useAuth } from '../contexts/AuthContext';
import { deleteComment, errorMessage } from '../services/api';

/** Comment thread. load() -> comments, post(text) -> comment */
const Comments = ({ load, post, onCountChange }) => {
  const { me, isStaff, loginWithGoogle } = useAuth();
  const [comments, setComments] = useState(null);
  const [text, setText] = useState('');
  const [error, setError] = useState(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    load().then(setComments).catch((e) => setError(errorMessage(e)));
  }, [load]);

  const submit = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    setSending(true);
    try {
      const c = await post(text);
      const next = [...(comments || []), c];
      setComments(next);
      onCountChange?.(next.length);
      setText('');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSending(false);
    }
  };

  const remove = async (id) => {
    await deleteComment(id);
    const next = comments.filter((c) => c.comment_id !== id);
    setComments(next);
    onCountChange?.(next.length);
  };

  return (
    <div className="border-t border-border pt-4 mt-4">
      <ErrorBox>{error}</ErrorBox>
      {comments?.length === 0 && <p className="text-text-muted text-sm mb-3">No comments yet.</p>}
      <ul className="space-y-3 mb-4">
        {comments?.map((c) => (
          <li key={c.comment_id} className="flex gap-3">
            <Avatar username={c.username} size="w-8 h-8 text-sm" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 text-sm">
                <UserLink username={c.username} />
                <span className="text-text-muted">{timeAgo(c.created_at)}</span>
                {(me?.user_id === c.user_id || isStaff) && (
                  <button onClick={() => remove(c.comment_id)} aria-label="Delete comment" className="ml-auto text-text-muted hover:text-accent-red">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
              <p className="font-medium whitespace-pre-wrap break-words">{c.comment_text}</p>
            </div>
          </li>
        ))}
      </ul>
      {me ? (
        <form onSubmit={submit} className="flex flex-col sm:flex-row gap-2">
          <TextArea rows={2} value={text} onChange={(e) => setText(e.target.value)} placeholder="Add a comment…" maxLength={2000} />
          <NeoButton type="submit" variant="navy" size="sm" disabled={sending || !text.trim()}>Post</NeoButton>
        </form>
      ) : (
        <button onClick={loginWithGoogle} className="font-medium underline">Sign in to comment</button>
      )}
    </div>
  );
};

export default Comments;
