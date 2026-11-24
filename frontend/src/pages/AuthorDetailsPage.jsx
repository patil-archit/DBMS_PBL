import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Check, Plus } from 'lucide-react';
import BookCard from '../components/BookCard';
import NeoButton from '../components/NeoButton';
import { CountUp, EASE, FadeIn, RevealText, SectionTitle, Spinner } from '../components/ui';
import { DogEar } from '../components/Dogs';
import { followAuthor, getAuthor, unfollowAuthor } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

const AuthorDetailsPage = () => {
  const { name } = useParams();
  const navigate = useNavigate();
  const { currentUser, loginWithGoogle } = useAuth();
  const [author, setAuthor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [more, setMore] = useState(false);

  useEffect(() => {
    setLoading(true);
    setError(null);
    setImgError(false);
    getAuthor(name)
      .then(setAuthor)
      .catch(() => setError('Author not found.'))
      .finally(() => setLoading(false));
  }, [name, currentUser]);

  const toggleFollow = async () => {
    if (!currentUser) { loginWithGoogle(); return; }
    setBusy(true);
    try {
      await (author.is_followed ? unfollowAuthor(author.name) : followAuthor(author.name));
      setAuthor((a) => ({ ...a, is_followed: !a.is_followed }));
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <Spinner label="Finding the author" />;
  if (error || !author) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center p-6 text-center">
        <p className="font-serif text-5xl mb-8">{error}</p>
        <NeoButton onClick={() => navigate('/search')}>Back to search</NeoButton>
      </div>
    );
  }

  const s = author.stats;
  const [first, ...rest] = author.name.split(' ');
  const bio = author.description || 'No biography available yet.';

  return (
    <div className="max-w-[1400px] mx-auto px-5 sm:px-8 lg:px-10 pt-4 pb-24">
      <div className="flex items-center justify-between border-t border-border pt-3 mb-10">
        <button onClick={() => navigate(-1)} className="label !text-text-main flex items-center gap-1.5 group">
          <ArrowLeft className="w-3 h-3 transition-transform group-hover:-translate-x-1" /> Back
        </button>
        <span className="label">( Author ) {s.total_books} books in the catalogue</span>
      </div>

      <section className="grid grid-cols-12 gap-6 lg:gap-10 mb-24 items-end">
        <div className="col-span-12 md:col-span-4 relative max-w-[380px]">
          <motion.div
            initial={{ clipPath: 'inset(100% 0 0 0)' }}
            animate={{ clipPath: 'inset(0% 0 0 0)' }}
            transition={{ duration: 1.2, ease: EASE }}
            className="aspect-square rounded-full overflow-hidden bg-red"
          >
            {author.image_url && !imgError ? (
              <motion.img
                initial={{ scale: 1.3 }}
                animate={{ scale: 1 }}
                transition={{ duration: 1.6, ease: EASE }}
                src={author.image_url}
                alt={author.name}
                onError={() => setImgError(true)}
                className="w-full h-full object-cover grayscale hover:grayscale-0 transition-[filter] duration-700"
              />
            ) : (
              <span className="w-full h-full flex items-center justify-center font-display text-[10rem] text-[#FBFBF4]">{author.name[0]}</span>
            )}
          </motion.div>
          <motion.div initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 1, ease: EASE, delay: 0.6 }} className="absolute right-0 sm:-right-6 -bottom-6 w-28 sm:w-36">
            <DogEar animal="owl" seed={author.name.length} body={false} ribbon={false} cover="#E33529" />
          </motion.div>
        </div>
        <div className="col-span-12 md:col-span-8">
          <RevealText as="h1" delay={0.2} className="font-display text-[clamp(3.6rem,9vw,9rem)]">
            <span>{first}</span>
            {rest.length > 0 && <span className="text-red-deep">{rest.join(' ')}</span>}
          </RevealText>
          <div className="flex flex-wrap items-center gap-3 mt-8">
            <NeoButton onClick={toggleFollow} disabled={busy} variant={author.is_followed ? 'secondary' : 'primary'}>
              {author.is_followed ? <Check className="w-4 h-4 mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
              {author.is_followed ? 'Following' : currentUser ? 'Follow author' : 'Sign in to follow'}
            </NeoButton>
            <span className="label max-w-[16rem]">Followed authors feed your recommendations.</span>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-12 gap-6 lg:gap-10 mb-24">
        <FadeIn className="col-span-12 lg:col-span-7">
          <p className="caps mb-4">Biography</p>
          <p className={`text-[clamp(1.05rem,1.4vw,1.3rem)] leading-[1.55] ${more ? '' : 'line-clamp-[8]'}`}>{bio}</p>
          {bio.length > 500 && <button onClick={() => setMore(!more)} className="label !text-text-main link-under mt-4">{more ? 'Show less' : 'Read more'}</button>}
        </FadeIn>
        <div className="col-span-12 lg:col-span-4 lg:col-start-9 grid grid-cols-2 gap-3 content-start">
          {[
            ['Books', s.total_books],
            ['Avg rating', null, Number(s.avg_rating || 0).toFixed(2)],
            ['Ratings', s.total_ratings],
            ['Pages', s.total_pages],
          ].map(([k, v, text]) => (
            <FadeIn key={k} className="min-w-0 rounded-[28px] bg-surface-white p-5">
              <p className="font-display text-[clamp(1.8rem,2.6vw,2.8rem)] tabular-nums break-all">{text ?? <CountUp value={Number(v) || 0} format={(n) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e4 ? `${Math.round(n / 1e3)}K` : n.toLocaleString())} />}</p>
              <p className="caps mt-2">{k}</p>
            </FadeIn>
          ))}
        </div>
      </div>

      {author.genres.length > 0 && (
        <section className="mb-20">
          <SectionTitle mark="( Writes in )">Genres</SectionTitle>
          <div className="flex flex-wrap gap-2 mt-6">
            {author.genres.map((g) => (
              <Link key={g} to={`/explore?genre=${encodeURIComponent(g)}`} className="chip h-10 px-4 rounded-full border-2 border-border text-[17px] leading-none inline-flex items-center hover:bg-red hover:border-red hover:text-[#FBFBF4] transition-colors">{g}</Link>
            ))}
          </div>
        </section>
      )}

      <section className="mb-20">
        <SectionTitle mark={`( ${author.books.length} )`}>Books</SectionTitle>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-x-6 gap-y-12 mt-8">
          {author.books.map((b, i) => (
            <FadeIn key={b.book_id || b.title} delay={(i % 5) * 0.06}><BookCard book={b} index={i} source="author" /></FadeIn>
          ))}
        </div>
      </section>

      {author.co_authors.length > 0 && (
        <section>
          <SectionTitle mark="( Shared genres )">Readers of {first} also like</SectionTitle>
          <ul className="mt-4">
            {author.co_authors.map((co, i) => (
              <li key={co.name} className="border-b border-border">
                <Link to={`/author/${encodeURIComponent(co.name)}`} className="grid grid-cols-12 items-baseline gap-4 py-4 group">
                  <span className="col-span-1 label tabular-nums">{String(i + 1).padStart(2, '0')}</span>
                  <span className="col-span-7 font-wide font-medium text-[clamp(1rem,2.4vw,2rem)] group-hover:text-accent-red transition-colors">{co.name}</span>
                  <span className="col-span-4 label text-right">{co.shared_genres.slice(0, 3).join(', ')}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
};

export default AuthorDetailsPage;
