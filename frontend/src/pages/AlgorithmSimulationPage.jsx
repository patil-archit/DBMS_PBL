import React, { useState, useRef, useEffect, useCallback } from 'react';
import ForceGraph3D from 'react-force-graph-3d';
import { motion, AnimatePresence } from 'framer-motion';
import { Network, Search as SearchIcon, Play, Square, FastForward, Info, CheckCircle2, RefreshCw } from 'lucide-react';
import NeoButton from '../components/NeoButton';
import BookCard from '../components/BookCard';
import { searchBooks, simulateGraphTraversal } from '../services/api';
import SpriteText from 'three-spritetext';
import * as THREE from 'three';

const AlgorithmSimulationPage = () => {
  const fgRef = useRef();
  
  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedNode, setSelectedNode] = useState(null);
  
  // Simulation state
  const [algorithm, setAlgorithm] = useState('bfs'); // 'bfs' or 'dfs'
  const [traversalRange, setTraversalRange] = useState('20'); // '20' or 'complete'
  const [simulationStatus, setSimulationStatus] = useState('idle'); // idle, running, finished
  const [traversalLog, setTraversalLog] = useState([]);
  
  // Graph state
  const [fullGraph, setFullGraph] = useState({ nodes: [], links: [] });
  const [displayGraph, setDisplayGraph] = useState({ nodes: [], links: [] });
  const [visitedNodeIds, setVisitedNodeIds] = useState(new Set());
  const [visitedLinkIds, setVisitedLinkIds] = useState(new Set());
  
  // Dimensions
  const [dimensions, setDimensions] = useState({ width: window.innerWidth, height: window.innerHeight * 0.7 });

  useEffect(() => {
    const handleResize = () => {
      setDimensions({
        width: window.innerWidth,
        height: window.innerHeight * 0.7
      });
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleSearch = async (e) => {
    const q = e.target.value;
    setSearchQuery(q);
    if (q.trim().length > 1) {
      setIsSearching(true);
      try {
        const res = await searchBooks(q);
        // Combine books, authors, categories into a flat list for selection
        const combined = [
          ...res.books.map(b => ({ id: b.title, label: b.title, type: 'Book' })),
          ...res.authors.map(a => ({ id: a.name, label: a.name, type: 'Author' })),
          ...res.genres.map(c => ({ id: c.name, label: c.name, type: 'Category' }))
        ];
        setSearchResults(combined.slice(0, 10)); // Top 10
      } catch (err) {
        console.error(err);
      } finally {
        setIsSearching(false);
      }
    } else {
      setSearchResults([]);
    }
  };

  const selectNode = (node) => {
    setSelectedNode(node);
    setSearchQuery(node.label);
    setSearchResults([]);
    setSimulationStatus('idle');
    setTraversalLog([]);
    setDisplayGraph({ nodes: [], links: [] });
    setVisitedNodeIds(new Set());
    setVisitedLinkIds(new Set());
  };

  const startSimulation = async () => {
    if (!selectedNode) return;
    
    setSimulationStatus('running');
    setTraversalLog([]);
    setVisitedNodeIds(new Set());
    setVisitedLinkIds(new Set());
    
    try {
      const limitVal = traversalRange === '20' ? 20 : null;
      const data = await simulateGraphTraversal(selectedNode.id, algorithm, limitVal);
      
      const { visited_nodes, visited_edges, graph_nodes, graph_edges } = data;
      
      // Build full graph once to layout nodes
      setFullGraph({ nodes: graph_nodes, links: graph_edges });
      setDisplayGraph({ nodes: graph_nodes, links: graph_edges });
      
      // Let force graph settle for a bit then start animation
      setTimeout(() => {
        animateTraversal(visited_nodes, visited_edges);
      }, 1000);
      
    } catch (err) {
      console.error(err);
      setSimulationStatus('idle');
    }
  };

  const animateTraversal = (nodes, edges) => {
    let step = 0;
    const vNodes = new Set();
    const vLinks = new Set();
    const log = [];
    
    const interval = setInterval(() => {
      if (step >= nodes.length) {
        clearInterval(interval);
        setSimulationStatus('finished');
        return;
      }
      
      const currentNode = nodes[step];
      vNodes.add(currentNode.id);
      
      if (step > 0 && edges[step - 1]) {
        const currentEdge = edges[step - 1];
        vLinks.add(`${currentEdge.source}-${currentEdge.target}`);
        vLinks.add(`${currentEdge.target}-${currentEdge.source}`);
      }
      
      log.push(currentNode);
      
      setVisitedNodeIds(new Set(vNodes));
      setVisitedLinkIds(new Set(vLinks));
      setTraversalLog([...log]);
      
      step++;
    }, 400); // 400ms per step
  };

  const getNodeColor = (node) => {
    if (visitedNodeIds.has(node.id)) {
      if (node.group === 'Book') return '#DF6A61';
      if (node.group === 'Category') return '#4B9F9F';
      if (node.group === 'Author') return '#79A3D2';
      return '#FFD700'; // Default visited
    }
    return '#333333'; // Unvisited gray
  };

  return (
    <div className="min-h-screen bg-bg-base flex flex-col font-main text-text-main">
      
      {/* Top Section - 3D Graph Viewer (70vh) */}
      <div className="relative border-b-[4px] border-border bg-[#FAF8F5]" style={{ height: dimensions.height }}>
        
        {/* Controls Overlay */}
        <div className="absolute top-6 left-6 z-10 w-80 bg-surface-white border-[3px] border-border shadow-brutal p-4 pointer-events-auto">
          <h2 className="text-2xl font-black mb-4 flex items-center">
            <Network className="mr-2 text-accent-red" />
            Graph Simulator
          </h2>
          
          <div className="relative mb-4">
            <label className="font-pixel text-sm uppercase tracking-widest text-text-muted mb-1 block">Starting Node (Search)</label>
            <div className="relative">
              <input 
                type="text" 
                value={searchQuery}
                onChange={handleSearch}
                placeholder="Search a book, author..."
                className="w-full bg-white border-2 border-border p-2 pr-10 focus:outline-none focus:border-accent-teal shadow-[2px_2px_0px_0px_#111]"
              />
              <SearchIcon className="absolute right-3 top-2.5 w-5 h-5 text-text-muted" />
            </div>
            
            {/* Search Dropdown */}
            <AnimatePresence>
              {searchResults.length > 0 && (
                <motion.div 
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="absolute w-full mt-2 bg-white border-2 border-border shadow-brutal max-h-60 overflow-y-auto z-50"
                >
                  {searchResults.map((res, i) => (
                    <div 
                      key={i} 
                      onClick={() => selectNode(res)}
                      className="p-3 border-b-2 border-border last:border-b-0 hover:bg-bg-base cursor-pointer flex justify-between items-center"
                    >
                      <span className="font-bold truncate max-w-[70%]">{res.label}</span>
                      <span className="text-xs font-pixel bg-accent-yellow px-1 py-0.5 border border-border">{res.type}</span>
                    </div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          
          <div className="mb-4">
            <label className="font-pixel text-sm uppercase tracking-widest text-text-muted mb-1 block">Algorithm</label>
            <div className="flex w-full border-2 border-border bg-white p-1 shadow-[2px_2px_0px_0px_#111]">
              <button 
                onClick={() => setAlgorithm('bfs')}
                className={`flex-1 py-1 font-bold transition-colors ${algorithm === 'bfs' ? 'bg-accent-teal text-white border-2 border-border' : 'text-text-muted hover:text-text-main'}`}
              >
                BFS
              </button>
              <button 
                onClick={() => setAlgorithm('dfs')}
                className={`flex-1 py-1 font-bold transition-colors ${algorithm === 'dfs' ? 'bg-accent-blue text-white border-2 border-border' : 'text-text-muted hover:text-text-main'}`}
              >
                DFS
              </button>
            </div>
          </div>

          <div className="mb-4">
            <label className="font-pixel text-sm uppercase tracking-widest text-text-muted mb-1 block">Traversal Range</label>
            <div className="flex w-full border-2 border-border bg-white p-1 shadow-[2px_2px_0px_0px_#111]">
              <button 
                type="button"
                onClick={() => setTraversalRange('20')}
                className={`flex-1 py-1 font-bold text-xs uppercase tracking-tight transition-colors ${traversalRange === '20' ? 'bg-accent-teal text-white border-2 border-border' : 'text-text-muted hover:text-text-main'}`}
              >
                20 Limited
              </button>
              <button 
                type="button"
                onClick={() => setTraversalRange('complete')}
                className={`flex-1 py-1 font-bold text-xs uppercase tracking-tight transition-colors ${traversalRange === 'complete' ? 'bg-accent-blue text-white border-2 border-border' : 'text-text-muted hover:text-text-main'}`}
              >
                Complete
              </button>
            </div>
          </div>
          
          <NeoButton 
            onClick={startSimulation} 
            disabled={!selectedNode || simulationStatus === 'running'}
            variant={simulationStatus === 'running' ? 'yellow' : 'navy'}
            className="w-full flex justify-center py-3"
          >
            {simulationStatus === 'running' ? (
              <><Square className="w-5 h-5 mr-2" /> Running...</>
            ) : simulationStatus === 'finished' ? (
              <><RefreshCw className="w-5 h-5 mr-2" /> Restart</>
            ) : (
              <><Play className="w-5 h-5 mr-2" /> Start Simulation</>
            )}
          </NeoButton>
        </div>
        
        {/* Traversal Log */}
        <AnimatePresence>
          {traversalLog.length > 0 && (
            <motion.div 
              initial={{ x: 300, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              className="absolute top-6 right-6 z-10 w-64 bg-surface-white border-[3px] border-border shadow-brutal flex flex-col pointer-events-auto"
              style={{ maxHeight: dimensions.height - 48 }}
            >
              <div className="p-3 border-b-2 border-border bg-accent-yellow">
                <h3 className="font-pixel text-lg tracking-widest uppercase">Traversal Log</h3>
              </div>
              <div className="p-3 overflow-y-auto flex-1 flex flex-col gap-2">
                {traversalLog.map((node, i) => (
                  <motion.div 
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    key={`${node.id}-${i}`}
                    className="flex items-center text-sm p-2 border-2 border-border bg-bg-base"
                  >
                    <span className="font-pixel text-accent-red w-6">{i+1}.</span>
                    <span className="font-bold truncate">{node.label}</span>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 3D Force Graph */}
        <div className="w-full h-full cursor-grab active:cursor-grabbing">
          {typeof window !== 'undefined' && (
            <ForceGraph3D
              ref={fgRef}
              width={dimensions.width}
              height={dimensions.height}
              graphData={displayGraph}
              backgroundColor="#FAF8F5"
              showNavInfo={false}
              nodeColor={getNodeColor}
              nodeRelSize={6}
              nodeOpacity={0.9}
              nodeResolution={16}
              linkColor={(link) => visitedLinkIds.has(`${link.source.id || link.source}-${link.target.id || link.target}`) || visitedLinkIds.has(`${link.target.id || link.target}-${link.source.id || link.source}`) ? '#111111' : '#dddddd'}
              linkWidth={(link) => visitedLinkIds.has(`${link.source.id || link.source}-${link.target.id || link.target}`) || visitedLinkIds.has(`${link.target.id || link.target}-${link.source.id || link.source}`) ? 2 : 0.5}
              linkOpacity={0.6}
              d3Force={(forceName, force) => {
                if (forceName === 'charge') force.strength(-200);
              }}
              nodeThreeObjectExtend={true}
              nodeThreeObject={node => {
                // Add sprite label only if visited to reduce clutter, or always? Let's do always for context but small
                if (visitedNodeIds.has(node.id)) {
                  const sprite = new SpriteText(node.label);
                  sprite.color = '#111';
                  sprite.textHeight = 8;
                  sprite.fontFace = 'VT323, monospace';
                  sprite.position.set(0, 12, 0); // Above the node
                  return sprite;
                }
                return null;
              }}
            />
          )}
        </div>
      </div>

      {/* Traversed Book Catalog Sexy Grid */}
      <AnimatePresence>
        {simulationStatus === 'finished' && traversalLog.filter(node => node.group === 'Book').length > 0 && (
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 30 }}
            className="border-b-[4px] border-border bg-[#FAF8F5] py-16 px-4 sm:px-6 lg:px-8"
          >
            <div className="max-w-6xl mx-auto">
              <div className="mb-10 text-center">
                <h3 className="text-4xl font-black uppercase tracking-tighter text-text-main inline-block bg-accent-yellow border-[3px] border-border px-6 py-2 shadow-brutal transform -rotate-1">
                  Traversed Book Catalog
                </h3>
                <p className="text-lg text-text-muted mt-4 font-semibold">
                  Sexy, high-quality, real covers traversed by our {algorithm.toUpperCase()} algorithm ({traversalLog.filter(node => node.group === 'Book').length} books discovered).
                </p>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
                {traversalLog.filter(node => node.group === 'Book').map((book, i) => (
                  <BookCard 
                    key={`${book.id}-${i}`}
                    book={{
                      title: book.label,
                      thumbnail: book.thumbnail,
                      average_rating: book.average_rating || 0.0,
                      authors: book.authors || []
                    }} 
                    colorScheme={['teal', 'red', 'blue', 'white'][i % 4]} 
                  />
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom Section - Explanations */}
      <div className="flex-1 bg-white p-8 md:p-16">
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-12">
          
          {/* BMH */}
          <div className="col-span-1 md:col-span-3 border-[3px] border-border shadow-brutal p-8 bg-surface-white mb-4 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-accent-teal/10 rounded-bl-full -z-10 group-hover:scale-150 transition-transform duration-500"></div>
            <h3 className="text-3xl font-black mb-4 flex items-center">
              <SearchIcon className="w-8 h-8 mr-3 text-accent-teal" strokeWidth={3} />
              Boyer-Moore-Horspool (BMH) in this Project
            </h3>
            <p className="text-lg leading-relaxed text-text-muted mb-4 font-medium">
              The Boyer-Moore-Horspool algorithm is a highly efficient string-searching algorithm that skips multiple characters by analyzing the mismatched character. Instead of comparing character by character sequentially, it uses a <strong>bad-character shift table</strong> to jump ahead.
            </p>
            <div className="bg-bg-base border-2 border-border p-4 font-mono text-sm mb-4 text-text-main shadow-[inset_2px_2px_0px_#ddd]">
              {'// Example Shift Table for "BOOK"\nB: 3, O: 1, K: 4 (default)'}
            </div>
            <p className="text-lg leading-relaxed text-text-muted font-medium">
              <span className="font-bold text-text-main">How we use it:</span> We implemented an <em>Advanced Multi-Token BMH</em> variant. When you search for "Harry Potter", we tokenize the query into "Harry" and "Potter", compute shift tables for both, and run BMH concurrently across book titles, authors, and genres. It scores exact matches higher and gracefully handles multi-word queries across thousands of graph nodes instantly.
            </p>
          </div>

          {/* BFS */}
          <div className="col-span-1 border-[3px] border-border shadow-brutal p-8 bg-accent-yellow/20 relative">
            <h3 className="text-2xl font-black mb-4 flex items-center">
              <CheckCircle2 className="w-6 h-6 mr-2 text-accent-red" />
              Breadth-First Search (BFS)
            </h3>
            <p className="text-md leading-relaxed text-text-muted font-medium mb-4">
              BFS explores the graph level by level. It visits all immediate neighbors of a node before moving to the neighbors of those neighbors. It uses a <strong>Queue</strong> (First-In, First-Out).
            </p>
            <p className="text-md leading-relaxed text-text-muted font-medium">
              <span className="font-bold text-text-main">Use Case:</span> In our Book Recommendation System, BFS is perfect for finding the shortest path between two authors or discovering the most closely related books (e.g., finding all books 1 degree of separation away).
            </p>
          </div>

          {/* DFS */}
          <div className="col-span-1 md:col-span-2 border-[3px] border-border shadow-brutal p-8 bg-accent-blue/10 relative">
            <h3 className="text-2xl font-black mb-4 flex items-center">
              <FastForward className="w-6 h-6 mr-2 text-accent-blue" />
              Depth-First Search (DFS)
            </h3>
            <p className="text-md leading-relaxed text-text-muted font-medium mb-4">
              DFS explores as far down a single branch as possible before backtracking. It uses a <strong>Stack</strong> (Last-In, First-Out) or recursion to remember where it left off.
            </p>
            <p className="text-md leading-relaxed text-text-muted font-medium">
              <span className="font-bold text-text-main">Use Case:</span> DFS is excellent for exhaustive searches, like finding if a deep connection exists between obscure categories, or generating a continuous "rabbit hole" of book recommendations by following a single thread of categories and authors deep into the database.
            </p>
          </div>

        </div>
      </div>
    </div>
  );
};

export default AlgorithmSimulationPage;
