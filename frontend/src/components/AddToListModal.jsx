import React, { useEffect, useState } from 'react';
import { Check, Lock, Plus } from 'lucide-react';
import NeoButton from './NeoButton';
import { ErrorBox, Input, Modal, Spinner, Toggle } from './ui';
import { addToList, createList, errorMessage, getMyLists, removeFromList } from '../services/api';

const AddToListModal = ({ open, onClose, book }) => {
  const [lists, setLists] = useState(null);
  const [name, setName] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!open || !book) return;
    setLists(null);
    setError(null);
    getMyLists(book.book_id).then(setLists).catch((e) => setError(errorMessage(e)));
  }, [open, book]);

  const toggle = async (list) => {
    setBusy(list.list_id);
    try {
      if (list.has_book) await removeFromList(list.list_id, book.book_id);
      else await addToList(list.list_id, book.book_id);
      setLists((ls) => ls.map((l) => (l.list_id === list.list_id ? { ...l, has_book: !l.has_book } : l)));
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  const create = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy('new');
    try {
      const created = await createList({ name, is_public: isPublic, book_ids: [book.book_id] });
      setLists((ls) => [{ ...created, has_book: true }, ...(ls || [])]);
      setName('');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={`Add “${book?.title}” to a list`}>
      <ErrorBox>{error}</ErrorBox>
      <form onSubmit={create} className="mb-6 border border-border bg-surface-white p-4">
        <p className="font-medium mb-2">New list</p>
        <div className="flex gap-2 mb-3">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Best of 2026" maxLength={200} />
          <NeoButton type="submit" variant="navy" size="sm" disabled={busy === 'new' || !name.trim()}>
            <Plus className="w-5 h-5" />
          </NeoButton>
        </div>
        <Toggle checked={isPublic} onChange={setIsPublic} label="Public list" />
      </form>
      {lists === null ? (
        <Spinner />
      ) : lists.length === 0 ? (
        <p className="text-text-muted font-medium">You have no lists yet.</p>
      ) : (
        <ul className="space-y-2">
          {lists.map((l) => (
            <li key={l.list_id}>
              <button
                onClick={() => toggle(l)}
                disabled={busy === l.list_id}
                className="w-full flex items-center justify-between gap-3 px-4 py-3 border border-border bg-surface-white hover:bg-bg-base font-medium text-left"
              >
                <span className="flex items-center gap-2 min-w-0">
                  {!l.is_public && <Lock className="w-4 h-4 flex-shrink-0" />}
                  <span className="truncate">{l.name}</span>
                  <span className="font-pixel text-text-muted">{l.book_count}</span>
                </span>
                {l.has_book ? <Check className="w-5 h-5 text-accent-teal" /> : <Plus className="w-5 h-5" />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
};

export default AddToListModal;
