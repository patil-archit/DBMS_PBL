import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Heart, Pencil, Trash2 } from 'lucide-react';
import LogBookModal from './LogBookModal';
import { Cover, Empty, Stars, formatDate } from './ui';
import { deleteEntry } from '../services/api';

const monthKey = (e) => {
  const d = new Date(e.date_read ? `${e.date_read}T00:00:00` : e.created_at);
  return d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
};

/** Diary entries grouped by month. editable: show edit/delete controls. */
const DiaryList = ({ entries, editable = false, onChanged, emptyText = 'No books logged yet.' }) => {
  const [editing, setEditing] = useState(null);

  if (!entries?.length) return <Empty title="Empty diary">{emptyText}</Empty>;

  const groups = [];
  entries.forEach((e) => {
    const key = monthKey(e);
    if (!groups.length || groups[groups.length - 1].key !== key) groups.push({ key, items: [] });
    groups[groups.length - 1].items.push(e);
  });

  const remove = async (e) => {
    if (!window.confirm(`Delete your entry for “${e.title}”?`)) return;
    await deleteEntry(e.entry_id);
    onChanged?.();
  };

  return (
    <div className="space-y-8">
      {groups.map((g) => (
        <section key={g.key}>
          <h3 className="font-serif text-3xl mb-4 border-t border-border pt-3">{g.key}</h3>
          <ul className="space-y-3">
            {g.items.map((e) => (
              <li key={e.entry_id} className="flex gap-4 bg-surface-white border border-border p-3">
                <Cover book={e} />
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <Link to={`/book/${encodeURIComponent(e.title)}`} className="font-medium text-lg hover:text-accent-red truncate">
                      {e.title}
                    </Link>
                    <span className="text-sm font-medium text-text-muted">{formatDate(e.date_read)}</span>
                  </div>
                  <p className="text-sm text-text-muted uppercase font-medium truncate">{e.authors?.join(', ')}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <Stars value={e.rating} />
                    {e.is_liked && <Heart className="w-4 h-4 text-accent-red fill-accent-red" aria-label="Liked" />}
                  </div>
                  {e.review_text && <p className="mt-1 font-medium line-clamp-2 break-words">“{e.review_text}”</p>}
                </div>
                {editable && (
                  <div className="flex flex-col gap-2">
                    <button aria-label="Edit entry" onClick={() => setEditing(e)} className="p-1 hover:text-accent-teal">
                      <Pencil className="w-5 h-5" />
                    </button>
                    <button aria-label="Delete entry" onClick={() => remove(e)} className="p-1 hover:text-accent-red">
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}
      <LogBookModal open={!!editing} onClose={() => setEditing(null)} book={editing} entry={editing} onSaved={onChanged} />
    </div>
  );
};

export default DiaryList;
