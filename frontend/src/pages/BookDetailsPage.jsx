import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Star, Hash, Users, Layers, Activity, Network } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { getBookDetails, getRecommendations } from '../services/api';
import BookCard from '../components/BookCard';
import NeoButton, { cn } from '../components/NeoButton';
import { useAuth } from '../contexts/AuthContext';
import { addToLibrary } from '../services/api';

const BookDetailsPage = () => {
  const { title } = useParams();
  const navigate = useNavigate();
  
  const [book, setBook] = useState(null);
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showXAI, setShowXAI] = useState(false);
  const { currentUser, loginWithGoogle } = useAuth();
  const [libraryStatus, setLibraryStatus] = useState('idle'); // idle, loading, success, error

  const handleAddToLibrary = async () => {
    if (!currentUser) {
      loginWithGoogle();
      return;
    }
    try {
      setLibraryStatus('loading');
      await addToLibrary(currentUser.uid, book.title);
      setLibraryStatus('success');
    } catch (err) {
      console.error(err);
      setLibraryStatus('error');
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      window.scrollTo(0, 0);

      try {
        const decodedTitle = decodeURIComponent(title);
        const [bookData, recsData] = await Promise.all([
          getBookDetails(decodedTitle, currentUser?.uid),
          getRecommendations(decodedTitle)
        ]);
        
        setBook(bookData);
        setRecommendations(recsData);
        if (bookData.in_library) {
          setLibraryStatus('success');
        } else {
          setLibraryStatus('idle');
        }
      } catch (err) {
        console.error(err);
        setError('Node not found in the graph database.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [title, currentUser]);

  const colorPalettes = ['white', 'red', 'blue', 'teal'];

  if (loading) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center bg-bg-base">
        <div className="w-20 h-20 bg-accent-teal border-[4px] border-border shadow-brutal flex items-center justify-center animate-bounce">
          <Activity className="w-10 h-10 text-white animate-pulse" strokeWidth={3} />
        </div>
        <p className="mt-8 font-pixel text-2xl tracking-widest uppercase text-text-main">Querying Graph...</p>
      </div>
    );
  }

  if (error || !book) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center">
        <div className="bg-accent-red border-[4px] border-border p-12 shadow-brutal text-white">
          <h2 className="font-pixel text-4xl mb-6 tracking-widest uppercase">404 Error</h2>
          <p className="text-2xl font-bold mb-8">{error || 'Book node does not exist.'}</p>
          <NeoButton onClick={() => navigate('/search')} variant="white" size="lg">
            <ArrowLeft className="w-6 h-6 mr-2" /> Return to Search
          </NeoButton>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg-base pb-24">
      
      {/* Top Navigation Bar for Details */}
      <div className="border-b-[3px] border-border bg-surface-white sticky top-20 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <button 
            onClick={() => navigate(-1)}
            className="flex items-center font-bold text-lg hover:text-accent-red transition-colors group"
          >
            <div className="bg-text-main text-white p-1 border-[2px] border-border mr-3 group-hover:-translate-x-1 transition-transform">
              <ArrowLeft className="w-5 h-5" />
            </div>
            Back
          </button>
          <div className="font-pixel text-xl tracking-widest uppercase text-text-muted hidden sm:block">
            Node // {book.isbn13 || book.isbn10 || 'ID-UNKNOWN'}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12">
        
        {/* Main Split Layout */}
        <div className="flex flex-col lg:flex-row gap-12 xl:gap-16 mb-20">
          
          {/* Left: Cover Art */}
          <div className="lg:w-1/3 xl:w-1/4 flex-shrink-0">
            <motion.div 
              initial={{ x: -50, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ type: "spring", stiffness: 100 }}
              className="bg-accent-blue border-[4px] border-border shadow-brutal-lg p-4 rotate-[-2deg] hover:rotate-0 transition-transform duration-300"
            >
              <div className="border-[3px] border-border bg-bg-base aspect-[2/3] relative overflow-hidden">
                {book.thumbnail ? (
                  <img 
                    src={book.thumbnail} 
                    alt={book.title} 
                    className="w-full h-full object-cover mix-blend-multiply"
                    onError={(e) => { e.target.onerror = null; e.target.src = "https://via.placeholder.com/400x600?text=No+Cover"; }}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center font-pixel text-xl p-6 text-center">NO COVER DATA</div>
                )}
                
                <div className="absolute top-4 right-4 bg-accent-red text-white border-[3px] border-border shadow-brutal px-3 py-2 flex items-center font-bold text-xl">
                  <Star className="w-5 h-5 fill-current mr-1" />
                  {book.average_rating ? book.average_rating.toFixed(1) : 'N/A'}
                </div>
              </div>
            </motion.div>
          </div>

          {/* Right: Info */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="lg:w-2/3 xl:w-3/4 flex flex-col"
          >
            <div className="flex flex-col sm:flex-row sm:items-start justify-between mb-4 gap-4">
              <h1 className="text-5xl sm:text-6xl lg:text-7xl font-black text-text-main leading-[1.05]">
                {book.title}
              </h1>
              <NeoButton 
                onClick={handleAddToLibrary}
                variant={libraryStatus === 'success' ? 'secondary' : 'primary'}
                size="md"
                className="flex-shrink-0"
                disabled={libraryStatus === 'loading' || libraryStatus === 'success'}
              >
                {libraryStatus === 'loading' ? 'Saving...' : 
                 libraryStatus === 'success' ? 'Saved to Library' : 
                 currentUser ? 'Add to Library' : 'Login to Save'}
              </NeoButton>
            </div>
            
            {book.subtitle && (
              <h2 className="text-2xl sm:text-3xl font-medium text-text-muted mb-6 leading-snug">
                {book.subtitle}
              </h2>
            )}

            <div className="flex flex-wrap items-center gap-4 mb-8">
              {book.authors?.length > 0 ? (
                book.authors.map((author, index) => (
                  <Link 
                    key={index} 
                    to={`/author/${author}`}
                    className="bg-text-main hover:bg-accent-teal hover:text-white transition-colors text-white font-pixel text-xl px-4 py-2 uppercase tracking-widest shadow-brutal border-2 border-border"
                  >
                    {author}
                  </Link>
                ))
              ) : (
                <div className="bg-text-main text-white font-pixel text-xl px-4 py-2 uppercase tracking-widest shadow-brutal border-2 border-border">
                  Unknown
                </div>
              )}
              <div className="text-lg font-bold">
                {book.published_year ? `EST. ${book.published_year}` : ''}
              </div>
            </div>

            {/* Categories Tags */}
            <div className="flex flex-wrap gap-3 mb-10">
              {book.categories?.map((cat, idx) => (
                <span key={idx} className="bg-surface-white border-[2px] border-border px-4 py-1.5 font-bold shadow-[2px_2px_0px_0px_#111] hover:-translate-y-1 hover:shadow-brutal transition-all cursor-pointer">
                  #{cat.toUpperCase()}
                </span>
              ))}
            </div>

            {/* Description */}
            <div className="bg-surface-white border-[3px] border-border shadow-brutal p-8 mb-10 relative">
              <div className="absolute -top-4 -left-4 bg-accent-teal border-2 border-border p-2 shadow-[2px_2px_0px_0px_#111]">
                <Layers className="w-6 h-6 text-white" />
              </div>
              <p className="text-xl leading-relaxed text-text-main font-medium">
                {book.description || "No description indexed in the graph."}
              </p>
            </div>

            {/* Stats Row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-auto">
              {[
                { label: 'Pages', val: book.num_pages || 'N/A', bg: 'bg-accent-blue' },
                { label: 'Ratings', val: book.ratings_count?.toLocaleString() || '0', bg: 'bg-accent-red', text: 'text-white' },
                { label: 'ISBN-13', val: book.isbn13 || 'N/A', bg: 'bg-surface-white' },
                { label: 'ISBN-10', val: book.isbn10 || 'N/A', bg: 'bg-surface-white' }
              ].map((stat, i) => (
                <div key={i} className={cn("border-[3px] border-border shadow-[4px_4px_0px_0px_#111] p-4 flex flex-col justify-between", stat.bg, stat.text)}>
                  <span className="font-pixel text-sm uppercase tracking-widest opacity-80 mb-2">{stat.label}</span>
                  <span className="font-black text-xl line-clamp-1" title={stat.val}>{stat.val}</span>
                </div>
              ))}
            </div>
          </motion.div>
        </div>

        {/* Explainable AI Banner */}
        <div className="mb-16">
          <div 
            className="bg-accent-navy text-white border-[4px] border-border shadow-brutal p-6 md:p-8 flex flex-col md:flex-row items-center justify-between cursor-pointer group"
            onClick={() => setShowXAI(!showXAI)}
          >
            <div className="flex items-center mb-4 md:mb-0">
              <div className="bg-accent-teal border-2 border-border p-3 mr-6 group-hover:rotate-12 transition-transform">
                <Network className="w-8 h-8 text-white" strokeWidth={2.5} />
              </div>
              <div>
                <h3 className="text-3xl font-black mb-1">Explainable Traversal</h3>
                <p className="font-pixel text-lg text-gray-300">Why are we recommending these?</p>
              </div>
            </div>
            <NeoButton variant="white" size="md">
              {showXAI ? 'Hide Logic' : 'View Logic'}
            </NeoButton>
          </div>
          
          <AnimatePresence>
            {showXAI && (
              <motion.div 
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="bg-surface-white border-x-[4px] border-b-[4px] border-border p-8 border-t-0 shadow-brutal">
                  <div className="font-pixel text-xl mb-4 text-accent-red">System Log:</div>
                  <pre className="bg-bg-base border-2 border-border p-6 overflow-x-auto text-sm md:text-base font-bold leading-relaxed whitespace-pre-wrap">
                    {`> INITIALIZING GRAPH TRAVERSAL
> TARGET NODE: "${book.title}"
> MATCHING (Book)-[:HAS_CATEGORY]->(Category)<-[:HAS_CATEGORY]-(Recommendation)
> FILTERING b <> Recommendation
> CALCULATING SCORE MATRICES:
  Score = 5 * (Shared Categories) + 3 * (Avg Rating) + 2 * (Popularity)
> SORTING DESCENDING...
> RETURN TOP 10`}
                  </pre>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Recommendations Section */}
        <div>
          <h2 className="text-4xl md:text-5xl font-black mb-10 flex items-center">
            <span className="font-pixel text-accent-red mr-4 text-5xl">*</span> Graph Discoveries
          </h2>
          
          {recommendations.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-8 gap-y-12">
              {recommendations.map((rec, idx) => (
                <BookCard 
                  key={idx} 
                  book={rec} 
                  showScore={true} 
                  colorScheme={colorPalettes[idx % colorPalettes.length]} 
                />
              ))}
            </div>
          ) : (
            <div className="bg-surface-white border-[4px] border-border shadow-brutal p-12 text-center">
              <p className="font-pixel text-3xl text-text-muted mb-4">ISOLATED NODE</p>
              <p className="text-2xl font-bold">Our algorithm found no strong semantic neighbors.</p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

export default BookDetailsPage;
