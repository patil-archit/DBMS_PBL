import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { 
  getUserProfile, 
  followUser, 
  unfollowUser, 
  getUserFriends, 
  getFriendsActivity,
  getFriendSuggestions,
  compareLibraries
} from '../services/api';
import NeoButton from '../components/NeoButton';
import { Users, UserPlus, Copy, Check, Activity, BookOpen, Link as LinkIcon, Star } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import ForceGraph2D from 'react-force-graph-2d';

const FriendsPage = () => {
  const { currentUser } = useAuth();
  const [profile, setProfile] = useState(null);
  const [friends, setFriends] = useState([]);
  const [activity, setActivity] = useState([]);
  const [targetCode, setTargetCode] = useState('');
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [graphData, setGraphData] = useState({ nodes: [], links: [] });
  
  const [suggestions, setSuggestions] = useState([]);
  const [showCompareModal, setShowCompareModal] = useState(false);
  const [compareData, setCompareData] = useState(null);
  const [comparingFriend, setComparingFriend] = useState(null);

  const fgRef = useRef();

  const fetchData = async () => {
    if (!currentUser) return;
    setLoading(true);
    try {
      const [profRes, friendsRes, activityRes, suggRes] = await Promise.all([
        getUserProfile(),
        getUserFriends(),
        getFriendsActivity(),
        getFriendSuggestions()
      ]);
      
      setProfile(profRes);
      setFriends(friendsRes);
      setActivity(activityRes);
      setSuggestions(suggRes);
      
      // Build simple graph data
      const nodes = [];
      const links = [];
      
      if (profRes?.friend_code) {
        nodes.push({ id: profRes.friend_code, group: 1, label: currentUser.displayName?.split(' ')[0] || 'Me', val: 20 });
      }
      
      // Add friends
      friendsRes.forEach(f => {
        nodes.push({ id: f.friend_code, group: 2, label: f.name || f.friend_code, val: 15 });
        if (profRes?.friend_code) {
          links.push({ source: profRes.friend_code, target: f.friend_code, label: 'FOLLOWS_USER' });
        }
      });
      
      setGraphData({ nodes, links });
      
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [currentUser]);

  const handleCopy = () => {
    if (profile?.friend_code) {
      navigator.clipboard.writeText(profile.friend_code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleFollow = async (e) => {
    e.preventDefault();
    if (!targetCode.trim()) return;
    try {
      await followUser(targetCode.trim());
      setTargetCode('');
      fetchData(); // Refresh data
    } catch (err) {
      console.error("Failed to follow", err);
      alert("Could not follow user. Check the code.");
    }
  };

  const handleUnfollow = async (code) => {
    try {
      await unfollowUser(code);
      fetchData(); // Refresh data
    } catch (err) {
      console.error("Failed to unfollow", err);
    }
  };

  const handleCompare = async (friend) => {
    try {
      setComparingFriend(friend);
      const data = await compareLibraries(friend.friend_code);
      setCompareData(data);
      setShowCompareModal(true);
    } catch (err) {
      console.error(err);
      alert("Failed to compare libraries");
    }
  };

  const paintNode = useCallback((node, ctx, globalScale) => {
    const label = node.label;
    const fontSize = 14 / globalScale;
    ctx.font = `bold ${fontSize}px "VT323", monospace`;
    
    let bgColor = node.group === 1 ? '#DF6A61' : '#4B9F9F';
    const textColor = '#FFFFFF';
    
    const textWidth = ctx.measureText(label).width;
    const bckgDimensions = [textWidth, fontSize].map(n => n + fontSize * 1.5); 

    ctx.fillStyle = '#111111';
    ctx.fillRect(node.x - bckgDimensions[0] / 2 + 3, node.y - bckgDimensions[1] / 2 + 3, bckgDimensions[0], bckgDimensions[1]);

    ctx.fillStyle = bgColor;
    ctx.fillRect(node.x - bckgDimensions[0] / 2, node.y - bckgDimensions[1] / 2, bckgDimensions[0], bckgDimensions[1]);

    ctx.lineWidth = 2 / globalScale;
    ctx.strokeStyle = '#111111';
    ctx.strokeRect(node.x - bckgDimensions[0] / 2, node.y - bckgDimensions[1] / 2, bckgDimensions[0], bckgDimensions[1]);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = textColor;
    ctx.fillText(label, node.x, node.y);
    
    node.__bckgDimensions = bckgDimensions; 
  }, []);

  if (!currentUser) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center p-8">
        <div className="bg-surface-white border-[3px] border-border shadow-brutal p-8 text-center max-w-md w-full">
          <Users className="w-16 h-16 mx-auto mb-4 text-accent-red" />
          <h2 className="text-3xl font-black mb-4 uppercase">Login Required</h2>
          <p className="text-gray-600 mb-6 font-medium">Connect to see what your friends are reading.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="flex items-center gap-4 mb-10">
        <div className="bg-accent-blue p-3 border-[3px] border-border shadow-brutal">
          <Users className="w-8 h-8 text-white" strokeWidth={3} />
        </div>
        <div>
          <h1 className="text-4xl md:text-5xl font-black text-text-main uppercase tracking-tight">Social Network</h1>
          <p className="text-xl text-gray-600 font-medium">Connect, Follow, Discover.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column: Code & Add Friend */}
        <div className="lg:col-span-1 space-y-8">
          
          {/* Your Friend Code */}
          <div className="bg-surface-white border-[3px] border-border shadow-brutal p-6">
            <h3 className="font-pixel text-xl uppercase tracking-widest mb-4 flex items-center gap-2">
              <LinkIcon className="w-5 h-5" /> Your Code
            </h3>
            {loading ? (
              <div className="animate-pulse h-12 bg-gray-200 w-full mb-4"></div>
            ) : (
              <div className="bg-bg-base border-2 border-border p-4 mb-4 flex justify-between items-center group">
                <span className="font-pixel text-2xl tracking-widest text-accent-red">
                  {profile?.friend_code || '------'}
                </span>
                <button 
                  onClick={handleCopy}
                  className="p-2 bg-surface-white border-2 border-border hover:bg-accent-teal hover:text-white transition-colors cursor-pointer"
                >
                  {copied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                </button>
              </div>
            )}
            <p className="text-sm font-medium text-gray-600">Share this code with your friends so they can follow you.</p>
          </div>

          {/* Add Friend */}
          <div className="bg-accent-navy text-white border-[3px] border-border shadow-brutal p-6">
            <h3 className="font-pixel text-xl uppercase tracking-widest mb-4 flex items-center gap-2">
              <UserPlus className="w-5 h-5" /> Follow Friend
            </h3>
            <form onSubmit={handleFollow} className="flex gap-2">
              <input 
                type="text" 
                placeholder="Enter friend code" 
                value={targetCode}
                onChange={(e) => setTargetCode(e.target.value)}
                className="flex-1 bg-surface-white text-text-main border-2 border-border p-3 font-pixel tracking-widest focus:outline-none focus:ring-2 focus:ring-accent-teal uppercase placeholder-gray-400"
              />
              <NeoButton type="submit" variant="teal" className="px-6 border-2">Add</NeoButton>
            </form>
          </div>

          {/* Friend List */}
          <div className="bg-surface-white border-[3px] border-border shadow-brutal p-6">
            <h3 className="font-pixel text-xl uppercase tracking-widest mb-4 border-b-2 border-border pb-2">Following ({friends.length})</h3>
            {loading ? (
              <div className="text-center py-4 font-medium">Loading...</div>
            ) : friends.length === 0 ? (
              <div className="text-center py-4 font-medium text-gray-500">You aren't following anyone yet.</div>
            ) : (
              <ul className="space-y-3">
                {friends.map(f => (
                  <li key={f.uid} className="flex items-center justify-between p-3 bg-bg-base border-2 border-border">
                      <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-accent-blue flex items-center justify-center text-white font-pixel border border-border">
                        {(f.name || f.friend_code).charAt(0).toUpperCase()}
                      </div>
                      <span className="font-bold font-pixel tracking-wider">{f.name || f.friend_code}</span>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <button 
                        onClick={() => handleCompare(f)}
                        className="text-xs font-bold uppercase text-accent-teal hover:text-accent-navy transition-colors"
                      >
                        Compare
                      </button>
                      <button 
                        onClick={() => handleUnfollow(f.friend_code)}
                        className="text-xs font-bold uppercase text-gray-500 hover:text-accent-red transition-colors"
                      >
                        Unfollow
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Suggested Friends */}
          {suggestions.length > 0 && (
            <div className="bg-surface-white border-[3px] border-border shadow-brutal p-6">
              <h3 className="font-pixel text-xl uppercase tracking-widest mb-4 border-b-2 border-border pb-2">Suggested Friends</h3>
              <ul className="space-y-3">
                {suggestions.map(s => (
                  <li key={s.friend_code} className="flex items-center justify-between p-3 bg-bg-base border-2 border-border">
                    <div className="flex flex-col">
                      <span className="font-bold font-pixel tracking-wider">{s.name || s.friend_code}</span>
                      <span className="text-xs text-gray-500 font-bold uppercase">{s.mutual_friends} mutual friends</span>
                    </div>
                    <button 
                      onClick={() => { setTargetCode(s.friend_code); handleFollow({ preventDefault: () => {} }); }}
                      className="text-xs font-bold uppercase text-accent-teal hover:text-accent-navy transition-colors"
                    >
                      Follow
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

        </div>

        {/* Right Column: Activity & Graph */}
        <div className="lg:col-span-2 space-y-8">
          
          {/* Activity Feed */}
          <div className="bg-surface-white border-[3px] border-border shadow-brutal p-6">
            <h3 className="font-pixel text-xl uppercase tracking-widest mb-6 flex items-center gap-2 border-b-2 border-border pb-2">
              <Activity className="w-5 h-5 text-accent-red" /> Friend Activity
            </h3>
            
            {loading ? (
              <div className="text-center py-10 font-medium">Loading activity...</div>
            ) : activity.length === 0 ? (
              <div className="text-center py-10 bg-bg-base border-2 border-border">
                <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="font-medium text-gray-500">No recent activity from your friends.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {activity.map((item, idx) => (
                  <div key={idx} className="flex gap-4 p-4 bg-bg-base border-2 border-border hover:shadow-brutal hover:-translate-y-1 transition-all">
                    {item.thumbnail ? (
                      <img src={item.thumbnail} alt={item.title} className="w-16 h-20 object-cover border-2 border-border" />
                    ) : (
                      <div className="w-16 h-20 bg-gray-200 border-2 border-border flex items-center justify-center">
                        <BookOpen className="w-6 h-6 text-gray-400" />
                      </div>
                    )}
                    <div className="flex-1">
                      <p className="text-sm font-bold text-accent-teal uppercase tracking-wider mb-1">
                        {item.friend_name || item.friend_code} added a book
                      </p>
                      <h4 className="font-black text-lg leading-tight mb-1">{item.title}</h4>
                      <p className="text-sm text-gray-600 font-medium mb-2">{item.authors?.join(', ')}</p>
                      
                      {item.rating && (
                        <div className="flex items-center gap-1 mb-2">
                          {[...Array(5)].map((_, i) => (
                            <Star key={i} className={`w-4 h-4 ${i < item.rating ? 'fill-accent-red text-accent-red' : 'text-gray-300'}`} />
                          ))}
                        </div>
                      )}
                      {item.review && (
                        <p className="text-sm font-medium italic border-l-[3px] border-accent-blue pl-3 text-gray-700 bg-surface-white p-2">
                          "{item.review}"
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Graph Visualization */}
          <div className="bg-surface-white border-[3px] border-border shadow-brutal p-6">
            <h3 className="font-pixel text-xl uppercase tracking-widest mb-4 border-b-2 border-border pb-2">Your Network Graph</h3>
            <div className="w-full h-64 border-2 border-border bg-[#FAF8F5] relative overflow-hidden cursor-grab">
              <ForceGraph2D
                ref={fgRef}
                width={800} // rough estimate, will overflow but functional
                height={250}
                graphData={graphData}
                nodeCanvasObject={paintNode}
                nodePointerAreaPaint={(node, color, ctx) => {
                  ctx.fillStyle = color;
                  const bckgDimensions = node.__bckgDimensions;
                  bckgDimensions && ctx.fillRect(node.x - bckgDimensions[0] / 2, node.y - bckgDimensions[1] / 2, bckgDimensions[0], bckgDimensions[1]);
                }}
                linkColor={() => 'rgba(17, 17, 17, 0.4)'}
                linkWidth={2}
                cooldownTicks={50}
                onEngineStop={() => fgRef.current?.zoomToFit(200, 50)}
              />
            </div>
          </div>

        </div>
      </div>
      
      <AnimatePresence>
        {showCompareModal && compareData && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-bg-base border-[4px] border-border shadow-brutal-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            >
              <div className="bg-text-main text-white p-4 border-b-[4px] border-border flex justify-between items-center sticky top-0 z-10">
                <h3 className="font-pixel text-xl uppercase tracking-widest">Library Compare</h3>
                <button onClick={() => setShowCompareModal(false)} className="hover:text-accent-red font-bold text-xl">X</button>
              </div>
              <div className="p-6">
                <div className="text-center mb-8">
                  <h4 className="text-3xl font-black mb-2">You & {comparingFriend?.name || comparingFriend?.friend_code}</h4>
                  <div className="inline-block bg-accent-teal text-white font-pixel text-2xl uppercase tracking-widest px-4 py-2 border-[3px] border-border shadow-[4px_4px_0px_0px_#111]">
                    Compatibility: {Math.round((compareData.jaccard_index || 0) * 100)}%
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                  <div className="bg-surface-white border-[3px] border-border p-4 shadow-[4px_4px_0px_0px_#111]">
                    <h5 className="font-pixel text-lg text-accent-red mb-3 uppercase border-b-2 border-border pb-1">Books you share ({compareData.shared_books?.length || 0})</h5>
                    <ul className="text-sm font-medium space-y-1 list-disc pl-4 text-gray-700">
                      {compareData.shared_books?.map((b, i) => <li key={i}>{b}</li>)}
                    </ul>
                  </div>
                  <div className="bg-surface-white border-[3px] border-border p-4 shadow-[4px_4px_0px_0px_#111]">
                    <h5 className="font-pixel text-lg text-accent-blue mb-3 uppercase border-b-2 border-border pb-1">Their Unique Books ({compareData.friend_unique_books?.length || 0})</h5>
                    <ul className="text-sm font-medium space-y-1 list-disc pl-4 text-gray-700">
                      {compareData.friend_unique_books?.map((b, i) => <li key={i}>{b}</li>)}
                    </ul>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
};

export default FriendsPage;
