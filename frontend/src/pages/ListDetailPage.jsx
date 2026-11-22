import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowDown, ArrowUp, Heart, Lock, MessageSquare, Pencil, Trash2, X } from 'lucide-react';
import NeoButton, { cn } from '../components/NeoButton';
import Comments from '../components/Comments';
import {
  Cover, Empty, ErrorBox, Field, Input, Modal, Page, Spinner, TextArea, Toggle, UserLink, timeAgo,
} from '../components/ui';
import { useAuth } from '../contexts/AuthContext';
import {
  commentList, deleteList, errorMessage, getList, getListComments, likeList, removeFromList, reorderList, updateList,
} from '../services/api';

const ListDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { me, loginWithGoogle, loading: authLoading } = useAuth();
  const [list, setList] = useState(null);
  const [error, setError] = useState(null);
  const [editOpen, setEditOpen] = useState(false);
  const [form, setForm] = useState({});
  const [commentCount, setCommentCount] = useState(0);

  useEffect(() => {
    if (authLoading) return;
    getList(id)
      .then((l) => {
        setList(l);
        setCommentCount(l.comment_count);
      })
      .catch((e) => setError(errorMessage(e, 'List not found')));
  }, [id, authLoading, me]);

  const loadComments = useCallback(() => getListComments(id), [id]);
  const postComment = useCallback((text) => commentList(id, text), [id]);

  if (error) return <Page><Empty title="List not found">{error}</Empty></Page>;
  if (!list) return <Spinner />;

  const isOwner = me?.user_id === list.user_id;

  const move = async (index, dir) => {
    const ids = list.books.map((b) => b.book_id);
    const j = index + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[index], ids[j]] = [ids[j], ids[index]];
    setList(await reorderList(list.list_id, ids));
  };

  const remove = async (bookId) => setList(await removeFromList(list.list_id, bookId));

  const like = async () => {
    if (!me) return loginWithGoogle();
    const r = await likeList(list.list_id);
    setList({ ...list, liked_by_me: r.liked, like_count: r.like_count });
  };

  const saveEdit = async () => {
    try {
      setList(await updateList(list.list_id, form));
      setEditOpen(false);
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  const destroy = async () => {
    if (!window.confirm(`Delete the list “${list.name}”? This can't be undone.`)) return;
    await deleteList(list.list_id);
    navigate('/library');
  };

  return (
    <Page className="max-w-4xl">
      <header className="mb-8 border-b border-border pb-6">
        <p className="label text-text-muted flex items-center gap-2">
          {!list.is_public && <><Lock className="w-4 h-4" /> Private ·</>} List by <UserLink username={list.username} />
        </p>
        <h1 className="text-4xl md:text-5xl font-medium mt-2 break-words">{list.name}</h1>
        {list.description && <p className="text-lg font-medium mt-3 whitespace-pre-wrap">{list.description}</p>}
        <div className="flex flex-wrap items-center gap-3 mt-5">
          <button
            onClick={like}
            aria-pressed={list.liked_by_me}
            className={cn('flex items-center gap-2 px-4 py-2 border border-border font-medium', list.liked_by_me ? 'bg-accent-red text-white' : 'bg-surface-white')}
          >
            <Heart className={cn('w-4 h-4', list.liked_by_me && 'fill-current')} /> {list.like_count}
          </button>
          <span className="flex items-center gap-2 font-medium"><MessageSquare className="w-4 h-4" /> {commentCount}</span>
          <span className="text-text-muted font-medium">Updated {timeAgo(list.updated_at)}</span>
          {isOwner && (
            <span className="ml-auto flex gap-2">
              <NeoButton size="sm" variant="white" onClick={() => { setForm({ name: list.name, description: list.description || '', is_public: list.is_public }); setEditOpen(true); }}>
                <Pencil className="w-4 h-4 mr-1" /> Edit
              </NeoButton>
              <NeoButton size="sm" variant="primary" onClick={destroy}><Trash2 className="w-4 h-4 mr-1" /> Delete</NeoButton>
            </span>
          )}
        </div>
      </header>

      {list.books.length ? (
        <ol className="space-y-3 mb-12">
          {list.books.map((b, i) => (
            <li key={b.book_id} className="flex items-center gap-4 bg-surface-white border border-border p-3">
              <span className="display-num text-5xl w-14 text-accent-red tabular-nums flex-shrink-0">{String(b.position).padStart(2, '0')}</span>
              <Cover book={b} />
              <div className="flex-1 min-w-0">
                <Link to={`/book/${encodeURIComponent(b.title)}`} className="font-medium text-lg hover:text-accent-red line-clamp-2">{b.title}</Link>
                <p className="text-sm uppercase font-medium text-text-muted truncate">{b.authors?.join(', ')}</p>
              </div>
              {isOwner && (
                <div className="flex items-center gap-1">
                  <button aria-label="Move up" disabled={i === 0} onClick={() => move(i, -1)} className="p-1 disabled:opacity-30"><ArrowUp className="w-5 h-5" /></button>
                  <button aria-label="Move down" disabled={i === list.books.length - 1} onClick={() => move(i, 1)} className="p-1 disabled:opacity-30"><ArrowDown className="w-5 h-5" /></button>
                  <button aria-label="Remove from list" onClick={() => remove(b.book_id)} className="p-1 hover:text-accent-red"><X className="w-5 h-5" /></button>
                </div>
              )}
            </li>
          ))}
        </ol>
      ) : (
        <div className="mb-12"><Empty title="Empty list">{isOwner ? 'Add books with “Add to list” on any book page.' : 'No books yet.'}</Empty></div>
      )}

      <section className="bg-surface-white border border-border p-5">
        <h2 className="font-medium text-2xl">Comments</h2>
        <Comments load={loadComments} post={postComment} onCountChange={setCommentCount} />
      </section>

      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="Edit list">
        <ErrorBox>{error}</ErrorBox>
        <Field label="Name"><Input value={form.name || ''} onChange={(e) => setForm({ ...form, name: e.target.value })} maxLength={200} /></Field>
        <Field label="Description"><TextArea value={form.description || ''} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
        <div className="mb-6"><Toggle checked={form.is_public} onChange={(v) => setForm({ ...form, is_public: v })} label="Public" /></div>
        <div className="flex justify-end gap-3">
          <NeoButton variant="white" onClick={() => setEditOpen(false)}>Cancel</NeoButton>
          <NeoButton variant="primary" onClick={saveEdit} disabled={!form.name?.trim()}>Save</NeoButton>
        </div>
      </Modal>
    </Page>
  );
};

export default ListDetailPage;
