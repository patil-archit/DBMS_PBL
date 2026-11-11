import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Compass, BookOpen, Share2 } from 'lucide-react';
import { motion } from 'framer-motion';
import NeoButton from '../components/NeoButton';
import BookCard from '../components/BookCard';
import { useAuth } from '../contexts/AuthContext';
import GoalWidget from '../components/GoalWidget';
import { getPersonalizedRecommendations, getDbStats, getTrending } from '../services/api';

const HomePage = () => {
  const [query, setQuery] = useState('');
  const navigate = useNavigate();
  const { currentUser, loading: authLoading } = useAuth();
  const [recommendations, setRecommendations] = useState([]);
  const [loadingRecs, setLoadingRecs] = useState(false);
  const [stats, setStats] = useState({ books_count: 0, authors_count: 0, categories_count: 0 });
  const [trending, setTrending] = useState([]);

  useEffect(() => {
    getTrending(8).then(setTrending).catch(() => {});
  }, []);

  useEffect(() => {
    getDbStats()
      .then(data => {
        setStats(data);
      })
      .catch(err => {
        console.error("Failed to load database stats", err);
      });
  }, []);


  useEffect(() => {
    if (currentUser) {
      setLoadingRecs(true);
      getPersonalizedRecommendations()
        .then(data => {
          setRecommendations(data);
          setLoadingRecs(false);
        })
        .catch(err => {
          console.error("Failed to load recommendations", err);
          setLoadingRecs(false);
        });
    } else {
      setRecommendations([]);
    }
  }, [currentUser]);

  const handleSearch = (e) => {
    e.preventDefault();
    if (query.trim()) {
      navigate(`/search?q=${encodeURIComponent(query)}`);
    }
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { 
      opacity: 1,
      transition: { staggerChildren: 0.2 }
    }
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: { y: 0, opacity: 1, transition: { type: 'spring', stiffness: 100 } }
  };

  return (
    <div className="min-h-screen bg-bg-base overflow-hidden">
      {/* Hero Section */}
      <section className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-32">
        <div className="absolute top-10 right-10 w-16 h-16 bg-accent-red border-[3px] border-border shadow-brutal hidden lg:block" />
        <div className="absolute bottom-20 left-10 w-12 h-12 bg-accent-teal rounded-full border-[3px] border-border shadow-brutal hidden lg:block" />
        
        <motion.div 
          className="text-center md:text-left md:max-w-4xl z-10 relative"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          <motion.div variants={itemVariants} className="inline-block mb-6 bg-surface-white border-2 border-border px-4 py-2 shadow-brutal">
            <span className="font-bold text-sm tracking-widest uppercase">The Future of Reading</span>
          </motion.div>
          
          <motion.h1 variants={itemVariants} className="text-6xl sm:text-7xl lg:text-8xl font-black text-text-main leading-[1.1] mb-8">
            Discover books <br/>
            through <span className="text-transparent bg-clip-text bg-gradient-to-r from-accent-red to-accent-teal" style={{ WebkitTextStroke: '2px #111', textStroke: '2px #111', color: 'transparent' }}>your own</span> <br/>
            <span className="font-pixel text-7xl sm:text-8xl lg:text-9xl text-accent-blue bg-surface-white border-[4px] border-border shadow-brutal px-6 inline-block mt-4 transform -rotate-2">reading diary</span>
          </motion.h1>
 
          <motion.p variants={itemVariants} className="text-xl md:text-2xl text-text-muted mb-12 max-w-2xl font-medium leading-relaxed">
            Stop relying on generic top-10 lists. BookLog keeps a diary of what you read and uses your ratings, favourite authors and friends to find exactly what you should read next.
          </motion.p>
 
          <motion.form variants={itemVariants} onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-4 max-w-2xl">
            <div className="relative flex-grow">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Search className="h-6 w-6 text-text-muted" strokeWidth={3} />
              </div>
              <input
                type="text"
                className="w-full pl-14 pr-4 py-4 bg-surface-white border-[3px] border-border shadow-brutal text-lg font-bold placeholder-text-muted focus:outline-none focus:shadow-brutal-hover focus:translate-x-[2px] focus:translate-y-[2px] transition-all"
                placeholder="Search a book you love..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <NeoButton type="submit" size="lg" variant="primary" className="whitespace-nowrap flex-shrink-0 text-xl tracking-wide">
              Let's go for it
            </NeoButton>
          </motion.form>
        </motion.div>
      </section>
 
      {/* Recommended For You Section */}
      {!authLoading && currentUser && (
        <section className="bg-bg-base border-t-[3px] border-border py-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="mb-10">
              <h2 className="text-4xl font-black uppercase tracking-tighter text-text-main">
                Recommended For You
              </h2>
              <p className="text-lg text-text-muted mt-2 font-medium">
                From your ratings, readers with similar taste, people and authors you follow, your favourite genres and what's trending. Each pick says why.
              </p>
            </div>
            <div className="mb-10 max-w-xl">
              <GoalWidget />
            </div>
            
            {loadingRecs ? (
              <div className="flex justify-center py-12">
                <div className="w-12 h-12 border-4 border-text-main border-t-accent-red rounded-full animate-spin"></div>
              </div>
            ) : recommendations.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
                {recommendations.slice(0, 12).map((book, i) => (
                  <BookCard
                    key={book.book_id}
                    book={book}
                    source={`recommendation:${book.source}`}
                    colorScheme={['teal', 'red', 'blue', 'white'][i % 4]}
                  />
                ))}
              </div>
            ) : (
              <p className="text-text-muted font-pixel text-center py-8">No recommendations found yet.</p>
            )}
          </div>
        </section>
      )}

      {/* Trending (MongoDB activity) */}
      {trending.length > 0 && (
        <section className="border-t-[3px] border-border py-16 bg-surface-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-4xl font-black uppercase tracking-tighter text-text-main mb-2">Trending this week</h2>
            <p className="text-lg text-text-muted mb-10 font-medium">Most viewed and clicked books on BookLog in the last 7 days.</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-6 md:gap-8">
              {trending.map((book, i) => (
                <BookCard key={book.book_id} book={book} source="trending" colorScheme={['white', 'blue', 'teal', 'red'][i % 4]} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Features Grid */}
      <section className="border-t-[3px] border-border bg-surface-white">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 divide-y-[3px] md:divide-y-0 md:divide-x-[3px] divide-border">
            
            {/* Feature 1 */}
            <div className="p-12 hover:bg-bg-base transition-colors group">
              <div className="w-16 h-16 bg-accent-blue border-[3px] border-border shadow-brutal flex items-center justify-center mb-8 group-hover:-translate-y-2 transition-transform">
                <Compass className="w-8 h-8 text-text-main" strokeWidth={2.5} />
              </div>
              <h3 className="text-3xl font-bold mb-4">Deep Exploration</h3>
              <p className="text-lg text-text-muted font-medium">
                Browse a catalogue of {stats.books_count > 0 ? `${stats.books_count} books` : 'our books'} across {stats.authors_count > 0 ? `${stats.authors_count} authors` : 'our authors'} and {stats.categories_count > 0 ? `${stats.categories_count} genres` : 'our genres'} to uncover hidden gems you won't find anywhere else.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="p-12 hover:bg-bg-base transition-colors group">
              <div className="w-16 h-16 bg-accent-red border-[3px] border-border shadow-brutal flex items-center justify-center mb-8 group-hover:-translate-y-2 transition-transform">
                <Share2 className="w-8 h-8 text-white" strokeWidth={2.5} />
              </div>
              <h3 className="text-3xl font-bold mb-4">Explainable Picks</h3>
              <p className="text-lg text-text-muted font-medium">Understand exactly why a book was recommended: shared genres, ratings, popularity and which of your friends have read it.</p>
            </div>

            {/* Feature 3 */}
            <div className="p-12 hover:bg-bg-base transition-colors group">
              <div className="w-16 h-16 bg-accent-teal border-[3px] border-border shadow-brutal flex items-center justify-center mb-8 group-hover:-translate-y-2 transition-transform">
                <BookOpen className="w-8 h-8 text-text-main" strokeWidth={2.5} />
              </div>
              <h3 className="text-3xl font-bold mb-4">Reading Diary</h3>
              <p className="text-lg text-text-muted font-medium">Log every book you finish with a rating and a review, and compare your library with your friends.</p>
            </div>

          </div>
        </div>
      </section>
    </div>
  );
};

export default HomePage;
