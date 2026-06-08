import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getUserLibrary, getUserFollowedAuthors } from '../services/api';
import BookCard from '../components/BookCard';
import { BookMarked, Loader2 } from 'lucide-react';
import NeoButton from '../components/NeoButton';

const MyLibraryPage = () => {
  const { currentUser, loginWithGoogle } = useAuth();
  const [books, setBooks] = useState([]);
  const [authors, setAuthors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchLibrary = async () => {
      if (!currentUser) {
        setLoading(false);
        return;
      }
      
      try {
        setLoading(true);
        const [libraryBooks, followedAuthors] = await Promise.all([
          getUserLibrary(currentUser.uid),
          getUserFollowedAuthors(currentUser.uid)
        ]);
        setBooks(libraryBooks);
        setAuthors(followedAuthors);
      } catch (err) {
        setError('Failed to load library');
      } finally {
        setLoading(false);
      }
    };

    fetchLibrary();
  }, [currentUser]);

  if (!currentUser) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 flex flex-col items-center justify-center min-h-[60vh]">
        <BookMarked className="w-24 h-24 mb-6 text-accent-blue" />
        <h1 className="text-4xl md:text-5xl font-black text-center mb-6 uppercase tracking-tight text-text-main">
          Your Personal Library
        </h1>
        <p className="text-xl text-text-muted mb-8 text-center max-w-2xl font-medium">
          Sign in to save books, keep track of your reading list, and get personalized recommendations.
        </p>
        <NeoButton onClick={loginWithGoogle} variant="primary" size="lg" className="w-full sm:w-auto text-lg">
          Sign In with Google
        </NeoButton>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="mb-12 border-b-4 border-border pb-6 flex items-center justify-between">
        <h1 className="text-5xl md:text-6xl font-black uppercase tracking-tighter text-text-main flex items-center">
          <BookMarked className="w-12 h-12 mr-4 text-accent-blue" strokeWidth={3} />
          My Library
        </h1>
        <div className="hidden sm:block text-right">
          <p className="font-pixel text-text-muted text-sm uppercase tracking-widest">
            {books.length} Books Saved
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-24">
          <Loader2 className="w-16 h-16 animate-spin text-accent-red mb-4" />
          <p className="font-pixel text-xl animate-pulse">Loading collection...</p>
        </div>
      ) : error ? (
        <div className="bg-accent-red text-white p-6 border-brutal shadow-brutal font-bold text-lg">
          Error: {error}
        </div>
      ) : books.length === 0 ? (
        <div className="bg-surface-white border-[3px] border-border shadow-brutal p-12 text-center">
          <h2 className="text-3xl font-black mb-4">Your Library is Empty</h2>
          <p className="text-lg text-text-muted mb-8">Start exploring and save books you're interested in.</p>
          <NeoButton onClick={() => window.location.href='/search'} variant="secondary" size="lg">
            Explore Books
          </NeoButton>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {books.map((book, i) => (
            <BookCard 
              key={book.title} 
              book={book} 
              colorScheme={['white', 'red', 'blue', 'teal'][i % 4]} 
            />
          ))}
        </div>
      )}

      {/* Authors Section */}
      {authors.length > 0 && (
        <div className="mt-16">
          <div className="mb-8 border-b-4 border-border pb-4">
            <h2 className="text-4xl font-black uppercase tracking-tighter text-text-main">
              Authors You Follow
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {authors.map((author, i) => (
              <div 
                key={author.name} 
                className="bg-surface-white border-[3px] border-border shadow-brutal p-6 flex items-center gap-6 cursor-pointer hover:-translate-y-1 transition-transform"
                onClick={() => window.location.href = `/author/${encodeURIComponent(author.name)}`}
              >
                <img 
                  src={author.image_url} 
                  alt={author.name} 
                  className="w-20 h-20 rounded-full border-2 border-border object-cover bg-bg-base"
                />
                <div>
                  <h3 className="font-bold text-xl">{author.name}</h3>
                  <p className="font-pixel text-text-muted text-xs uppercase mt-2">{author.book_count} Books</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default MyLibraryPage;
