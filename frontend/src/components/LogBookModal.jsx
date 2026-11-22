import React, { useEffect, useState } from 'react';
import { Heart } from 'lucide-react';
import NeoButton, { cn } from './NeoButton';
import { ErrorBox, Field, Input, Modal, StarInput, TextArea } from './ui';
import { errorMessage, logBook, updateEntry } from '../services/api';

const today = () => new Date().toISOString().slice(0, 10);

/**
 * Log a book (new diary entry) or edit an existing entry.
 * Props: book {book_id, title}, entry (optional, to edit), onSaved(entry)
 */
const LogBookModal = ({ open, onClose, book, entry, onSaved }) => {
  const [rating, setRating] = useState(null);
  const [review, setReview] = useState('');
  const [dateRead, setDateRead] = useState(today());
  const [liked, setLiked] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!open) return;
    setRating(entry?.rating ?? null);
    setReview(entry?.review_text ?? '');
    setDateRead(entry?.date_read ?? today());
    setLiked(entry?.is_liked ?? false);
    setError(null);
  }, [open, entry]);

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const fields = { rating, review_text: review || null, date_read: dateRead || null, is_liked: liked };
      const saved = entry
        ? await updateEntry(entry.entry_id, fields)
        : await logBook({ book_id: book.book_id, ...fields });
      onSaved?.(saved);
      onClose();
    } catch (err) {
      setError(errorMessage(err, 'Could not save'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={entry ? `Edit entry: ${book?.title}` : `Log: ${book?.title}`}>
      <ErrorBox>{error}</ErrorBox>
      <Field label="Rating">
        <StarInput value={rating} onChange={setRating} />
      </Field>
      <div className="flex flex-wrap items-end gap-4 mb-4">
        <Field label="Date read">
          <Input type="date" value={dateRead || ''} max={today()} onChange={(e) => setDateRead(e.target.value)} />
        </Field>
        <button
          type="button"
          onClick={() => setLiked(!liked)}
          aria-pressed={liked}
          className={cn(
            'mb-4 flex items-center gap-2 px-4 py-3 border border-border font-medium',
            liked ? 'bg-accent-red text-white' : 'bg-surface-white'
          )}
        >
          <Heart className={cn('w-5 h-5', liked && 'fill-current')} /> {liked ? 'Liked' : 'Like'}
        </button>
      </div>
      <Field label="Review (optional)">
        <TextArea value={review} onChange={(e) => setReview(e.target.value)} placeholder="What did you think?" maxLength={10000} />
      </Field>
      <div className="flex justify-end gap-3">
        <NeoButton variant="white" onClick={onClose}>Cancel</NeoButton>
        <NeoButton variant="primary" onClick={save} disabled={saving}>
          {saving ? 'Saving…' : entry ? 'Save changes' : 'Log book'}
        </NeoButton>
      </div>
    </Modal>
  );
};

export default LogBookModal;
