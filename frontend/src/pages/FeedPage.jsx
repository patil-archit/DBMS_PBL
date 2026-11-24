import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Heart, ListPlus } from 'lucide-react';
import { Avatar, Cover, Empty, Page, PageTitle, Spinner, Stars, UserLink, timeAgo } from '../components/ui';
import { useAuth } from '../contexts/AuthContext';
import { getFeed } from '../services/api';
import SignInGate from '../components/SignInGate';

const FeedPage = () => {
  const { currentUser, loading: authLoading } = useAuth();
  const [items, setItems] = useState(null);

  useEffect(() => {
    if (currentUser) getFeed().then(setItems).catch(() => setItems([]));
  }, [currentUser]);

  if (authLoading) return <Spinner />;
  if (!currentUser) {
    return <SignInGate animal="dog" title="Activity" text="See what the people you follow are reading, rating and reviewing." button="Sign in to see your feed" prop="cap" seed={31} />;
  }
  if (!items) return <Spinner label="Loading feed…" />;

  return (
    <Page className="max-w-3xl">
      <PageTitle animal="dog" kicker="( Feed ) what people you follow logged, rated and listed">Activity</PageTitle>
      {items.length === 0 ? (
        <Empty title="Quiet in here">
          Follow some readers on the <Link to="/people" className="underline font-medium">People</Link> page to see what they log, rate and list.
        </Empty>
      ) : (
        <ul className="space-y-4">
          {items.map((it, i) => (
            <li key={`${it.kind}-${it.entry_id || it.list_id}-${it.book_id}-${i}`} className="flex gap-4 bg-surface-white border border-border p-4">
              <Avatar username={it.username} />
              <div className="flex-1 min-w-0">
                <p className="font-medium">
                  <UserLink username={it.username} />{' '}
                  {it.kind === 'logged' ? (
                    <>
                      {it.review_text ? 'reviewed' : it.rating ? 'rated' : 'logged'}{' '}
                      <Link to={`/book/${encodeURIComponent(it.title)}`} className="font-medium hover:text-accent-red">{it.title}</Link>
                    </>
                  ) : (
                    <>
                      <ListPlus className="inline w-4 h-4" /> added{' '}
                      <Link to={`/book/${encodeURIComponent(it.title)}`} className="font-medium hover:text-accent-red">{it.title}</Link> to{' '}
                      <Link to={`/lists/${it.list_id}`} className="font-medium underline">{it.list_name}</Link>
                    </>
                  )}
                  <span className="text-text-muted text-sm ml-2">{timeAgo(it.ts)}</span>
                </p>
                {it.kind === 'logged' && (
                  <div className="flex items-center gap-2 mt-1">
                    <Stars value={it.rating} />
                    {it.is_liked && <Heart className="w-4 h-4 text-accent-red fill-accent-red" />}
                  </div>
                )}
                {it.review_text && <p className="mt-2 font-medium line-clamp-3 break-words">“{it.review_text}”</p>}
              </div>
              <Cover book={it} />
            </li>
          ))}
        </ul>
      )}
    </Page>
  );
};

export default FeedPage;
