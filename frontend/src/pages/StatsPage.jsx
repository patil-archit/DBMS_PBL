import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { cn } from '../components/NeoButton';
import { CountUp, CoverImage, EASE, Empty, ErrorBox, FadeIn, Page, PageTitle, Spinner } from '../components/ui';
import { errorMessage, getReadingStats } from '../services/api';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const Block = ({ label, children, className }) => (
  <FadeIn className={cn('border-t border-border pt-3', className)}>
    <p className="label mb-6">{label}</p>
    {children}
  </FadeIn>
);

const Highlight = ({ title, book, note }) =>
  book ? (
    <Link to={`/book/${encodeURIComponent(book.title)}`} data-cursor="Open" className="group block">
      <p className="label mb-3">{title}</p>
      <div className="aspect-[2/3] rounded-[3px] overflow-hidden shadow-cover transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:-translate-y-2">
        <CoverImage book={book} />
      </div>
      <p className="text-[13px] font-medium mt-3 line-clamp-2">{book.title}</p>
      <p className="label mt-0.5">{note}</p>
    </Link>
  ) : null;

const StatsPage = () => {
  const { username } = useParams();
  const [year, setYear] = useState(new Date().getFullYear());
  const [stats, setStats] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    setStats(null);
    getReadingStats(username, year === 'all' ? null : year)
      .then((s) => {
        // If this year is empty but other years exist, jump to the latest one
        if (!s.totals.entries && s.years.length && year !== 'all' && !s.years.includes(year)) setYear(s.years[0]);
        else setStats(s);
      })
      .catch((e) => setError(errorMessage(e)));
  }, [username, year]);

  if (error) return <Page><ErrorBox>{error}</ErrorBox></Page>;
  if (!stats) return <Spinner label="Counting pages" />;

  const t = stats.totals;
  const monthMax = Math.max(1, ...stats.months.map((m) => m.books));
  const byMonth = MONTHS.map((_, i) => stats.months.find((m) => m.month === i + 1) || { month: i + 1, books: 0, pages: 0 });
  const ratingSteps = [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5];
  const ratingMax = Math.max(1, ...stats.ratings.map((r) => r.n));
  const genreMax = Math.max(1, ...stats.genres.map((g) => g.books));
  const mobyDicks = t.pages / 635;
  const busiest = byMonth.reduce((a, b) => (b.books > a.books ? b : a), byMonth[0]);
  // Show each book once: a later highlight is dropped if an earlier one already used it
  const h = {};
  const used = new Set();
  ['favourite', 'longest', 'shortest', 'oldest', 'hidden_gem'].forEach((k) => {
    const b = stats.highlights[k];
    if (b && !used.has(b.book_id)) { h[k] = b; used.add(b.book_id); }
  });
  const yearLabel = year === 'all' ? 'all time' : year;

  return (
    <Page>
      <PageTitle animal="bear" prop="glasses"
        kicker={<Link to={`/u/${username}`} className="link-under">@{username}</Link>}
        right={
          <div className="flex flex-wrap gap-2 justify-end">
            {['all', ...stats.years].map((y) => (
              <button key={y} onClick={() => setYear(y)} className={cn('h-8 px-3.5 rounded-full border text-[12px]', year === y ? 'bg-text-main text-bg-base border-text-main' : 'border-border hover:border-text-main')}>
                {y === 'all' ? 'All time' : y}
              </button>
            ))}
          </div>
        }
      >
        <span>{year === 'all' ? 'A life' : year}</span>
        <span className="font-serif normal-case text-accent-red">in books</span>
      </PageTitle>

      {!t.entries ? (
        <Empty title="Nothing logged here yet">Either no books were logged for {yearLabel}, or this diary is private.</Empty>
      ) : (
        <div className="space-y-20">
          {/* Headline numbers */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-y-10 gap-x-6">
            {[
              ['Books', t.books],
              ['Pages', t.pages],
              ['Reviews', t.reviews],
              ['Liked', t.liked],
              ['Re-reads', t.rereads],
            ].map(([k, v]) => (
              <FadeIn key={k}>
                <p className="display-num text-[clamp(3rem,7vw,6.5rem)] tabular-nums"><CountUp value={v} /></p>
                <p className="label mt-3">{k}</p>
              </FadeIn>
            ))}
          </div>

          {/* Sentence summary */}
          <FadeIn>
            <p className="font-serif text-[clamp(1.8rem,4vw,3.6rem)] leading-[1.08] max-w-5xl">
              {`@${username}`} read <span className="text-accent-red">{t.books} {t.books === 1 ? 'book' : 'books'}</span> in {yearLabel},
              about <span className="">{mobyDicks >= 1 ? `${mobyDicks.toFixed(1)} Moby-Dicks` : `${Math.round(mobyDicks * 100)}% of Moby-Dick`}</span> of pages
              {t.avg_rating ? <>, with an average rating of <span className="">{Number(t.avg_rating).toFixed(2)}★</span></> : null}
              {stats.vs_crowd !== null && stats.vs_crowd !== undefined && (
                <>, {Math.abs(stats.vs_crowd) < 0.1 ? 'right in line with everyone else' : stats.vs_crowd > 0 ? `${stats.vs_crowd}★ kinder than the crowd` : `${Math.abs(stats.vs_crowd)}★ harsher than the crowd`}</>
              )}.
              {busiest.books > 0 && year !== 'all' && <> The busiest month was <span className="">{MONTHS[busiest.month - 1]}</span>.</>}
            </p>
          </FadeIn>

          <div className="grid lg:grid-cols-2 gap-16">
            {/* Months */}
            <Block label="Books per month">
              <div className="flex items-end gap-2 h-48">
                {byMonth.map((m, i) => (
                  <div key={m.month} className="flex-1 h-full flex flex-col justify-end items-center gap-2 group">
                    <span className="label tabular-nums opacity-0 group-hover:opacity-100 transition-opacity">{m.books}</span>
                    <motion.div
                      className={cn('w-full rounded-t-[2px] origin-bottom', m.month === busiest.month && m.books ? 'bg-accent-red' : 'bg-text-main')}
                      style={{ height: `${(m.books / monthMax) * 100}%`, minHeight: m.books ? 4 : 1, opacity: m.books ? 1 : 0.15 }}
                      initial={{ scaleY: 0 }}
                      whileInView={{ scaleY: 1 }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.9, ease: EASE, delay: i * 0.04 }}
                    />
                    <span className="label">{MONTHS[i][0]}</span>
                  </div>
                ))}
              </div>
            </Block>

            {/* Ratings */}
            <Block label="How they rated">
              <div className="flex items-end gap-2 h-48">
                {ratingSteps.map((r, i) => {
                  const n = stats.ratings.find((x) => Number(x.rating) === r)?.n || 0;
                  return (
                    <div key={r} className="flex-1 h-full flex flex-col justify-end items-center gap-2 group">
                      <span className="label tabular-nums opacity-0 group-hover:opacity-100 transition-opacity">{n}</span>
                      <motion.div
                        className="w-full rounded-t-[2px] origin-bottom bg-accent-red"
                        style={{ height: `${(n / ratingMax) * 100}%`, minHeight: n ? 4 : 1, opacity: n ? 0.35 + (r / 5) * 0.65 : 0.12 }}
                        initial={{ scaleY: 0 }}
                        whileInView={{ scaleY: 1 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.9, ease: EASE, delay: i * 0.04 }}
                      />
                      <span className="label tabular-nums">{r % 1 ? '' : r}</span>
                    </div>
                  );
                })}
              </div>
            </Block>
          </div>

          <div className="grid lg:grid-cols-2 gap-16">
            <Block label="Favourite genres">
              <ul className="space-y-3">
                {stats.genres.map((g, i) => (
                  <li key={g.name} className="grid grid-cols-[1fr_auto] gap-3 items-center">
                    <div>
                      <div className="flex justify-between text-[13px] mb-1.5">
                        <Link to={`/explore?genre=${encodeURIComponent(g.name)}`} className="link-draw">{g.name}</Link>
                      </div>
                      <div className="h-[3px] bg-border rounded-full overflow-hidden">
                        <motion.div className="h-full bg-text-main origin-left" style={{ width: `${(g.books / genreMax) * 100}%` }} initial={{ scaleX: 0 }} whileInView={{ scaleX: 1 }} viewport={{ once: true }} transition={{ duration: 1, ease: EASE, delay: i * 0.05 }} />
                      </div>
                    </div>
                    <span className="label tabular-nums w-8 text-right">{g.books}</span>
                  </li>
                ))}
              </ul>
            </Block>
            <Block label="Most read authors">
              <ul className="divide-y divide-border">
                {stats.authors.map((a, i) => (
                  <li key={a.name}>
                    <Link to={`/author/${encodeURIComponent(a.name)}`} className="flex items-center gap-4 py-3 group">
                      <span className="label w-5 tabular-nums">{String(i + 1).padStart(2, '0')}</span>
                      {a.photo_url ? (
                        <img src={a.photo_url} alt="" className="w-10 h-10 rounded-full object-cover grayscale group-hover:grayscale-0 transition" />
                      ) : (
                        <span className="w-10 h-10 rounded-full bg-text-main text-bg-base flex items-center justify-center font-serif ">{a.name[0]}</span>
                      )}
                      <span className="flex-1 caps font-medium text-[13px]">{a.name}</span>
                      <span className="label">{a.books} {a.books === 1 ? 'book' : 'books'}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Block>
          </div>

          <Block label="Highlights">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-6">
              <Highlight title="Top rated" book={h.favourite} note={h.favourite ? `${Number(h.favourite.my_rating).toFixed(1)}★` : ''} />
              <Highlight title="Longest" book={h.longest} note={h.longest ? `${h.longest.page_count} pages` : ''} />
              <Highlight title="Shortest" book={h.shortest} note={h.shortest ? `${h.shortest.page_count} pages` : ''} />
              <Highlight title="Oldest" book={h.oldest} note={h.oldest ? `First published ${h.oldest.pub_year}` : ''} />
              <Highlight title="Hidden gem" book={h.hidden_gem} note={h.hidden_gem ? `Only ${h.hidden_gem.ratings_count.toLocaleString()} ratings` : ''} />
            </div>
          </Block>
        </div>
      )}
    </Page>
  );
};

export default StatsPage;
