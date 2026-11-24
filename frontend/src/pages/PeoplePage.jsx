import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ForceGraph2D from 'react-force-graph-2d';
import { Search } from 'lucide-react';
import FollowButton from '../components/FollowButton';
import NeoButton from '../components/NeoButton';
import { Avatar, Card, Empty, Input, Page, PageTitle, SectionTitle, Spinner, Tabs, UserLink } from '../components/ui';
import { useAuth } from '../contexts/AuthContext';
import { getFollowers, getFollowing, getSuggestions, searchPeople } from '../services/api';
import SignInGate from '../components/SignInGate';

const PersonRow = ({ p, extra }) => (
  <li className="flex items-center gap-3 bg-surface-white border border-border p-3">
    <Avatar username={p.username} />
    <div className="flex-1 min-w-0">
      <UserLink username={p.username} />
      {extra && <p className="text-sm text-text-muted font-medium">{extra}</p>}
      {p.bio && <p className="text-sm text-text-muted truncate">{p.bio}</p>}
    </div>
    <FollowButton username={p.username} following={p.is_following} />
  </li>
);

const NetworkGraph = ({ me, following, followers }) => {
  const navigate = useNavigate();
  const box = useRef(null);
  const [width, setWidth] = useState(600);

  useEffect(() => {
    const update = () => box.current && setWidth(box.current.clientWidth);
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  const data = useMemo(() => {
    const nodes = new Map([[me, { id: me, me: true }]]);
    const links = [];
    following.forEach((u) => { nodes.set(u.username, { id: u.username }); links.push({ source: me, target: u.username }); });
    followers.forEach((u) => { nodes.set(u.username, nodes.get(u.username) || { id: u.username }); links.push({ source: u.username, target: me }); });
    return { nodes: [...nodes.values()], links };
  }, [me, following, followers]);

  return (
    <div ref={box} className="border border-border bg-bg-base h-80 overflow-hidden">
      <ForceGraph2D
        graphData={data}
        width={width}
        height={314}
        linkDirectionalArrowLength={5}
        linkDirectionalArrowRelPos={1}
        linkColor={() => '#2B1B14'}
        onNodeClick={(n) => !n.me && navigate(`/u/${n.id}`)}
        nodeCanvasObject={(node, ctx, scale) => {
          const label = `@${node.id}`;
          const size = 13 / scale;
          ctx.font = `bold ${size}px Space Grotesk, sans-serif`;
          const w = ctx.measureText(label).width + size;
          const h = size * 1.6;
          ctx.fillStyle = node.me ? '#DF6A61' : '#4B9F9F';
          ctx.fillRect(node.x - w / 2, node.y - h / 2, w, h);
          ctx.strokeStyle = '#2B1B14';
          ctx.lineWidth = 2 / scale;
          ctx.strokeRect(node.x - w / 2, node.y - h / 2, w, h);
          ctx.fillStyle = '#fff';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(label, node.x, node.y);
        }}
      />
    </div>
  );
};

const PeoplePage = () => {
  const { me, loading: authLoading } = useAuth();
  const [tab, setTab] = useState('suggestions');
  const [q, setQ] = useState('');
  const [results, setResults] = useState(null);
  const [suggestions, setSuggestions] = useState(null);
  const [following, setFollowing] = useState([]);
  const [followers, setFollowers] = useState([]);

  useEffect(() => {
    if (!me) return;
    getSuggestions().then(setSuggestions).catch(() => setSuggestions({ people: [] }));
    getFollowing(me.username).then(setFollowing);
    getFollowers(me.username).then(setFollowers);
  }, [me]);

  const search = async (e) => {
    e.preventDefault();
    if (q.trim()) setResults(await searchPeople(q.trim()));
  };

  if (authLoading) return <Spinner />;
  if (!me) {
    return <SignInGate animal="cat" title="Find your readers" text="Follow people with your taste. Taste match and friends-of-friends come from the Neo4j social graph." button="Sign in to find readers" prop="crown" seed={40} />;
  }

  return (
    <Page>
      <PageTitle animal="cat" prop="beret" kicker="( People ) friends of friends, taste match and steps apart, from Neo4j">People</PageTitle>
      <div className="grid lg:grid-cols-[1fr_380px] gap-10">
        <div className="min-w-0">
          <form onSubmit={search} className="flex gap-3 mb-8">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5" />
              <Input className="pl-10" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by username or friend code" />
            </div>
            <NeoButton type="submit" variant="navy">Search</NeoButton>
          </form>
          {results && (
            <section className="mb-10">
              <SectionTitle>Results</SectionTitle>
              {results.length ? <ul className="space-y-3">{results.map((p) => <PersonRow key={p.username} p={p} extra={`${p.followers} followers`} />)}</ul> : <Empty title="Nobody found" />}
            </section>
          )}
          <Tabs
            active={tab}
            onChange={setTab}
            tabs={[
              { id: 'suggestions', label: 'People you may know' },
              { id: 'following', label: 'Following', count: following.length },
              { id: 'followers', label: 'Followers', count: followers.length },
            ]}
          />
          {tab === 'suggestions' && (
            suggestions === null ? <Spinner /> : suggestions.people.length ? (
              <ul className="space-y-3">
                {suggestions.people.map((p) => (
                  <PersonRow
                    key={p.username}
                    p={p}
                    extra={`${p.mutual} mutual · via ${p.via.map((v) => `@${v}`).join(', ')}${p.match_percent != null ? ` · ${p.match_percent}% taste match` : ''}`}
                  />
                ))}
              </ul>
            ) : (
              <Empty title="No suggestions yet">Follow a few readers and we'll suggest people they follow (friends of friends).</Empty>
            )
          )}
          {tab === 'following' && (following.length ? <ul className="space-y-3">{following.map((p) => <PersonRow key={p.username} p={p} />)}</ul> : <Empty title="Not following anyone yet" />)}
          {tab === 'followers' && (followers.length ? <ul className="space-y-3">{followers.map((p) => <PersonRow key={p.username} p={p} />)}</ul> : <Empty title="No followers yet" />)}
        </div>

        <aside className="space-y-6">
          <Card>
            <h3 className="font-medium text-xl mb-1">Your friend code</h3>
            <p className="display-num text-5xl tracking-[0.05em]">{me.friend_code}</p>
            <p className="text-sm text-text-muted font-medium">Share it so friends can find you, or tell them your username @{me.username}.</p>
          </Card>
          <div>
            <h3 className="font-medium text-xl mb-3">Your network</h3>
            <NetworkGraph me={me.username} following={following} followers={followers} />
            {suggestions?.source && (
              <p className="text-xs text-text-muted mt-2 font-medium">Suggestions computed with {suggestions.source === 'neo4j' ? 'Neo4j' : 'PostgreSQL (Neo4j offline)'}.</p>
            )}
          </div>
        </aside>
      </div>
    </Page>
  );
};

export default PeoplePage;
