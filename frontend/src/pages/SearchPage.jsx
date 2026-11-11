import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Search, Loader2, AlertCircle, BookOpen, Users, Folder, UserCheck, Heart } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import BookCard from '../components/BookCard';
import NeoButton from '../components/NeoButton';
import { searchBooks, followAuthor, unfollowAuthor, getGenres, getLanguages } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

const SearchPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialQuery = searchParams.get('q') || '';
  const genreFilter = searchParams.get('genre') || '';
  const languageFilter = searchParams.get('language') || '';
  const ratingFilter = searchParams.get('min_rating') || '';
  const hasFilters = !!(genreFilter || languageFilter || ratingFilter);
  const [genreOptions, setGenreOptions] = useState([]);
  const [languageOptions, setLanguageOptions] = useState([]);

  useEffect(() => {
    getGenres().then(setGenreOptions).catch(() => {});
    getLanguages().then(setLanguageOptions).catch(() => {});
  }, []);

  const setFilter = (key, value) => {
    const next = Object.fromEntries(searchParams.entries());
    if (value) next[key] = value;
    else delete next[key];
    setSearchParams(next);
  };
  
  const { currentUser, loginWithGoogle } = useAuth();
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState({ books: [], authors: [], genres: [] });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [activeTab, setActiveTab] = useState('all');
  const [actionLoading, setActionLoading] = useState({});

  useEffect(() => {
    if (initialQuery || hasFilters) {
      performSearch(initialQuery);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialQuery, genreFilter, languageFilter, ratingFilter, currentUser]); // Re-search when user changes to fetch correct follow state

  const performSearch = async (searchQuery) => {
    if (!searchQuery.trim() && !hasFilters) return;
    
    setIsLoading(true);
    setError(null);
    setHasSearched(true);
    
    try {
      const filters = {};
      if (genreFilter) filters.genre = genreFilter;
      if (languageFilter) filters.language = languageFilter;
      if (ratingFilter) filters.min_rating = ratingFilter;
      const data = await searchBooks(searchQuery, filters);
      setResults(data);
    } catch (err) {
      setError('Search failed. Please try again.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (query !== initialQuery) {
      setFilter('q', query.trim());
    } else {
      performSearch(query);
    }
  };

  const handleFollowToggle = async (e, authorName, isCurrentlyFollowed) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!currentUser) {
      try {
        await loginWithGoogle();
        return; // Return and let useEffect refetch with authenticated follow status
      } catch (err) {
        console.error("Login failed:", err);
        return;
      }
    }

    setActionLoading(prev => ({ ...prev, [authorName]: true }));
    try {
      if (isCurrentlyFollowed) {
        await unfollowAuthor(authorName);
      } else {
        await followAuthor(authorName);
      }
      
      // Update local state instantaneously
      setResults(prev => ({
        ...prev,
        authors: prev.authors.map(a => 
          a.name === authorName ? { ...a, is_followed: !isCurrentlyFollowed } : a
        )
      }));
    } catch (err) {
      console.error("Failed to toggle follow status:", err);
    } finally {
      setActionLoading(prev => ({ ...prev, [authorName]: false }));
    }
  };

  const handleGenreClick = (genreName) => {
    setQuery('');
    setSearchParams({ genre: genreName });
  };

  const colorPalettes = ['white', 'red', 'blue', 'teal'];
  const hasResults = results.books.length > 0 || results.authors.length > 0 || results.genres.length > 0;

  return (
    <div className="min-h-screen bg-bg-base py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        
        {/* Search Header */}
        <div className="mb-12">
          <h1 className="text-5xl md:text-7xl font-black mb-8 text-text-main flex items-center">
            <span className="font-pixel text-accent-red mr-4">_</span> Explore
          </h1>
          
          <form onSubmit={handleSearchSubmit} className="relative flex flex-col md:flex-row gap-4">
            <div className="relative flex-grow">
              <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
                <Search className="h-7 w-7 text-text-main" strokeWidth={3} />
              </div>
              <input
                type="text"
                className="w-full pl-16 pr-6 py-5 bg-surface-white border-[3px] border-border shadow-brutal text-xl md:text-2xl font-bold placeholder-text-muted focus:outline-none focus:shadow-brutal-hover focus:translate-x-[2px] focus:translate-y-[2px] transition-all"
                placeholder="Search books, authors, genres or ISBN..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <NeoButton type="submit" size="lg" variant="navy" className="md:w-48 text-xl" disabled={isLoading}>
              {isLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : 'Search'}
            </NeoButton>
          </form>

          {/* Filters */}
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <span className="font-pixel text-xl uppercase tracking-widest">Filter:</span>
            <select
              aria-label="Genre"
              value={genreFilter}
              onChange={(e) => setFilter('genre', e.target.value)}
              className="px-3 py-2 border-[3px] border-border bg-surface-white font-bold shadow-brutal max-w-[14rem]"
            >
              <option value="">All genres</option>
              {genreOptions.map((g) => (
                <option key={g.genre_id} value={g.name}>{g.name} ({g.book_count})</option>
              ))}
            </select>
            <select
              aria-label="Language"
              value={languageFilter}
              onChange={(e) => setFilter('language', e.target.value)}
              className="px-3 py-2 border-[3px] border-border bg-surface-white font-bold shadow-brutal"
            >
              <option value="">Any language</option>
              {languageOptions.map((l) => (
                <option key={l.language} value={l.language}>{l.language.toUpperCase()} ({l.book_count})</option>
              ))}
            </select>
            <select
              aria-label="Minimum rating"
              value={ratingFilter}
              onChange={(e) => setFilter('min_rating', e.target.value)}
              className="px-3 py-2 border-[3px] border-border bg-surface-white font-bold shadow-brutal"
            >
              <option value="">Any rating</option>
              {[4.5, 4, 3.5, 3].map((r) => <option key={r} value={r}>{r}+ stars</option>)}
            </select>
            {hasFilters && (
              <button className="font-bold underline" onClick={() => setSearchParams(initialQuery ? { q: initialQuery } : {})}>
                Clear filters
              </button>
            )}
          </div>
        </div>

        {/* Status Messages */}
        <AnimatePresence>
          {error && (
            <motion.div 
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="bg-accent-red border-[3px] border-border shadow-brutal p-6 mb-12 flex items-start text-white animate-bounce"
            >
              <AlertCircle className="w-8 h-8 mr-4 flex-shrink-0" strokeWidth={2.5} />
              <div>
                <h3 className="font-pixel text-xl tracking-widest uppercase mb-1">System Error</h3>
                <p className="font-bold text-lg">{error}</p>
              </div>
            </motion.div>
          )}

          {hasSearched && !isLoading && !hasResults && !error && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="bg-surface-white border-[3px] border-border border-dashed p-16 text-center shadow-brutal"
            >
              <p className="font-pixel text-2xl text-text-muted tracking-widest uppercase">0 Matches</p>
              <p className="text-xl font-bold mt-4">No matching books, authors, or genres found{initialQuery ? ` for "${initialQuery}"` : ' with these filters'}.</p>
              <p className="text-md text-text-muted mt-2">Check the spelling or try fewer words. Small typos are handled automatically.</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Search Content (Tabs & Grid) */}
        {hasSearched && !isLoading && hasResults && (
          <div>
            {/* Tabs Navigation */}
            <div className="flex flex-wrap gap-3 mb-10 border-b-[3px] border-border pb-6">
              {[
                { id: 'all', label: 'All Results', icon: <BookOpen className="w-5 h-5" /> },
                { id: 'books', label: `Books (${results.books.length})`, icon: <BookOpen className="w-5 h-5 text-accent-red" /> },
                { id: 'authors', label: `Authors (${results.authors.length})`, icon: <Users className="w-5 h-5 text-accent-teal" /> },
                { id: 'genres', label: `Genres (${results.genres.length})`, icon: <Folder className="w-5 h-5 text-accent-blue" /> }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-5 py-3 border-[3px] border-border text-lg font-bold transition-all transform shadow-brutal hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-brutal-hover ${
                    activeTab === tab.id 
                      ? 'bg-accent-navy text-white -translate-x-[2px] -translate-y-[2px] shadow-brutal-lg' 
                      : 'bg-surface-white text-text-main'
                  }`}
                >
                  {tab.icon}
                  <span>{tab.label}</span>
                </button>
              ))}
            </div>

            {/* TAB CONTENT: ALL */}
            {activeTab === 'all' && (
              <div className="space-y-12">
                {/* Author Preview Section */}
                {results.authors.length > 0 && (
                  <div>
                    <h2 className="text-3xl font-black text-text-main mb-6 flex items-center gap-2">
                      <span className="font-pixel text-accent-teal">/</span> Matching Authors
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      {results.authors.slice(0, 2).map((author, idx) => (
                        <AuthorListItem 
                          key={idx} 
                          author={author} 
                          onFollowToggle={handleFollowToggle}
                          actionLoading={actionLoading[author.name]}
                          currentUser={currentUser}
                        />
                      ))}
                    </div>
                    {results.authors.length > 2 && (
                      <button 
                        onClick={() => setActiveTab('authors')} 
                        className="mt-4 text-lg font-bold text-accent-teal hover:underline flex items-center gap-1 font-pixel tracking-wider"
                      >
                        View all {results.authors.length} authors &rarr;
                      </button>
                    )}
                  </div>
                )}

                {/* Genre Preview Section */}
                {results.genres.length > 0 && (
                  <div>
                    <h2 className="text-3xl font-black text-text-main mb-6 flex items-center gap-2">
                      <span className="font-pixel text-accent-blue">#</span> Matching Genres
                    </h2>
                    <div className="flex flex-wrap gap-4">
                      {results.genres.map((genre, idx) => (
                        <button
                          key={idx}
                          onClick={() => handleGenreClick(genre.name)}
                          className="bg-accent-blue/15 hover:bg-accent-blue/30 text-text-main px-6 py-4 border-[3px] border-border shadow-brutal hover:shadow-brutal-hover hover:translate-x-[2px] hover:translate-y-[2px] font-bold text-lg flex items-center gap-3 transition-all cursor-pointer"
                        >
                          <Folder className="w-6 h-6 text-accent-blue" strokeWidth={2.5} />
                          <span>{genre.name}</span>
                          <span className="bg-surface-white text-text-main border-2 border-border px-2 py-0.5 text-xs font-pixel">
                            {genre.book_count} books
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Books Section */}
                {results.books.length > 0 && (
                  <div>
                    <h2 className="text-3xl font-black text-text-main mb-6 flex items-center gap-2">
                      <span className="font-pixel text-accent-red">_</span> Matching Books
                    </h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8 gap-y-12">
                      {results.books.map((book, idx) => (
                        <BookCard
                          key={book.book_id}
                          book={book}
                          source="search"
                          colorScheme={colorPalettes[idx % colorPalettes.length]} 
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB CONTENT: BOOKS */}
            {activeTab === 'books' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8 gap-y-12">
                {results.books.map((book, idx) => (
                  <BookCard
                    key={book.book_id}
                    book={book}
                    source="search"
                    colorScheme={colorPalettes[idx % colorPalettes.length]} 
                  />
                ))}
              </div>
            )}

            {/* TAB CONTENT: AUTHORS */}
            {activeTab === 'authors' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {results.authors.map((author, idx) => (
                  <AuthorListItem 
                    key={idx} 
                    author={author} 
                    onFollowToggle={handleFollowToggle}
                    actionLoading={actionLoading[author.name]}
                    currentUser={currentUser}
                  />
                ))}
              </div>
            )}

            {/* TAB CONTENT: GENRES */}
            {activeTab === 'genres' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {results.genres.map((genre, idx) => (
                  <div
                    key={idx}
                    onClick={() => handleGenreClick(genre.name)}
                    className="bg-surface-white border-[3px] border-border p-6 shadow-brutal hover:shadow-brutal-hover hover:translate-x-[2px] hover:translate-y-[2px] transition-all cursor-pointer flex flex-col justify-between h-40 group"
                  >
                    <div className="flex justify-between items-start">
                      <div className="bg-accent-blue/15 border-2 border-border p-2 group-hover:bg-accent-blue/30 transition-all">
                        <Folder className="w-8 h-8 text-accent-blue" strokeWidth={2.5} />
                      </div>
                      <span className="font-pixel text-xl bg-bg-base border-2 border-border px-3 py-1">
                        {genre.book_count} books
                      </span>
                    </div>
                    <h3 className="text-2xl font-black group-hover:text-accent-blue transition-colors">
                      {genre.name}
                    </h3>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

/* Neo-Brutalist Author List Item Component */
const AuthorListItem = ({ author, onFollowToggle, actionLoading, currentUser }) => {
  const bioSnippet = author.description 
    ? (author.description.length > 140 ? author.description.slice(0, 140) + "..." : author.description)
    : "No biography available yet.";

  return (
    <div className="bg-surface-white border-[3px] border-border p-6 shadow-brutal hover:shadow-brutal-hover hover:translate-x-[2px] hover:translate-y-[2px] transition-all flex flex-col sm:flex-row gap-6 relative overflow-hidden">
      {/* Author Image Frame */}
      <Link to={`/author/${author.name}`} className="w-28 h-28 sm:w-36 sm:h-36 border-[3px] border-border bg-bg-base overflow-hidden flex-shrink-0 shadow-brutal transform rotate-2 hover:rotate-0 transition-transform">
        {author.image_url ? (
          <img 
            src={author.image_url} 
            alt={author.name} 
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-accent-teal/10 font-pixel text-4xl text-accent-teal">
            {author.name.charAt(0)}
          </div>
        )}
      </Link>

      {/* Author Text & Action */}
      <div className="flex-grow flex flex-col justify-between">
        <div>
          <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
            <Link to={`/author/${author.name}`} className="hover:text-accent-teal transition-colors">
              <h3 className="text-2xl font-black">{author.name}</h3>
            </Link>
            <span className="bg-bg-base border-2 border-border px-2.5 py-0.5 text-sm font-pixel font-bold">
              {author.book_count} Books
            </span>
          </div>
          <p className="text-text-muted font-medium text-sm leading-relaxed mb-4">
            {bioSnippet}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link to={`/author/${author.name}`}>
            <NeoButton size="sm" variant="white">
              View Profile
            </NeoButton>
          </Link>

          <button
            disabled={actionLoading}
            onClick={(e) => onFollowToggle(e, author.name, author.is_followed)}
            className={`flex items-center gap-2 border-2 border-border px-4 py-2 text-sm font-bold shadow-brutal hover:shadow-brutal-hover hover:translate-x-[1px] hover:translate-y-[1px] transition-all cursor-pointer ${
              author.is_followed 
                ? 'bg-accent-teal text-white' 
                : 'bg-surface-white text-text-main hover:bg-accent-teal/10'
            }`}
          >
            {actionLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : author.is_followed ? (
              <>
                <UserCheck className="w-4 h-4" />
                <span>Followed</span>
              </>
            ) : (
              <>
                <Heart className="w-4 h-4" />
                <span>{currentUser ? 'Follow' : 'Login to Follow'}</span>
              </>
            )}
          </button>
        </div>
      </div>
      
    </div>
  );
};

export default SearchPage;
