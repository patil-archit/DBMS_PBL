import React from 'react';
import { Link } from 'react-router-dom';
import { Heart, Lock, MessageSquare } from 'lucide-react';

/** Preview for a list: its first covers fanned out like a hand of cards, then name, owner and counts. */
const ListCard = ({ list }) => {
  const covers = (list.covers || []).slice(0, 4);
  return (
    <Link to={`/lists/${list.list_id}`} data-cursor="Open" className="group block">
      <div className="relative h-56 rounded-[28px] bg-surface-white overflow-hidden flex items-end justify-center pb-0">
        {covers.length === 0 && <span className="absolute inset-0 flex items-center justify-center font-serif text-3xl text-text-muted">Empty list</span>}
        {covers.map((c, i) => {
          const mid = (covers.length - 1) / 2;
          const off = i - mid;
          return (
            <img
              key={c + i}
              src={c}
              alt=""
              loading="lazy"
              className="absolute bottom-[-12%] w-[34%] aspect-[2/3] object-cover rounded-[3px] shadow-cover transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)]"
              style={{
                transform: `translateX(${off * 46}%) rotate(${off * 6}deg)`,
                zIndex: 10 - Math.abs(Math.round(off)),
                '--fan': `${off * 62}%`,
                '--rot': `${off * 10}deg`,
              }}
            />
          );
        })}
        <style>{'.group:hover img[style*="--fan"]{transform:translateX(var(--fan)) translateY(-8%) rotate(var(--rot)) !important}'}</style>
      </div>
      <div className="pt-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-display text-[28px] flex items-center gap-2">
            {!list.is_public && <Lock className="w-3.5 h-3.5 flex-shrink-0" aria-label="Private" />}
            <span className="line-clamp-2 group-hover:text-red-deep transition-colors">{list.name}</span>
          </h3>
          <p className="label mt-1">@{list.username} · {list.book_count} book{list.book_count === 1 ? '' : 's'}</p>
        </div>
        <div className="flex gap-3 label shrink-0 pt-0.5">
          <span className="flex items-center gap-1"><Heart className="w-3 h-3" /> {list.like_count}</span>
          <span className="flex items-center gap-1"><MessageSquare className="w-3 h-3" /> {list.comment_count}</span>
        </div>
      </div>
    </Link>
  );
};

export default ListCard;
