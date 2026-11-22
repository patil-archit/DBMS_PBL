import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Lock } from 'lucide-react';
import BookCard from '../components/BookCard';
import DiaryList from '../components/DiaryList';
import FollowButton from '../components/FollowButton';
import GoalWidget from '../components/GoalWidget';
import ListCard from '../components/ListCard';
import { Avatar, Card, Empty, Page, Spinner, Tabs, formatDate } from '../components/ui';
import { useAuth } from '../contexts/AuthContext';
import { getProfile, getUserDiary, getUserGoal, getUserLists, getUserShelves } from '../services/api';

const Stat = ({ n, label }) => (
  <div className="px-5 first:pl-0">
    <div className="display-num text-4xl tabular-nums">{n}</div>
    <div className="label mt-1">{label}</div>
  </div>
);

const ProfilePage = () => {
  const { username } = useParams();
  const { me, loading: authLoading } = useAuth();
  const [profile, setProfile] = useState(null);
  const [diary, setDiary] = useState([]);
  const [shelves, setShelves] = useState({ want_to_read: [], currently_reading: [] });
  const [lists, setLists] = useState([]);
  const [goal, setGoal] = useState(null);
  const [tab, setTab] = useState('diary');
  const [error, setError] = useState(null);

  useEffect(() => {
    if (authLoading) return;
    setProfile(null);
    setError(null);
    Promise.all([getProfile(username), getUserDiary(username), getUserShelves(username), getUserLists(username), getUserGoal(username)])
      .then(([p, d, s, l, g]) => {
        setProfile(p);
        setDiary(d);
        setShelves(s);
        setLists(l);
        setGoal(g);
      })
      .catch(() => setError('User not found'));
  }, [username, authLoading, me]);

  if (error) return <Page><Empty title={error} /></Page>;
  if (!profile) return <Spinner />;

  const net = profile.network;

  return (
    <Page>
      <header className="flex flex-col md:flex-row md:items-center gap-6 mb-10 border-b border-border pb-8">
        <Avatar username={profile.username} size="w-24 h-24 text-5xl" />
        <div className="flex-1 min-w-0">
          <h1 className="font-wide font-medium text-[clamp(2rem,5vw,4.5rem)] leading-none tracking-[-0.02em] break-words flex items-center gap-3">
            @{profile.username}
            {profile.is_private && <Lock className="w-7 h-7" aria-label="Private diary" />}
          </h1>
          {profile.role !== 'reader' && <span className="inline-block mt-3 label !text-bg-base bg-text-main rounded-full px-2.5 py-0.5 uppercase">{profile.role}</span>}
          {profile.bio && <p className="font-serif text-[1.4rem] leading-snug mt-4 whitespace-pre-wrap max-w-2xl">{profile.bio}</p>}
          <p className="label mt-3">
            Joined {formatDate(profile.created_at)}{profile.follows_you && ' · Follows you'}
          </p>
        </div>
        <div className="flex flex-col items-start md:items-end gap-3">
          {!profile.diary_hidden && (
            <Link to={`/u/${profile.username}/stats`} className="label !text-text-main link-under">Year in books →</Link>
          )}
          {profile.is_me ? (
            <Link to="/settings" className="label link-under">Edit profile</Link>
          ) : (
            <FollowButton username={profile.username} following={profile.is_following} size="md" />
          )}
        </div>
      </header>

      <div className="grid lg:grid-cols-[1fr_320px] gap-10">
        <div className="min-w-0">
          <div className="flex flex-wrap divide-x divide-border border-y border-border py-4 mb-10">
            <Stat n={profile.books} label="Books" />
            <Stat n={profile.reviews} label="Reviews" />
            <Stat n={profile.lists} label="Lists" />
            <Stat n={profile.followers} label="Followers" />
            <Stat n={profile.following} label="Following" />
          </div>

          {profile.diary_hidden ? (
            <Empty title="This diary is private">
              <Lock className="inline w-5 h-5 mr-1" /> Only @{profile.username} can see their diary and shelves.
            </Empty>
          ) : (
            <>
              <Tabs
                active={tab}
                onChange={setTab}
                tabs={[
                  { id: 'diary', label: 'Diary', count: diary.length },
                  { id: 'reading', label: 'Reading', count: shelves.currently_reading.length },
                  { id: 'want', label: 'Want to read', count: shelves.want_to_read.length },
                  { id: 'lists', label: 'Lists', count: lists.length },
                ]}
              />
              {tab === 'diary' && <DiaryList entries={diary} />}
              {(tab === 'reading' || tab === 'want') && (() => {
                const items = tab === 'reading' ? shelves.currently_reading : shelves.want_to_read;
                return items.length ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-6">{items.map((b) => <BookCard key={b.book_id} book={b} />)}</div>
                ) : <Empty title="Empty shelf" />;
              })()}
              {tab === 'lists' && (lists.length ? (
                <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-6">{lists.map((l) => <ListCard key={l.list_id} list={l} />)}</div>
              ) : <Empty title="No lists" />)}
            </>
          )}
        </div>

        <aside className="space-y-6">
          {net && (
            <Card className="bg-text-main text-bg-base border-0">
              <p className="text-[11px] opacity-60 mb-3">( You &amp; @{profile.username} )</p>
              <p className="text-[15px]">
                {net.steps == null ? 'Not connected yet' : net.steps === 1 ? 'Directly connected' : `${net.steps} steps apart`}
              </p>
              {net.match_percent != null && (
                <>
                  <p className="display-num text-7xl mt-4">{net.match_percent}<span className="text-3xl">%</span></p>
                  <p className="font-medium">taste match{net.shared_books ? ` · ${net.shared_books} book${net.shared_books === 1 ? '' : 's'} in common` : ' · no books in common yet'}</p>
                </>
              )}
              <p className="text-[11px] mt-4 opacity-60">Computed with {net.source === 'neo4j' ? 'Neo4j' : 'PostgreSQL'}.</p>
            </Card>
          )}
          {goal && <GoalWidget goal={goal} readOnly />}
        </aside>
      </div>
    </Page>
  );
};

export default ProfilePage;
