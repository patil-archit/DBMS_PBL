import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import BookCard from '../components/BookCard';
import DiaryList from '../components/DiaryList';
import GoalWidget from '../components/GoalWidget';
import ListCard from '../components/ListCard';
import NeoButton from '../components/NeoButton';
import { Empty, Page, PageTitle, Spinner, Tabs } from '../components/ui';
import { getMyLists, getUserDiary, getUserFollowedAuthors, getUserShelves } from '../services/api';
import SignInGate from '../components/SignInGate';

const MyLibraryPage = () => {
  const { currentUser, me, loading: authLoading } = useAuth();
  const [tab, setTab] = useState('diary');
  const [diary, setDiary] = useState(null);
  const [shelves, setShelves] = useState({ want_to_read: [], currently_reading: [] });
  const [lists, setLists] = useState([]);
  const [authors, setAuthors] = useState([]);

  const load = useCallback(async () => {
    if (!me) return;
    const [d, s, l, a] = await Promise.all([
      getUserDiary(me.username), getUserShelves(me.username), getMyLists(), getUserFollowedAuthors(),
    ]);
    setDiary(d);
    setShelves(s);
    setLists(l);
    setAuthors(a);
  }, [me]);

  useEffect(() => {
    load().catch(console.error);
  }, [load]);

  if (authLoading) return <Spinner />;

  if (!currentUser) {
    return <SignInGate animal="bear" title="Your reading diary" text="Log books with ratings and reviews, keep shelves, make lists and set a yearly reading goal." prop="glasses" seed={22} />;
  }

  if (!diary) return <Spinner label="Loading your books…" />;

  const books = (items) =>
    items.length ? (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-6">
        {items.map((b, i) => <BookCard key={b.book_id} book={b} colorScheme={['white', 'teal', 'blue', 'red'][i % 4]} />)}
      </div>
    ) : (
      <Empty title="Nothing here yet">Use the shelf buttons on any book page.</Empty>
    );

  return (
    <Page>
      <PageTitle animal="rabbit" prop="bow"
        kicker="( Library ) your diary, shelves and lists"
        right={me && (
          <div className="flex flex-col items-end gap-1">
            <Link to={`/u/${me.username}/stats`} className="label !text-text-main link-under">Your year in books</Link>
            <Link to={`/u/${me.username}`} className="label link-under">View public profile</Link>
          </div>
        )}
      >
        My Books
      </PageTitle>

      <div className="grid lg:grid-cols-[1fr_320px] gap-10">
        <div className="min-w-0">
          <Tabs
            active={tab}
            onChange={setTab}
            tabs={[
              { id: 'diary', label: 'Diary', count: diary.length },
              { id: 'reading', label: 'Reading now', count: shelves.currently_reading.length },
              { id: 'want', label: 'Want to read', count: shelves.want_to_read.length },
              { id: 'lists', label: 'Lists', count: lists.length },
              { id: 'authors', label: 'Authors', count: authors.length },
            ]}
          />
          {tab === 'diary' && <DiaryList entries={diary} editable onChanged={load} emptyText="Open any book and press “Log / Review”." />}
          {tab === 'reading' && books(shelves.currently_reading)}
          {tab === 'want' && books(shelves.want_to_read)}
          {tab === 'lists' && (
            <>
              <div className="mb-6">
                <Link to="/lists/new"><NeoButton variant="navy" size="sm"><Plus className="w-4 h-4 mr-1" /> New list</NeoButton></Link>
              </div>
              {lists.length ? (
                <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-6">{lists.map((l) => <ListCard key={l.list_id} list={l} />)}</div>
              ) : (
                <Empty title="No lists yet">Create one, or use “Add to list” on a book page.</Empty>
              )}
            </>
          )}
          {tab === 'authors' && (
            authors.length ? (
              <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-6">
                {authors.map((a) => (
                  <Link key={a.name} to={`/author/${encodeURIComponent(a.name)}`} className="flex items-center gap-4 bg-surface-white border border-border p-4">
                    {a.image_url ? (
                      <img src={a.image_url} alt={a.name} className="w-16 h-16 object-cover border border-border" />
                    ) : (
                      <div className="w-16 h-16 bg-accent-blue border border-border" />
                    )}
                    <div>
                      <p className="font-medium text-lg">{a.name}</p>
                      <p className="label text-text-muted">{a.book_count} books</p>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <Empty title="No followed authors">Follow authors from their author page.</Empty>
            )
          )}
        </div>
        <aside className="space-y-6">
          <GoalWidget />
        </aside>
      </div>
    </Page>
  );
};

export default MyLibraryPage;
