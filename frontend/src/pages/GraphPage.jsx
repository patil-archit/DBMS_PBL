import React, { useEffect, useRef, useState, useCallback } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import { Network, ZoomIn, ZoomOut, RefreshCw } from 'lucide-react';
import NeoButton from '../components/NeoButton';
import { getAllBooks } from '../services/api';

const GraphPage = () => {
  const fgRef = useRef();
  const [graphData, setGraphData] = useState({ nodes: [], links: [] });
  const [loading, setLoading] = useState(true);
  const [windowDimensions, setWindowDimensions] = useState({ width: 800, height: 600 });

  useEffect(() => {
    const handleResize = () => {
      if (typeof window !== 'undefined') {
        setWindowDimensions({
          width: window.innerWidth,
          height: window.innerHeight - 100, // Subtract navbar height roughly
        });
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const fetchInitialData = async () => {
      setLoading(true);
      try {
        // Fetch all books in the database to build the graph
        const books = await getAllBooks();
        
        const nodes = [];
        const links = [];
        const nodeMap = new Set();
        
        books.forEach((book, i) => {
          if (!nodeMap.has(book.title)) {
            nodes.push({ id: book.title, group: 1, label: book.title, val: 20 });
            nodeMap.add(book.title);
          }
          
          book.categories?.forEach(cat => {
            const catId = `CAT_${cat}`;
            if (!nodeMap.has(catId)) {
              nodes.push({ id: catId, group: 2, label: cat, val: 15 });
              nodeMap.add(catId);
            }
            links.push({ source: book.title, target: catId, label: 'HAS_CATEGORY' });
          });
          
          book.authors?.forEach(auth => {
            const authId = `AUTH_${auth}`;
            if (!nodeMap.has(authId)) {
              nodes.push({ id: authId, group: 3, label: auth, val: 15 });
              nodeMap.add(authId);
            }
            links.push({ source: book.title, target: authId, label: 'WRITTEN_BY' });
          });
        });

        setGraphData({ nodes, links });
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchInitialData();
  }, []);

  const handleZoomIn = () => {
    if (fgRef.current) {
      fgRef.current.zoom(fgRef.current.zoom() * 1.5, 400);
    }
  };

  const handleZoomOut = () => {
    if (fgRef.current) {
      fgRef.current.zoom(fgRef.current.zoom() / 1.5, 400);
    }
  };

  const handleReset = () => {
    if (fgRef.current) {
      fgRef.current.zoomToFit(400);
    }
  };

  const paintNode = useCallback((node, ctx, globalScale) => {
    const label = node.label;
    const fontSize = 14 / globalScale;
    ctx.font = `bold ${fontSize}px "VT323", monospace`;
    
    // Node colors based on group
    let bgColor = '#111111';
    let textColor = '#FFFFFF';
    let borderColor = '#111111';

    if (node.group === 1) { // Book
      bgColor = '#DF6A61';
    } else if (node.group === 2) { // Category
      bgColor = '#4B9F9F';
    } else if (node.group === 3) { // Author
      bgColor = '#79A3D2';
    }

    const textWidth = ctx.measureText(label).width;
    const bckgDimensions = [textWidth, fontSize].map(n => n + fontSize * 1.5); 

    // Draw Brutalist Box (Shadow)
    ctx.fillStyle = '#111111';
    ctx.fillRect(node.x - bckgDimensions[0] / 2 + 3, node.y - bckgDimensions[1] / 2 + 3, bckgDimensions[0], bckgDimensions[1]);

    // Draw Brutalist Box (Main)
    ctx.fillStyle = bgColor;
    ctx.fillRect(node.x - bckgDimensions[0] / 2, node.y - bckgDimensions[1] / 2, bckgDimensions[0], bckgDimensions[1]);

    // Draw Border
    ctx.lineWidth = 2 / globalScale;
    ctx.strokeStyle = borderColor;
    ctx.strokeRect(node.x - bckgDimensions[0] / 2, node.y - bckgDimensions[1] / 2, bckgDimensions[0], bckgDimensions[1]);

    // Draw Text
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = textColor;
    ctx.fillText(label, node.x, node.y);
    
    node.__bckgDimensions = bckgDimensions; 
  }, []);

  useEffect(() => {
    if (fgRef.current) {
      fgRef.current.d3Force('charge').strength(-800);
      fgRef.current.d3Force('link').distance(150);
    }
  }, [graphData]);

  return (
    <div className="min-h-screen bg-bg-base relative overflow-hidden">
      
      {/* Overlay UI */}
      <div className="absolute top-8 left-8 z-10 pointer-events-none">
        <h1 className="text-4xl md:text-5xl font-black mb-2 text-text-main flex items-center bg-surface-white p-4 border-[3px] border-border shadow-brutal pointer-events-auto">
          <Network className="w-8 h-8 mr-4 text-accent-red" strokeWidth={3} />
          Graph Viewer
        </h1>
      </div>

      <div className="absolute bottom-8 right-8 z-10 flex flex-col gap-4 pointer-events-auto">
        <NeoButton onClick={handleZoomIn} variant="white" className="p-3">
          <ZoomIn className="w-6 h-6" />
        </NeoButton>
        <NeoButton onClick={handleZoomOut} variant="white" className="p-3">
          <ZoomOut className="w-6 h-6" />
        </NeoButton>
        <NeoButton onClick={handleReset} variant="navy" className="p-3">
          <RefreshCw className="w-6 h-6" />
        </NeoButton>
      </div>

      {/* Legend */}
      <div className="absolute bottom-8 left-8 z-10 bg-surface-white border-[3px] border-border shadow-brutal p-6 pointer-events-auto">
        <h3 className="font-pixel text-xl uppercase tracking-widest mb-4 border-b-2 border-border pb-2">Node Legend</h3>
        <div className="flex flex-col gap-3">
          <div className="flex items-center"><div className="w-6 h-6 bg-accent-red border-2 border-border mr-3"></div><span className="font-bold">Book</span></div>
          <div className="flex items-center"><div className="w-6 h-6 bg-accent-teal border-2 border-border mr-3"></div><span className="font-bold">Category</span></div>
          <div className="flex items-center"><div className="w-6 h-6 bg-accent-blue border-2 border-border mr-3"></div><span className="font-bold">Author</span></div>
        </div>
      </div>

      {/* Loading Overlay */}
      {loading && (
        <div className="absolute inset-0 z-20 bg-bg-base/80 backdrop-blur flex items-center justify-center">
          <div className="bg-accent-teal p-8 border-[4px] border-border shadow-brutal text-white flex flex-col items-center">
            <RefreshCw className="w-12 h-12 animate-spin mb-4" strokeWidth={3} />
            <span className="font-pixel text-2xl tracking-widest">Constructing Graph...</span>
          </div>
        </div>
      )}

      {/* Force Graph */}
      <div className="cursor-grab active:cursor-grabbing w-full h-full border-t-[3px] border-border" style={{ height: 'calc(100vh - 80px)' }}>
        <ForceGraph2D
          ref={fgRef}
          width={windowDimensions.width}
          height={windowDimensions.height}
          graphData={graphData}
          nodeCanvasObject={paintNode}
          nodePointerAreaPaint={(node, color, ctx) => {
            ctx.fillStyle = color;
            const bckgDimensions = node.__bckgDimensions;
            bckgDimensions && ctx.fillRect(node.x - bckgDimensions[0] / 2, node.y - bckgDimensions[1] / 2, bckgDimensions[0], bckgDimensions[1]);
          }}
          linkColor={() => 'rgba(17, 17, 17, 0.4)'}
          linkWidth={1.5}
          backgroundColor="#FAF8F5"
          cooldownTicks={100}
          onEngineStop={() => fgRef.current.zoomToFit(400, 100)}
        />
      </div>
    </div>
  );
};

export default GraphPage;
