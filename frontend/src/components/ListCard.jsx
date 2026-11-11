import React from 'react';
import { Link } from 'react-router-dom';
import { Heart, Lock, MessageSquare } from 'lucide-react';

/** Preview card for a list: stacked covers, name, owner, counts */
const ListCard = ({ list }) => (
  <Link
    to={`/lists/${list.list_id}`}
    className="block bg-surface-white border-[3px] border-border shadow-brutal hover:shadow-brutal-hover hover:translate-x-[2px] hover:translate-y-[2px] transition-all p-4"
  >
    <div className="flex h-28 mb-4 bg-bg-base border-2 border-border overflow-hidden">
      {(list.covers?.length ? list.covers : [null]).map((c, i) => (
        <div key={i} className="flex-1 border-r-2 border-border last:border-r-0">
          {c ? <img src={c} alt="" className="w-full h-full object-cover" loading="lazy" /> : null}
        </div>
      ))}
    </div>
    <h3 className="font-black text-xl leading-tight flex items-center gap-2">
      {!list.is_public && <Lock className="w-4 h-4 flex-shrink-0" aria-label="Private" />}
      <span className="line-clamp-2">{list.name}</span>
    </h3>
    <p className="text-sm font-bold text-text-muted mt-1">
      @{list.username} · {list.book_count} book{list.book_count === 1 ? '' : 's'}
    </p>
    <div className="flex gap-4 mt-2 text-sm font-bold">
      <span className="flex items-center gap-1"><Heart className="w-4 h-4" /> {list.like_count}</span>
      <span className="flex items-center gap-1"><MessageSquare className="w-4 h-4" /> {list.comment_count}</span>
    </div>
  </Link>
);

export default ListCard;
