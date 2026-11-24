import axios from 'axios';
import { auth } from '../firebase';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

// Attach the Firebase ID token to every request when signed in
api.interceptors.request.use(async (config) => {
  const token = await auth.currentUser?.getIdToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

const data = (p) => p.then((r) => r.data);
const enc = encodeURIComponent;

// Human-readable error message from an API error
export const errorMessage = (err, fallback = 'Something went wrong') => {
  const detail = err?.response?.data?.detail;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail) && detail[0]?.msg) return detail[0].msg;
  return fallback;
};

// ---------------- Catalogue ----------------
export const searchBooks = (q, filters = {}) => data(api.get('/search', { params: { q, ...filters } }));
export const getGenres = () => data(api.get('/genres'));
export const getLanguages = () => data(api.get('/languages'));
export const getAllBooks = () => data(api.get('/books'));
export const getDbStats = () => data(api.get('/books/stats'));
export const getTrending = (limit = 12) => data(api.get('/books/trending', { params: { limit } }));
export const getBookDetails = (title) => data(api.get(`/book/${enc(title)}`));
export const getRecommendations = (title) => data(api.get(`/book/${enc(title)}/similar`));
export const getBookReviews = (bookId) => data(api.get(`/books/${bookId}/reviews`));
export const getPersonalizedRecommendations = (refresh = false) => data(api.get('/recommendations', { params: { refresh } }));
export const logClick = (bookId, source) => api.post('/activity/click', { book_id: bookId, source }).catch(() => {});

// ---------------- Discover ----------------
export const browseBooks = (params) => data(api.get('/discover/browse', { params }));
export const getGenreIndex = () => data(api.get('/discover/genres'));
export const getRandomBook = (genre) => data(api.get('/discover/random', { params: genre ? { genre } : {} }));
export const getBookOfTheDay = () => data(api.get('/discover/today'));
export const getCatalogueStats = () => data(api.get('/discover/stats'));
export const getFlips = (mode = 'for_you', genre) => data(api.get('/flips', { params: { mode, ...(genre ? { genre } : {}) } }));
export const getBookTakes = (bookId) => data(api.get(`/books/${bookId}/takes`));
export const postTake = (bookId, text, vibe) => data(api.post('/takes', { book_id: bookId, text, vibe }));
export const likeTake = (takeId) => data(api.post(`/takes/${takeId}/like`));
export const deleteTake = (takeId) => api.delete(`/takes/${takeId}`);
export const getFeaturedAuthors = (limit = 14) => data(api.get('/discover/authors', { params: { limit } }));
export const getJournal = (limit = 6) => data(api.get('/discover/journal', { params: { limit } }));
export const getPulse = () => data(api.get('/me/pulse'));
export const getThreads = () => data(api.get('/messages'));
export const getContacts = () => data(api.get('/messages/contacts'));
export const getConversation = (username) => data(api.get(`/messages/${enc(username)}`));
export const sendMessage = (username, text, bookId) => data(api.post(`/messages/${enc(username)}`, { text: text || null, book_id: bookId || null }));
export const markThreadRead = (username) => data(api.post(`/messages/${enc(username)}/read`));
export const getNotifications = () => data(api.get('/notifications'));
export const markNotificationsSeen = () => api.post('/notifications/seen');
export const getReadingNow = () => data(api.get('/people/reading-now'));
export const getReadersNow = (bookId) => data(api.get(`/books/${bookId}/readers-now`));
export const getReadingStats = (username, year) => data(api.get(`/users/${enc(username)}/stats`, { params: year ? { year } : {} }));

// ---------------- Authors ----------------
export const getAuthor = (name) => data(api.get(`/author/${enc(name)}`));
export const followAuthor = (name) => data(api.post('/author/follow', { author_name: name }));
export const unfollowAuthor = (name) => data(api.post('/author/unfollow', { author_name: name }));
export const getUserFollowedAuthors = () => data(api.get('/me/followed-authors'));

// ---------------- Diary, shelves, goal ----------------
export const logBook = (entry) => data(api.post('/diary', entry));
export const updateEntry = (id, fields) => data(api.patch(`/diary/${id}`, fields));
export const deleteEntry = (id) => data(api.delete(`/diary/${id}`));
export const setShelf = (bookId, status) => data(api.put(`/shelves/${bookId}`, { status }));
export const removeShelf = (bookId) => data(api.delete(`/shelves/${bookId}`));
export const getGoal = (year) => data(api.get('/me/goal', { params: { year } }));
export const setGoal = (year, target) => data(api.put('/me/goal', { year, target_books: target }));

