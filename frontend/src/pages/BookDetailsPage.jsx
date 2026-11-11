import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, BookOpen, Bookmark, Heart, Layers, ListPlus, Network, Pencil, Star, Trash2, Users } from 'lucide-react';
import BookCard from '../components/BookCard';
import NeoButton, { cn } from '../components/NeoButton';
import LogBookModal from '../components/LogBookModal';
import AddToListModal from '../components/AddToListModal';
import ReviewCard from '../components/ReviewCard';
import { Empty, SectionTitle, Spinner, Stars, UserLink, formatDate } from '../components/ui';
import { useAuth } from '../contexts/AuthContext';
import {
  deleteEntry, getBookDetails, getBookReviews, getRecommendations, removeShelf, setShelf,
} from '../services/api';

const SHELVES = [
  { id: 'want_to_read', label: 'Want to read', icon: Bookmark },
  { id: 'currently_reading', label: 'Reading now', icon: BookOpen },
];

const BookDetailsPage = () => {
  const { title } = useParams();
  const navigate = useNavigate();
  const { currentUser, loginWithGoogle, loading: authLoading } = useAuth();

  const [book, setBook] = useState(null);
  const [similar, setSimilar] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showXAI, setShowXAI] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [listOpen, setListOpen] = useState(false);

  const load = useCallback(async () => {
    const decoded = decodeURIComponent(title);
    const [b, recs] = await Promise.all([getBookDetails(decoded), getRecommendations(decoded)]);
    setBook(b);
    setSimilar(recs);
    setReviews(await getBookReviews(b.book_id));
  }, [title]);

  useEffect(() => {
    if (authLoading) return;
    setLoading(true);
    setError(null);
    window.scrollTo(0, 0);
    load()
      .catch(() => setError('Book not found.'))
      .finally(() => setLoading(false));
  }, [load, currentUser, authLoading]);

  const requireLogin = (fn) => () => (currentUser ? fn() : loginWithGoogle());

  const toggleShelf = async (status) => {
    if (book.shelf_status === status) {
      await removeShelf(book.book_id);
      setBook({ ...book, shelf_status: null });
    } else {
      await setShelf(book.book_id, status);
      setBook({ ...book, shelf_status: status });
    }
  };

  const removeEntry = async (entry) => {
    if (!window.confirm('Delete this diary entry?')) return;
    await deleteEntry(entry.entry_id);
    await load();
  };

  if (loading || authLoading) return <Spinner label="Loading book…" />;

  if (error || !book) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center p-4">
        <div className="bg-surface-white border-[4px] border-border shadow-brutal-lg p-10 text-center max-w-lg">
          <p className="text-2xl font-bold mb-8">{error || 'Book does not exist.'}</p>
          <NeoButton onClick={() => navigate('/search')} variant="primary">Back to search</NeoButton>
        </div>
      </div>
    );
  }

  const colorPalettes = ['white', 'red', 'blue', 'teal'];

  return (
    <div className="min-h-screen bg-bg-base pb-24">
      <div className="bg-surface-white border-b-[3px] border-border sticky top-20 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <button onClick={() => navigate(-1)} className="flex items-center font-bold hover:text-accent-red transition-colors">
            <ArrowLeft className="w-5 h-5 mr-2" /> Back
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-10">
        <div className="flex flex-col lg:flex-row gap-10 xl:gap-16 mb-16">
          {/* Cover */}
          <div className="lg:w-1/3 xl:w-1/4 flex-shrink-0 max-w-xs mx-auto lg:mx-0 w-full">
            <motion.div
              initial={{ x: -50, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              className="bg-accent-blue border-[4px] border-border shadow-brutal-lg p-4 rotate-[-2deg] hover:rotate-0 transition-transform duration-300"
            >
              <div className="border-[3px] border-border bg-bg-base aspect-[2/3] relative overflow-hidden">
                {book.thumbnail ? (
                  <img src={book.thumbnail} alt={book.title} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center font-pixel text-xl p-6 text-center">NO COVER</div>
                )}
                <div className="absolute top-3 right-3 bg-accent-red text-white border-[3px] border-border shadow-brutal px-3 py-1 flex items-center font-bold text-xl">
                  <Star className="w-5 h-5 fill-current mr-1" />
                  {book.average_rating ? book.average_rating.toFixed(1) : 'N/A'}
                </div>
              </div>
            </motion.div>

            {/* Actions */}
            <div className="mt-8 space-y-3">
              <NeoButton fullWidth variant="primary" onClick={requireLogin(() => { setEditing(null); setLogOpen(true); })}>
                {currentUser ? (book.my_entries.length ? 'Log again' : 'Log / Review') : 'Sign in to log'}
              </NeoButton>
              {currentUser && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    {SHELVES.map(({ id, label, icon: Icon }) => (
                      <button
                        key={id}
                        onClick={() => toggleShelf(id)}
                        aria-pressed={book.shelf_status === id}
                        className={cn(
                          'flex items-center justify-center gap-2 px-2 py-3 border-[3px] border-border font-bold text-sm shadow-brutal hover:shadow-brutal-hover',
                          book.shelf_status === id ? 'bg-accent-teal text-white' : 'bg-surface-white'
                        )}
                      >
                        <Icon className="w-4 h-4" /> {label}
                      </button>
                    ))}
                  </div>
                  <NeoButton fullWidth variant="white" onClick={() => setListOpen(true)}>
                    <ListPlus className="w-5 h-5 mr-2" /> Add to list
                  </NeoButton>
                </>
              )}
            </div>
          </div>

          {/* Info */}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="lg:flex-1 flex flex-col min-w-0">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-text-main leading-[1.05] mb-4 break-words">{book.title}</h1>
            {book.subtitle && <h2 className="text-xl sm:text-2xl font-medium text-text-muted mb-6">{book.subtitle}</h2>}

            <div className="flex flex-wrap items-center gap-3 mb-6">
              {book.authors?.map((author) => (
                <Link
                  key={author}
                  to={`/author/${encodeURIComponent(author)}`}
                  className="bg-text-main hover:bg-accent-teal transition-colors text-white font-pixel text-xl px-4 py-1.5 uppercase tracking-widest shadow-brutal border-2 border-border"
                >
                  {author}
                </Link>
              ))}
              {book.published_year && <span className="text-lg font-bold">EST. {book.published_year}</span>}
            </div>

            <div className="flex flex-wrap gap-2 mb-8">
              {book.categories?.map((cat) => (
                <Link
                  key={cat}
                  to={`/search?genre=${encodeURIComponent(cat)}`}
                  className="bg-surface-white border-[2px] border-border px-3 py-1 font-bold shadow-[2px_2px_0px_0px_#111] hover:-translate-y-0.5 transition-all"
                >
                  #{cat.toUpperCase()}
                </Link>
              ))}
            </div>

            <div className="bg-surface-white border-[3px] border-border shadow-brutal p-6 md:p-8 mb-8 relative">
              <div className="absolute -top-4 -left-4 bg-accent-teal border-2 border-border p-2 shadow-[2px_2px_0px_0px_#111]">
                <Layers className="w-6 h-6 text-white" />
              </div>
              <p className="text-lg md:text-xl leading-relaxed font-medium">{book.description || 'No description available.'}</p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
              {[
                { label: 'Pages', val: book.num_pages || 'N/A', bg: 'bg-accent-blue' },
                { label: 'Ratings', val: book.ratings_count?.toLocaleString() || '0', bg: 'bg-accent-red', text: 'text-white' },
                { label: 'ISBN', val: book.isbn13 || 'N/A', bg: 'bg-surface-white' },
                { label: 'Publisher', val: book.publisher || 'N/A', bg: 'bg-surface-white' },
              ].map((stat) => (
                <div key={stat.label} className={cn('border-[3px] border-border shadow-brutal p-4 flex flex-col justify-between min-w-0', stat.bg, stat.text)}>
                  <span className="font-pixel text-sm uppercase tracking-widest opacity-80 mb-1">{stat.label}</span>
                  <span className="font-black text-lg truncate" title={String(stat.val)}>{stat.val}</span>
                </div>
              ))}
            </div>

            {/* My diary entries */}
            {book.my_entries.length > 0 && (
              <div className="bg-accent-teal/15 border-[3px] border-border p-5 mb-6">
                <h3 className="font-black text-xl mb-3">Your diary</h3>
                <ul className="space-y-3">
                  {book.my_entries.map((e) => (
                    <li key={e.entry_id} className="flex flex-wrap items-center gap-3 bg-surface-white border-2 border-border p-3">
                      <span className="font-bold">{formatDate(e.date_read || e.created_at)}</span>
                      <Stars value={e.rating} />
                      {e.is_liked && <Heart className="w-4 h-4 text-accent-red fill-accent-red" />}
                      {e.review_text && <span className="text-text-muted truncate max-w-xs">“{e.review_text}”</span>}
                      <span className="ml-auto flex gap-2">
                        <button aria-label="Edit entry" onClick={() => { setEditing(e); setLogOpen(true); }} className="p-1 hover:text-accent-teal">
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button aria-label="Delete entry" onClick={() => removeEntry(e)} className="p-1 hover:text-accent-red">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Friends who read it */}
            {book.friends_who_read?.length > 0 && (
              <div className="bg-surface-white border-[3px] border-border p-5">
                <h3 className="font-black text-xl mb-3 flex items-center gap-2"><Users className="w-5 h-5" /> People you follow who read this</h3>
                <div className="flex flex-wrap gap-3">
                  {book.friends_who_read.map((f) => (
                    <span key={f.username} className="flex items-center gap-2 bg-bg-base border-2 border-border px-3 py-1.5">
                      <UserLink username={f.username} />
                      <Stars value={f.rating} size="w-3 h-3" />
                      {f.liked && <Heart className="w-3 h-3 text-accent-red fill-accent-red" />}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        </div>

        {/* Reviews */}
        <section className="mb-16">
          <SectionTitle mark="“" color="text-accent-red">Reviews</SectionTitle>
          {reviews.length ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {reviews.map((r) => <ReviewCard key={r.entry_id} review={r} />)}
            </div>
          ) : (
            <Empty title="No reviews yet">Be the first to log this book.</Empty>
          )}
        </section>

        {/* How recommendations work */}
        <div className="mb-12">
          <button
            className="w-full bg-accent-navy text-white border-[4px] border-border shadow-brutal p-6 flex flex-col md:flex-row items-center justify-between gap-4 text-left"
            onClick={() => setShowXAI(!showXAI)}
            aria-expanded={showXAI}
          >
            <span className="flex items-center gap-4">
              <span className="bg-accent-teal border-2 border-border p-3"><Network className="w-7 h-7 text-white" /></span>
              <span>
                <span className="block text-2xl font-black">How “You might also like” works</span>
                <span className="font-pixel text-lg text-gray-300">{showXAI ? 'Hide' : 'Show'} the scoring</span>
              </span>
            </span>
          </button>
          <AnimatePresence>
            {showXAI && (
              <motion.pre
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden bg-surface-white border-x-[4px] border-b-[4px] border-border p-6 text-sm md:text-base font-bold whitespace-pre-wrap"
              >
                {`> Find other books that share at least one genre with "${book.title}"
> Count people you follow who logged each one in their diary
> SCORE = 5 × shared genres + 3 × avg rating + 2 × ln(1 + number of ratings) + 2 × friends who read it
> Show the top 10 by score`}
              </motion.pre>
            )}
          </AnimatePresence>
        </div>

        <section>
          <SectionTitle mark="*" color="text-accent-red">You might also like</SectionTitle>
          {similar.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6 gap-y-10">
              {similar.map((rec, idx) => (
                <BookCard key={rec.book_id} book={rec} source="similar" colorScheme={colorPalettes[idx % colorPalettes.length]} />
              ))}
            </div>
          ) : (
            <Empty title="No matches">No other books share a genre with this one yet.</Empty>
          )}
        </section>
      </div>

      <LogBookModal open={logOpen} onClose={() => setLogOpen(false)} book={book} entry={editing} onSaved={load} />
      <AddToListModal open={listOpen} onClose={() => setListOpen(false)} book={book} />
    </div>
  );
};

export default BookDetailsPage;
