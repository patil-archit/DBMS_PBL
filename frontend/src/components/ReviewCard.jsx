import React, { useCallback, useState } from 'react';
import { Flag, Heart, MessageSquare } from 'lucide-react';
import NeoButton, { cn } from './NeoButton';
import Comments from './Comments';
import { Avatar, ErrorBox, Field, Modal, Stars, TextArea, UserLink, formatDate } from './ui';
import { useAuth } from '../contexts/AuthContext';
import { commentReview, errorMessage, getReviewComments, likeReview, reportReview } from '../services/api';

const ReviewCard = ({ review }) => {
  const { me, loginWithGoogle } = useAuth();
  const [likes, setLikes] = useState({ liked: review.liked_by_me, count: review.like_count });
  const [showComments, setShowComments] = useState(false);
  const [commentCount, setCommentCount] = useState(review.comment_count);
  const [reportOpen, setReportOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [reported, setReported] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(() => getReviewComments(review.entry_id), [review.entry_id]);
  const post = useCallback((text) => commentReview(review.entry_id, text), [review.entry_id]);
  const isMine = me?.user_id === review.user_id;

  const toggleLike = async () => {
    if (!me) return loginWithGoogle();
    const r = await likeReview(review.entry_id);
    setLikes({ liked: r.liked, count: r.like_count });
  };

  const sendReport = async () => {
    try {
      await reportReview(review.entry_id, reason);
      setReported(true);
      setReportOpen(false);
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  return (
    <article className="border-t border-border pt-5 pb-2">
      <header className="flex flex-wrap items-center gap-3 mb-3">
        <Avatar username={review.username} />
        <div className="min-w-0">
          <UserLink username={review.username} />
          <div className="label">{formatDate(review.date_read || review.created_at)}</div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Stars value={review.rating} />
          {review.is_liked && <Heart className="w-4 h-4 text-accent-red fill-accent-red" aria-label="Liked the book" />}
        </div>
      </header>
      {review.review_text ? (
        <p className="font-serif text-[1.35rem] leading-[1.35] whitespace-pre-wrap break-words">“{review.review_text}”</p>
      ) : (
        <p className="text-text-muted font-serif text-lg">Rated without a review.</p>
      )}
      <footer className="flex flex-wrap items-center gap-4 mt-4 text-[12px]">
        <button onClick={toggleLike} aria-pressed={likes.liked} className={cn('flex items-center gap-1', likes.liked && 'text-accent-red')}>
          <Heart className={cn('w-4 h-4', likes.liked && 'fill-current')} /> {likes.count}
        </button>
        <button onClick={() => setShowComments(!showComments)} className="flex items-center gap-1">
          <MessageSquare className="w-4 h-4" /> {commentCount}
        </button>
        {me && !isMine && (
          <button
            onClick={() => setReportOpen(true)}
            disabled={reported}
            className="ml-auto flex items-center gap-1 text-text-muted hover:text-accent-red"
          >
            <Flag className="w-4 h-4" /> {reported ? 'Reported' : 'Report'}
          </button>
        )}
      </footer>
      {showComments && <Comments load={load} post={post} onCountChange={setCommentCount} />}

      <Modal open={reportOpen} onClose={() => setReportOpen(false)} title="Report review">
        <ErrorBox>{error}</ErrorBox>
        <Field label="Why should a moderator look at this?">
          <TextArea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Spoilers, spam, abuse…" maxLength={500} />
        </Field>
        <div className="flex justify-end gap-3">
          <NeoButton variant="white" onClick={() => setReportOpen(false)}>Cancel</NeoButton>
          <NeoButton variant="primary" onClick={sendReport} disabled={reason.trim().length < 3}>Send report</NeoButton>
        </div>
      </Modal>
    </article>
  );
};

export default ReviewCard;
