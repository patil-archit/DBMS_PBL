import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AnimatePresence, motion, useScroll, useTransform } from 'framer-motion';
import { ArrowLeft, Bookmark, BookOpen, Check, Heart, ListPlus, Pencil, Plus, Send, Trash2 } from 'lucide-react';
import BookCard from '../components/BookCard';
import NeoButton, { cn } from '../components/NeoButton';
import LogBookModal from '../components/LogBookModal';
import AddToListModal from '../components/AddToListModal';
import ReviewCard from '../components/ReviewCard';
import { CoverImage, EASE, Empty, FadeIn, RevealText, SectionTitle, Spinner, Stars, UserLink, formatDate } from '../components/ui';
import { useAuth } from '../contexts/AuthContext';
import { coverPalette } from '../utils/colors';
import { Book3D, DogEar } from '../components/Dogs';
import { ShareToFriend } from '../components/social';
import { deleteEntry, getBookDetails, getBookReviews, getReadersNow, getRecommendations, removeShelf, setShelf } from '../services/api';

const SHELVES = [
  { id: 'want_to_read', label: 'Want to read', icon: Bookmark },
  { id: 'currently_reading', label: 'Reading now', icon: BookOpen },
];

// About 45 pages an hour for an average adult reader
const readingTime = (pages) => {
  if (!pages) return null;
  const mins = Math.round((pages / 45) * 60);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h ? `${h}h ${m}m` : `${m}m`;
};

const titleLines = (title) =>
  title.split(' ').reduce((lines, w) => {
    const last = lines[lines.length - 1];
    if (!last || `${last} ${w}`.length > 14) lines.push(w); else lines[lines.length - 1] = `${last} ${w}`;
    return lines;
  }, []);

