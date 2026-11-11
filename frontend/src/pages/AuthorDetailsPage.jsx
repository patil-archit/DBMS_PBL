import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, AlertCircle, Heart, UserCheck, BookOpen, Star, Award, FileText, Users, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';
import BookCard from '../components/BookCard';
import NeoButton from '../components/NeoButton';
import { getAuthor, followAuthor, unfollowAuthor } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

const AuthorDetailsPage = () => {
  const { name } = useParams();
  const navigate = useNavigate();
  const { currentUser, loginWithGoogle } = useAuth();
  
  const [author, setAuthor] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [followLoading, setFollowLoading] = useState(false);
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    fetchAuthorDetails();
    setImgError(false); // Reset image error on profile change
  }, [name, currentUser]); // Refetch when name or user auth state changes

  const fetchAuthorDetails = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getAuthor(name);
      setAuthor(data);
    } catch (err) {
      console.error(err);
      setError("Failed to fetch author details.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleFollowToggle = async () => {
    if (!currentUser) {
      try {
        await loginWithGoogle();
        return;
      } catch (err) {
        console.error("Login failed:", err);
        return;
      }
    }

    setFollowLoading(true);
    try {
      if (author.is_followed) {
        await unfollowAuthor(author.name);
        setAuthor(prev => ({ ...prev, is_followed: false }));
      } else {
        await followAuthor(author.name);
        setAuthor(prev => ({ ...prev, is_followed: true }));
      }
    } catch (err) {
      console.error("Failed to toggle follow status:", err);
    } finally {
      setFollowLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-bg-base flex flex-col items-center justify-center">
        <Loader2 className="w-16 h-16 animate-spin text-accent-teal" strokeWidth={3} />
        <p className="mt-4 font-pixel text-2xl tracking-widest uppercase">Loading Author...</p>
      </div>
    );
  }

  if (error || !author) {
    return (
      <div className="min-h-screen bg-bg-base py-16 px-4">
        <div className="max-w-3xl mx-auto bg-accent-red border-[3px] border-border p-8 shadow-brutal text-white">
          <AlertCircle className="w-12 h-12 mb-4" strokeWidth={2.5} />
          <h2 className="font-pixel text-2xl tracking-widest uppercase mb-2">Error</h2>
          <p className="text-xl font-bold mb-6">{error || "Author not found in database Catalog."}</p>
          <NeoButton variant="white" onClick={() => navigate('/search')}>
            Return to Search
          </NeoButton>
        </div>
      </div>
    );
  }

  const colorPalettes = ['white', 'red', 'blue', 'teal'];

  return (
    <div className="min-h-screen bg-bg-base py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        
        {/* Back navigation */}
        <button 
          onClick={() => navigate(-1)}
          className="mb-8 flex items-center gap-2 font-pixel text-xl tracking-wider text-text-main hover:text-accent-teal transition-all group"
        >
          <ArrowLeft className="w-6 h-6 border-2 border-border p-0.5 bg-surface-white group-hover:bg-accent-teal group-hover:text-white transition-colors" strokeWidth={3} />
          <span>Go Back</span>
        </button>

        {/* Profile Hero Section */}
        <div className="bg-surface-white border-[3px] border-border p-8 md:p-12 shadow-brutal-lg mb-16 flex flex-col md:flex-row gap-10 items-start relative overflow-hidden">
          
          {/* Decorative Corner Block */}
          <div className="absolute top-0 right-0 w-24 h-24 bg-accent-teal/10 -z-0 translate-x-12 -translate-y-12 rotate-45 border-b-[3px] border-border"></div>

          {/* Portrait frame */}
          <div className="w-full md:w-64 lg:w-72 aspect-square border-[3px] border-border bg-bg-base flex-shrink-0 shadow-brutal overflow-hidden relative group">
            {author.image_url && !imgError ? (
              <img 
                src={author.image_url} 
                alt={author.name} 
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                onError={() => setImgError(true)}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-accent-teal/15 font-pixel text-7xl text-accent-teal">
                {author.name.charAt(0)}
              </div>
            )}
            <div className="absolute bottom-2 left-2 bg-accent-navy text-white font-pixel text-xs border border-border px-2 py-0.5">
              AUTHOR // {author.name.replace(/\s+/g, "_").toUpperCase()}
            </div>
          </div>

          {/* Details header */}
          <div className="flex-grow flex flex-col justify-between h-full z-10">
            <div>
              <div className="flex flex-wrap items-center justify-between gap-4 mb-6 pb-4 border-b-2 border-border">
                <h1 className="text-4xl md:text-5xl lg:text-6xl font-black text-text-main tracking-tight">
                  {author.name}
                </h1>
                
                {/* Follow Button */}
                <button
                  disabled={followLoading}
                  onClick={handleFollowToggle}
                  className={`flex items-center gap-2 border-[3px] border-border px-6 py-3 font-bold text-lg shadow-brutal hover:shadow-brutal-hover hover:translate-x-[2px] hover:translate-y-[2px] transition-all cursor-pointer ${
                    author.is_followed 
                      ? 'bg-accent-teal text-white hover:bg-accent-red hover:text-white hover:shadow-brutal' // turns to unfollow/red on hover
                      : 'bg-surface-white text-text-main hover:bg-accent-teal/10'
                  }`}
                  title={author.is_followed ? 'Click to Unfollow' : 'Click to Follow'}
                >
                  {followLoading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : author.is_followed ? (
                    <>
                      <UserCheck className="w-5 h-5" />
                      <span>Followed</span>
                    </>
                  ) : (
                    <>
                      <Heart className="w-5 h-5" />
                      <span>{currentUser ? 'Follow Author' : 'Login to Follow'}</span>
                    </>
                  )}
                </button>
              </div>
              
              <h3 className="font-pixel text-xl tracking-widest text-accent-teal uppercase mb-2">Biography</h3>
              <p className="text-lg text-text-main leading-relaxed font-semibold max-w-4xl">
                {author.description || "No biography available yet."}
              </p>
            </div>
          </div>
        </div>

        {/* Author stats dashboard */}
        <div className="mb-16">
          <h2 className="text-4xl font-black text-text-main mb-8 flex items-center gap-2">
            <span className="font-pixel text-accent-blue">#</span> Author Stats
          </h2>
          
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* PANEL 1: Key Metrics */}
            <div className="bg-surface-white border-[3px] border-border p-6 shadow-brutal flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between border-b-2 border-border pb-3 mb-6">
                  <h3 className="text-2xl font-black flex items-center gap-2">
                    <Sparkles className="w-6 h-6 text-accent-red" />
                    <span>Catalog Stats</span>
                  </h3>
                  <span className="font-pixel text-sm bg-accent-red/10 border border-border px-2">V1.0</span>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-bg-base border-2 border-border p-4 shadow-brutal-hover">
                    <BookOpen className="w-6 h-6 text-accent-red mb-2" />
                    <div className="text-3xl font-black">{author.stats.total_books}</div>
                    <div className="text-xs text-text-muted font-bold uppercase mt-1">Books Written</div>
                  </div>
                  
                  <div className="bg-bg-base border-2 border-border p-4 shadow-brutal-hover">
                    <Star className="w-6 h-6 text-accent-teal mb-2" fill="currentColor" />
                    <div className="text-3xl font-black">{author.stats.avg_rating}</div>
                    <div className="text-xs text-text-muted font-bold uppercase mt-1">Average Rating</div>
                  </div>
                  
                  <div className="bg-bg-base border-2 border-border p-4 shadow-brutal-hover">
                    <Award className="w-6 h-6 text-accent-blue mb-2" />
                    <div className="text-2xl font-black">
                      {author.stats.total_ratings >= 1000 
                        ? `${(author.stats.total_ratings / 1000).toFixed(1)}k` 
                        : author.stats.total_ratings}
                    </div>
                    <div className="text-xs text-text-muted font-bold uppercase mt-1">Global Readers</div>
                  </div>
                  
                  <div className="bg-bg-base border-2 border-border p-4 shadow-brutal-hover">
                    <FileText className="w-6 h-6 text-accent-navy mb-2" />
                    <div className="text-2xl font-black">{author.stats.total_pages}</div>
                    <div className="text-xs text-text-muted font-bold uppercase mt-1">Total Pages</div>
                  </div>
                </div>
              </div>
              <div className="text-xs text-text-muted font-bold font-pixel mt-6 text-right">
                *Calculated via direct catalog aggregation
              </div>
            </div>

            {/* PANEL 2: Primary Genres */}
            <div className="bg-surface-white border-[3px] border-border p-6 shadow-brutal flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between border-b-2 border-border pb-3 mb-6">
                  <h3 className="text-2xl font-black flex items-center gap-2">
                    <BookOpen className="w-6 h-6 text-accent-teal" />
                    <span>Primary Genres</span>
                  </h3>
                  <span className="font-pixel text-sm bg-accent-teal/10 border border-border px-2">Categorical</span>
                </div>
                
                {author.genres.length > 0 ? (
                  <div className="flex flex-wrap gap-2.5">
                    {author.genres.map((genre, idx) => (
                      <span
                        key={idx}
                        className={`text-sm font-bold border-2 border-border px-3.5 py-1.5 shadow-brutal-hover ${
                          idx === 0 
                            ? 'bg-accent-teal text-white' 
                            : idx === 1 
                              ? 'bg-accent-blue text-white' 
                              : 'bg-bg-base text-text-main'
                        }`}
                      >
                        {genre}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-text-muted font-medium italic">No category relationships established for this author.</p>
                )}
              </div>
              
              <div className="bg-bg-base border-2 border-border p-4 text-xs font-semibold leading-relaxed mt-6">
                <strong>Matched by:</strong> <br/>
                <code className="text-accent-teal font-pixel font-bold">
                  (Author)-[:WRITTEN_BY]-(Book)-[:HAS_CATEGORY]-(Category)
                </code>
              </div>
            </div>

            {/* PANEL 3: Related authors */}
            <div className="bg-surface-white border-[3px] border-border p-6 shadow-brutal flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between border-b-2 border-border pb-3 mb-6">
                  <h3 className="text-2xl font-black flex items-center gap-2">
                    <Users className="w-6 h-6 text-accent-blue" />
                    <span>Related Authors</span>
                  </h3>
                  <span className="font-pixel text-sm bg-accent-blue/10 border border-border px-2">Intersection</span>
                </div>
                
                {author.co_authors.length > 0 ? (
                  <div className="space-y-4">
                    {author.co_authors.map((co, idx) => (
                      <div 
                        key={idx} 
                        className="bg-bg-base border-2 border-border p-3 shadow-brutal-hover flex justify-between items-center"
                      >
                        <div>
                          <Link 
                            to={`/author/${co.name}`}
                            className="font-bold text-md text-text-main hover:text-accent-blue hover:underline block"
                          >
                            {co.name}
                          </Link>
                          <span className="text-[10px] text-text-muted font-bold uppercase">
                            Shared Genres: {co.shared_genres.slice(0, 2).join(', ')}
                          </span>
                        </div>
                        <span className="font-pixel text-xs bg-surface-white border-2 border-border px-2 py-0.5">
                          {co.shared_books} shared books
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-text-muted font-medium italic text-center p-4">
                    No matching overlapping author pathways in current dataset bounds.
                  </p>
                )}
              </div>
              
              <div className="text-xs font-pixel text-text-muted mt-6">
                Based on shared genres
              </div>
            </div>
            
          </div>
        </div>

        {/* Masterpieces Grid */}
        <div>
          <h2 className="text-4xl font-black text-text-main mb-8 flex items-center gap-2">
            <span className="font-pixel text-accent-red">_</span> Published Masterpieces
          </h2>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8 gap-y-12">
            {author.books.map((book, idx) => (
              <BookCard 
                key={idx} 
                book={book} 
                colorScheme={colorPalettes[idx % colorPalettes.length]} 
              />
            ))}
          </div>
        </div>

      </div>
    </div>
  );
};

export default AuthorDetailsPage;
