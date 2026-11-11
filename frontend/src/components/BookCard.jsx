import React from 'react';
import { Link } from 'react-router-dom';
import { Star, ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from './NeoButton';
import { logClick } from '../services/api';

const BookCard = ({ book, showScore = false, colorScheme = 'white', source }) => {
  const schemes = {
    white: "bg-surface-white",
    red: "bg-accent-red text-white",
    blue: "bg-accent-blue text-text-main",
    teal: "bg-accent-teal text-text-main"
  };

  const isDark = colorScheme === 'red' || colorScheme === 'navy';

  return (
    <Link
      to={`/book/${encodeURIComponent(book.title)}`}
      className="block group h-full"
      onClick={() => book.book_id && source && logClick(book.book_id, source)}
    >
      <motion.div 
        className={cn(
          "h-full flex flex-col border-brutal transition-all duration-300 relative",
          "shadow-brutal hover:shadow-brutal-hover hover:translate-x-[2px] hover:translate-y-[2px]",
          schemes[colorScheme]
        )}
        whileHover="hover"
      >
        {/* Top Section: Cover & Metadata */}
        <div className="relative border-b-2 border-border p-4 bg-surface-white flex-grow flex flex-col items-center">
          
          <div className="w-full aspect-[2/3] border-brutal overflow-hidden relative shadow-brutal bg-bg-base mb-4">
            {book.thumbnail ? (
              <img 
                src={book.thumbnail} 
                alt={book.title} 
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                onError={(e) => {
                  e.target.onerror = null;
                  e.target.src = "https://via.placeholder.com/300x400?text=No+Cover";
                }}
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center text-text-muted p-4 text-center border-brutal">
                <span className="font-pixel text-xs tracking-widest uppercase mb-2">Error 404</span>
                <span className="font-bold text-sm">Cover Not Found</span>
              </div>
            )}
            
            {showScore && book.score !== undefined && (
              <div className="absolute top-2 right-2 bg-accent-red text-white px-2 py-1 font-pixel text-xs border-2 border-border shadow-brutal-hover">
                Match: {book.score.toFixed(0)}
              </div>
            )}
          </div>
          
          <div className="w-full mt-auto">
            <h3 className="font-bold text-lg leading-tight line-clamp-2 mb-1 text-text-main" title={book.title}>
              {book.title}
            </h3>
            <p className="text-text-muted text-sm font-medium line-clamp-1 uppercase tracking-tight">
              {book.authors?.length > 0 ? book.authors.join(', ') : 'Unknown Author'}
            </p>
            {book.reason && (
              <p className="mt-2 text-xs font-bold bg-accent-blue/20 border-2 border-border px-2 py-1 line-clamp-2" title={book.reason}>
                {book.reason}
              </p>
            )}
          </div>
        </div>

        {/* Bottom Section: Footer Actions */}
        <div className={cn(
          "p-4 flex items-center justify-between",
          schemes[colorScheme]
        )}>
          <div className={cn(
            "flex items-center font-bold text-sm",
            isDark ? "text-white" : "text-text-main"
          )}>
            <Star className="w-4 h-4 fill-current mr-1" />
            <span>{book.average_rating ? book.average_rating.toFixed(1) : 'N/A'}</span>
          </div>
          
          <motion.div 
            variants={{
              hover: { x: 5 }
            }}
            className={cn(
              "flex items-center text-sm font-bold uppercase tracking-wider font-pixel",
              isDark ? "text-white" : "text-text-main"
            )}
          >
            Explore <ArrowRight className="w-4 h-4 ml-1" />
          </motion.div>
        </div>
      </motion.div>
    </Link>
  );
};

export default BookCard;