const BookDetailsPage = () => {
  const { title } = useParams();
  const navigate = useNavigate();
  const { currentUser, loginWithGoogle, loading: authLoading } = useAuth();

  const [book, setBook] = useState(null);
  const [similar, setSimilar] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [palette, setPalette] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showHow, setShowHow] = useState(false);
  const [more, setMore] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [listOpen, setListOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [readers, setReaders] = useState(null);
  const heroRef = useRef(null);
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ['start start', 'end start'] });
  const coverY = useTransform(scrollYProgress, [0, 1], ['0%', '18%']);

  const load = useCallback(async () => {
    const decoded = decodeURIComponent(title);
    const [b, recs] = await Promise.all([getBookDetails(decoded), getRecommendations(decoded)]);
    setBook(b);
    setSimilar(recs);
    setReviews(await getBookReviews(b.book_id));
    getReadersNow(b.book_id).then(setReaders).catch(() => setReaders(null));
  }, [title]);

  useEffect(() => {
    if (authLoading) return;
    setLoading(true);
    setError(null);
    setMore(false);
    load()
      .catch(() => setError('Book not found.'))
      .finally(() => setLoading(false));
  }, [load, currentUser, authLoading]);

  useEffect(() => {
    if (book?.thumbnail) coverPalette(book.thumbnail, 4).then(setPalette);
  }, [book?.thumbnail]);

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

  if (loading || authLoading) return <Spinner label="Opening the book" />;

  if (error || !book) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center p-6 text-center">
        <p className="font-serif text-5xl mb-8">{error || 'This book does not exist.'}</p>
        <NeoButton onClick={() => navigate('/explore')}>Back to the catalogue</NeoButton>
      </div>
    );
  }

  const meta = [
    ['Published', book.published_year || '—'],
    ['Length', book.num_pages ? `${book.num_pages} pages` : '—'],
    ['Reading time', readingTime(book.num_pages) ? `≈ ${readingTime(book.num_pages)}` : '—'],
    ['Ratings', book.ratings_count?.toLocaleString() || '0'],
    ['Publisher', book.publisher || '—'],
    ['ISBN', book.isbn13 || '—'],
    ['Language', (book.language || 'en').toUpperCase()],
  ];
  const description = book.description || 'No description available yet.';
  const longDesc = description.length > 420;

  return (
    <div className="relative">
      <div className="relative max-w-[1400px] mx-auto px-5 sm:px-8 lg:px-10 pt-4 pb-24">
        {/* Breadcrumb */}
        <div className="flex items-center justify-between mb-10">
          <button onClick={() => navigate(-1)} className="label !text-text-main flex items-center gap-1.5 group">
            <ArrowLeft className="w-3 h-3 transition-transform group-hover:-translate-x-1" /> Back
          </button>
          <span className="label truncate max-w-[60%]">
            <Link to="/explore" className="link-draw">Explore</Link>
            {book.categories?.[0] && <> / <Link to={`/explore?genre=${encodeURIComponent(book.categories[0])}`} className="link-draw">{book.categories[0]}</Link></>}
            {' / '}{book.title}
          </span>
        </div>

        {/* Hero */}
        <section ref={heroRef} className="grid grid-cols-12 gap-6 lg:gap-10 mb-24">
          <div className="col-span-12 md:col-span-5 lg:col-span-4">
            <motion.div style={{ y: coverY }} className="relative w-fit mx-auto md:mx-0 mt-6 md:ml-6">
              <motion.div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[150%] aspect-square rounded-full bg-pink"
                initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ duration: 1.1, ease: EASE }} />
              <motion.div className="relative" initial={{ rotate: -12, y: 80, opacity: 0 }} animate={{ rotate: 0, y: 0, opacity: 1 }} transition={{ duration: 1.2, ease: EASE, delay: 0.1 }}>
                <Book3D book={book} width={typeof window !== 'undefined' && window.innerWidth < 768 ? 210 : 280}><CoverImage book={book} eager /></Book3D>
              </motion.div>
              <motion.div className="absolute -right-14 -bottom-10 w-32 hidden sm:block" initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.8, duration: 0.8, ease: EASE }}>
                <DogEar body={false} ribbon={false} prop="glasses" seed={(book.book_id || 3) % 50} />
              </motion.div>
            </motion.div>
            {palette.length > 0 && (
              <div className="flex gap-1.5 mt-14 justify-center md:justify-start items-center">
                {palette.map((c, i) => (
                  <motion.span key={c + i} title={c} className="w-5 h-5 rounded-full block border border-red/20" style={{ background: c }} initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.6 + i * 0.07, duration: 0.5, ease: EASE }} />
                ))}
                <span className="caps self-center ml-2 opacity-70">Cover palette</span>
              </div>
            )}
          </div>

          <div className="col-span-12 md:col-span-7 lg:col-span-8 lg:pl-6">
            <div className="flex flex-wrap gap-x-3 gap-y-1 mb-5">
              {book.categories?.map((cat) => (
                <Link key={cat} to={`/explore?genre=${encodeURIComponent(cat)}`} className="label link-draw">{cat}</Link>
              ))}
            </div>
            <RevealText as="h1" delay={0.1} className="font-display text-[clamp(3.4rem,8vw,8rem)] break-words">
              {titleLines(book.title)}
            </RevealText>
            {book.subtitle && <p className="font-serif text-[clamp(1.2rem,2.2vw,1.9rem)] text-text-muted mt-3">{book.subtitle}</p>}

            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 mt-8">
              <span className="label">Written by</span>
              {book.authors?.map((a) => (
                <Link key={a} to={`/author/${encodeURIComponent(a)}`} className="caps font-medium text-[15px] link-under">{a}</Link>
              ))}
            </div>

            <div className="flex items-center gap-4 mt-6">
              <Stars value={book.average_rating || 0} size="w-5 h-5" />
              <span className="display-num text-[2.6rem]">{book.average_rating ? Number(book.average_rating).toFixed(2) : '–'}</span>
              <span className="label">average from<br />{book.ratings_count?.toLocaleString() || 0} ratings</span>
            </div>

            {/* Actions */}
            <div className="flex flex-wrap items-center gap-2 mt-8">
              <NeoButton size="lg" onClick={requireLogin(() => { setEditing(null); setLogOpen(true); })}>
                <Plus className="w-4 h-4 mr-2" />
                {currentUser ? (book.my_entries.length ? 'Log again' : 'Log or review') : 'Sign in to log'}
              </NeoButton>
              {currentUser && SHELVES.map(({ id, label, icon: Icon }) => (
                <NeoButton key={id} size="lg" variant={book.shelf_status === id ? 'secondary' : 'white'} onClick={() => toggleShelf(id)} aria-pressed={book.shelf_status === id}>
                  {book.shelf_status === id ? <Check className="w-4 h-4 mr-2" /> : <Icon className="w-4 h-4 mr-2" />} {label}
                </NeoButton>
              ))}
              {currentUser && (
                <NeoButton size="lg" variant="white" onClick={() => setListOpen(true)}>
                  <ListPlus className="w-4 h-4 mr-2" /> Add to list
                </NeoButton>
              )}
              {currentUser && (
                <NeoButton size="lg" variant="red" onClick={() => setShareOpen(true)}>
                  <Send className="w-4 h-4 mr-2" /> Send to a friend
                </NeoButton>
              )}
            </div>

            {readers?.count > 0 && (
              <div className="flex flex-wrap items-center gap-3 mt-6 text-[13px]">
                <span className="relative flex w-2.5 h-2.5"><span className="absolute inset-0 rounded-full bg-[#3BB273] animate-ping opacity-60" /><span className="relative w-2.5 h-2.5 rounded-full bg-[#3BB273]" /></span>
                <span><b className="font-semibold">{readers.count}</b> {readers.count === 1 ? 'reader is' : 'readers are'} reading this right now</span>
                {[...readers.friends, ...readers.others].slice(0, 5).map((u) => (
                  <Link key={u} to={`/u/${u}`} className={cn('h-7 px-2.5 rounded-full border text-[12px] inline-flex items-center', readers.friends.includes(u) ? 'border-text-main font-medium' : 'border-border text-text-muted')}>@{u}</Link>
                ))}
              </div>
            )}

            {/* Description */}
            <div className="mt-12 max-w-[44rem]">
              <p className="label mb-3">About the book</p>
              <motion.div animate={{ height: 'auto' }} className="relative overflow-hidden">
                <p className={cn('text-[16px] leading-[1.65] text-text-main/90 first-letter:font-serif first-letter:text-[3.6em] first-letter:float-left first-letter:leading-[0.8] first-letter:mr-2 first-letter:mt-1', !more && longDesc && 'line-clamp-6')}>
                  {description}
                </p>
              </motion.div>
              {longDesc && <button onClick={() => setMore(!more)} className="label !text-text-main link-under mt-3">{more ? 'Show less' : 'Read more'}</button>}
            </div>

            {/* Meta grid */}
            <dl className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-5 mt-12 border-t border-border pt-4">
              {meta.map(([k, v]) => (
                <div key={k} className="min-w-0">
                  <dt className="label">{k}</dt>
                  <dd className="value !text-[13px] mt-1 truncate" title={String(v)}>{v}</dd>
                </div>
              ))}
            </dl>

            {/* My diary */}
            {book.my_entries.length > 0 && (
              <div className="mt-12">
                <p className="label mb-3">Your diary</p>
                <ul className="divide-y divide-border border-y border-border">
                  {book.my_entries.map((e) => (
                    <li key={e.entry_id} className="flex flex-wrap items-center gap-4 py-3">
                      <span className="text-[13px] tabular-nums w-28">{formatDate(e.date_read || e.created_at)}</span>
                      <Stars value={e.rating} />
                      {e.is_liked && <Heart className="w-3.5 h-3.5 text-accent-red fill-accent-red" />}
                      {e.review_text && <span className="text-[13px] text-text-muted truncate max-w-xs font-serif ">“{e.review_text}”</span>}
                      <span className="ml-auto flex gap-1">
                        <button aria-label="Edit entry" onClick={() => { setEditing(e); setLogOpen(true); }} className="w-8 h-8 rounded-full hover:bg-text-main hover:text-bg-base flex items-center justify-center transition-colors"><Pencil className="w-3.5 h-3.5" /></button>
                        <button aria-label="Delete entry" onClick={() => removeEntry(e)} className="w-8 h-8 rounded-full hover:bg-accent-red hover:text-white flex items-center justify-center transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {book.friends_who_read?.length > 0 && (
              <div className="mt-10">
                <p className="label mb-3">People you follow who read it</p>
                <div className="flex flex-wrap gap-2">
                  {book.friends_who_read.map((f) => (
                    <span key={f.username} className="flex items-center gap-2 rounded-full border border-border px-3 h-9 text-[13px]">
                      <UserLink username={f.username} />
                      <Stars value={f.rating} size="w-3 h-3" />
                      {f.liked && <Heart className="w-3 h-3 text-accent-red fill-accent-red" />}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Reviews */}
        <section className="mb-24">
          <SectionTitle mark={`( ${reviews.length} )`}>Reviews</SectionTitle>
          {reviews.length ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
              {reviews.map((r, i) => <FadeIn key={r.entry_id} delay={(i % 2) * 0.08}><ReviewCard review={r} /></FadeIn>)}
            </div>
          ) : (
            <Empty title="No reviews yet">Be the first to log this book.</Empty>
          )}
        </section>

        {/* Similar */}
        <section>
          <SectionTitle
            mark="( More like this )"
            right={<button onClick={() => setShowHow(!showHow)} className="label link-under" aria-expanded={showHow}>{showHow ? 'Hide' : 'How is this scored?'}</button>}
          >
            You might also like
          </SectionTitle>
          <AnimatePresence>
            {showHow && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.6, ease: EASE }} className="overflow-hidden">
                <div className="grid md:grid-cols-4 gap-6 py-6 text-[13px]">
                  {[
                    ['01', 'Candidates', `Books that share at least one genre with “${book.title}”.`],
                    ['02', 'Friends', 'Count people you follow who logged each one.'],
                    ['03', 'Score', '5 × shared genres + 3 × avg rating + 2 × ln(1 + ratings) + 2 × friends who read it.'],
                    ['04', 'Rank', 'Show the top 10, computed live in PostgreSQL.'],
                  ].map(([n, t, d]) => (
                    <div key={n}>
                      <p className="display-num text-4xl text-accent-red">{n}</p>
                      <p className="caps font-medium text-[12px] mt-2 mb-1">{t}</p>
                      <p className="text-text-muted leading-snug">{d}</p>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          {similar.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-x-6 gap-y-12 mt-8">
              {similar.map((rec, i) => (
                <FadeIn key={rec.book_id} delay={(i % 5) * 0.06}><BookCard book={rec} source="similar" /></FadeIn>
              ))}
            </div>
          ) : (
            <Empty title="No matches">No other books share a genre with this one yet.</Empty>
          )}
        </section>
      </div>

      <LogBookModal open={logOpen} onClose={() => setLogOpen(false)} book={book} entry={editing} onSaved={load} />
      <AddToListModal open={listOpen} onClose={() => setListOpen(false)} book={book} />
      <ShareToFriend open={shareOpen} onClose={() => setShareOpen(false)} book={book} />
    </div>
  );
};

export default BookDetailsPage;
