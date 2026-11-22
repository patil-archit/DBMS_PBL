import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Check, Plus } from 'lucide-react';
import BookCard from '../components/BookCard';
import NeoButton from '../components/NeoButton';
import { CountUp, EASE, FadeIn, RevealText, SectionTitle, Spinner } from '../components/ui';
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
        <p className="font-serif italic text-5xl mb-8">{error}</p>
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
        <div className="col-span-12 md:col-span-4">
          <motion.div
            initial={{ clipPath: 'inset(100% 0 0 0)' }}
            animate={{ clipPath: 'inset(0% 0 0 0)' }}
            transition={{ duration: 1.2, ease: EASE }}
            className="aspect-[4/5] rounded-[4px] overflow-hidden bg-text-main max-w-[380px]"
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
              <span className="w-full h-full flex items-center justify-center font-serif italic text-[10rem] text-bg-base">{author.name[0]}</span>
            )}
          </motion.div>
        </div>
        <div className="col-span-12 md:col-span-8">
          <RevealText as="h1" delay={0.2} className="font-wide font-medium text-[clamp(2.6rem,8vw,8rem)] leading-[0.9] tracking-[-0.03em]">
            <span>{first}</span>
            {rest.length > 0 && <span className="font-serif italic normal-case tracking-[-0.01em] text-accent-red">{rest.join(' ')}</span>}
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
          <p className="label mb-4">Biography</p>
          <p className={`font-serif text-[clamp(1.3rem,2.2vw,1.9rem)] leading-[1.3] ${more ? '' : 'line-clamp-[8]'}`}>{bio}</p>
          {bio.length > 500 && <button onClick={() => setMore(!more)} className="label !text-text-main link-under mt-4">{more ? 'Show less' : 'Read more'}</button>}
        </FadeIn>
        <div className="col-span-12 lg:col-span-4 lg:col-start-9 grid grid-cols-2 gap-x-6 gap-y-10 content-start">
          {[
            ['Books', s.total_books],
            ['Avg rating', null, Number(s.avg_rating || 0).toFixed(2)],
            ['Ratings', s.total_ratings],
            ['Pages', s.total_pages],
          ].map(([k, v, text]) => (
            <FadeIn key={k}>
              <p className="display-num text-[clamp(2.4rem,4vw,4rem)] tabular-nums">{text ?? <CountUp value={Number(v) || 0} />}</p>
              <p className="label mt-2">{k}</p>
            </FadeIn>
          ))}
        </div>
      </div>

      {author.genres.length > 0 && (
        <section className="mb-20">
          <SectionTitle mark="( Writes in )">Genres</SectionTitle>
          <div className="flex flex-wrap gap-2 mt-6">
            {author.genres.map((g) => (
              <Link key={g} to={`/explore?genre=${encodeURIComponent(g)}`} className="h-10 px-4 rounded-full border border-border text-[14px] inline-flex items-center hover:bg-text-main hover:text-bg-base transition-colors">{g}</Link>
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