// ---------------- Reviews ----------------
export const likeReview = (entryId) => data(api.post(`/reviews/${entryId}/like`));
export const getReviewComments = (entryId) => data(api.get(`/reviews/${entryId}/comments`));
export const commentReview = (entryId, text) => data(api.post(`/reviews/${entryId}/comments`, { text }));
export const reportReview = (entryId, reason) => data(api.post(`/reviews/${entryId}/report`, { reason }));
export const deleteComment = (id) => data(api.delete(`/comments/${id}`));

// ---------------- Lists ----------------
export const browseLists = (sort = 'popular') => data(api.get('/lists', { params: { sort } }));
export const getMyLists = (bookId) => data(api.get('/lists/mine', { params: bookId ? { book_id: bookId } : {} }));
export const createList = (list) => data(api.post('/lists', list));
export const getList = (id) => data(api.get(`/lists/${id}`));
export const updateList = (id, fields) => data(api.patch(`/lists/${id}`, fields));
export const deleteList = (id) => data(api.delete(`/lists/${id}`));
export const addToList = (id, bookId) => data(api.post(`/lists/${id}/books`, { book_id: bookId }));
export const removeFromList = (id, bookId) => data(api.delete(`/lists/${id}/books/${bookId}`));
export const reorderList = (id, bookIds) => data(api.put(`/lists/${id}/order`, { book_ids: bookIds }));
export const likeList = (id) => data(api.post(`/lists/${id}/like`));
export const getListComments = (id) => data(api.get(`/lists/${id}/comments`));
export const commentList = (id, text) => data(api.post(`/lists/${id}/comments`, { text }));

// ---------------- Me & people ----------------
export const getMe = () => data(api.get('/me'));
export const updateMe = (fields) => data(api.patch('/me', fields));
export const setFavouriteGenres = (genres) => data(api.put('/me/genres', { genres }));
export const deleteAccount = () => data(api.delete('/me'));
export const exportMyData = () => data(api.get('/me/export'));
export const getFeed = () => data(api.get('/feed'));
export const getSuggestions = () => data(api.get('/people/suggestions'));
export const searchPeople = (q) => data(api.get('/people/search', { params: { q } }));
export const getProfile = (username) => data(api.get(`/users/${enc(username)}`));
export const getUserDiary = (username, year) => data(api.get(`/users/${enc(username)}/diary`, { params: year ? { year } : {} }));
export const getUserShelves = (username) => data(api.get(`/users/${enc(username)}/shelves`));
export const getUserLists = (username) => data(api.get(`/users/${enc(username)}/lists`));
export const getUserGoal = (username) => data(api.get(`/users/${enc(username)}/goal`));
export const getFollowers = (username) => data(api.get(`/users/${enc(username)}/followers`));
export const getFollowing = (username) => data(api.get(`/users/${enc(username)}/following`));
export const followUser = (username) => data(api.post(`/users/${enc(username)}/follow`));
export const unfollowUser = (username) => data(api.delete(`/users/${enc(username)}/follow`));

// ---------------- Chat ----------------
export const getChatSessions = () => data(api.get('/chat/sessions'));
export const getChatSession = (id) => data(api.get(`/chat/sessions/${id}`));
export const deleteChatSession = (id) => data(api.delete(`/chat/sessions/${id}`));
export const sendChatMessage = (content, sessionId) => data(api.post('/chat/messages', { content, session_id: sessionId }));

// ---------------- Admin ----------------
export const admin = {
  analytics: () => data(api.get('/admin/analytics')),
  audit: (table) => data(api.get('/admin/audit', { params: table ? { table } : {} })),
  reports: (status = 'open') => data(api.get('/admin/reports', { params: { status } })),
  resolveReport: (id, action) => data(api.post(`/admin/reports/${id}/resolve`, { action })),
  books: (q) => data(api.get('/admin/books', { params: { q } })),
  book: (id) => data(api.get(`/admin/books/${id}`)),
  saveBook: (book, id) => data(id ? api.put(`/admin/books/${id}`, book) : api.post('/admin/books', book)),
  deleteBook: (id) => data(api.delete(`/admin/books/${id}`)),
  authors: (q) => data(api.get('/admin/authors', { params: { q } })),
  saveAuthor: (a, id) => data(id ? api.put(`/admin/authors/${id}`, a) : api.post('/admin/authors', a)),
  deleteAuthor: (id) => data(api.delete(`/admin/authors/${id}`)),
  genres: () => data(api.get('/admin/genres')),
  saveGenre: (g, id) => data(id ? api.put(`/admin/genres/${id}`, g) : api.post('/admin/genres', g)),
  deleteGenre: (id) => data(api.delete(`/admin/genres/${id}`)),
  users: (q) => data(api.get('/admin/users', { params: { q } })),
  setRole: (id, role) => data(api.put(`/admin/users/${id}/role`, { role })),
  runSync: () => data(api.post('/admin/sync/run')),
};

export default api;
