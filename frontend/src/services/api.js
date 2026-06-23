import axios from 'axios';
import { auth } from '../firebase';

const API_BASE_URL = 'http://localhost:8000';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const searchBooks = async (query) => {
  const token = await auth.currentUser?.getIdToken();
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  const response = await api.get('/search', { 
    params: { q: query },
    headers
  });
  return response.data;
};

export const getAllBooks = async () => {
  const response = await api.get('/books');
  return response.data;
};

export const getDbStats = async () => {
  const response = await api.get('/books/stats');
  return response.data;
};


export const getBookDetails = async (title, uid = null) => {
  const params = uid ? { uid } : {};
  const response = await api.get(`/book/${encodeURIComponent(title)}`, { params });
  return response.data;
};

export const getRecommendations = async (title, uid = null) => {
  const params = uid ? { uid } : {};
  const response = await api.get(`/recommendations/${encodeURIComponent(title)}`, { params });
  return response.data;
};

export const addToLibrary = async (uid, bookTitle, rating = null, review = null) => {
  const token = await auth.currentUser?.getIdToken();
  const response = await api.post('/library/add', 
    { book_title: bookTitle, rating, review },
    { headers: { Authorization: `Bearer ${token}` } }
  );
  return response.data;
};

export const getUserLibrary = async (uid) => {
  const token = await auth.currentUser?.getIdToken();
  const response = await api.get(`/library/${uid}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return response.data;
};

// ---------------------------------------------
// NEW AUTHOR-RELATED SERVICES
// ---------------------------------------------

export const getAuthor = async (name) => {
  const token = await auth.currentUser?.getIdToken();
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  const response = await api.get(`/author/${encodeURIComponent(name)}`, { headers });
  return response.data;
};

export const followAuthor = async (authorName) => {
  const token = await auth.currentUser?.getIdToken();
  const response = await api.post('/author/follow', 
    { author_name: authorName },
    { headers: { Authorization: `Bearer ${token}` } }
  );
  return response.data;
};

export const unfollowAuthor = async (authorName) => {
  const token = await auth.currentUser?.getIdToken();
  const response = await api.post('/author/unfollow', 
    { author_name: authorName },
    { headers: { Authorization: `Bearer ${token}` } }
  );
  return response.data;
};

export const simulateGraphTraversal = async (node, algo, limit = null) => {
  const params = { node, algo };
  if (limit !== null) {
    params.limit = limit;
  }
  const response = await api.get('/simulate', { params });
  return response.data;
};

export const getUserFollowedAuthors = async (uid) => {
  const token = await auth.currentUser?.getIdToken();
  const response = await api.get(`/library/${uid}/authors`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return response.data;
};

export const getPersonalizedRecommendations = async (uid) => {
  const token = await auth.currentUser?.getIdToken();
  const response = await api.get(`/recommendations/user/${uid}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return response.data;
};

// ---------------------------------------------
// NEW SOCIAL GRAPH / FRIENDS SERVICES
// ---------------------------------------------

export const getUserProfile = async () => {
  const token = await auth.currentUser?.getIdToken();
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  const response = await api.get('/api/user/profile', { headers });
  return response.data;
};

export const followUser = async (friendCode) => {
  const token = await auth.currentUser?.getIdToken();
  const response = await api.post('/api/user/follow', 
    { friend_code: friendCode },
    { headers: { Authorization: `Bearer ${token}` } }
  );
  return response.data;
};

export const unfollowUser = async (friendCode) => {
  const token = await auth.currentUser?.getIdToken();
  const response = await api.post('/api/user/unfollow', 
    { friend_code: friendCode },
    { headers: { Authorization: `Bearer ${token}` } }
  );
  return response.data;
};

export const getUserFriends = async () => {
  const token = await auth.currentUser?.getIdToken();
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  const response = await api.get('/api/user/friends', { headers });
  return response.data;
};

export const getFriendsActivity = async () => {
  const token = await auth.currentUser?.getIdToken();
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  const response = await api.get('/api/user/friends/activity', { headers });
  return response.data;
};

export const getConnectionDegree = async (targetFriendCode) => {
  const token = await auth.currentUser?.getIdToken();
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  const response = await api.get(`/api/user/connection/${targetFriendCode}`, { headers });
  return response.data;
};

export const getFriendSuggestions = async () => {
  const token = await auth.currentUser?.getIdToken();
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  const response = await api.get('/api/user/suggestions', { headers });
  return response.data;
};

export const compareLibraries = async (targetFriendCode) => {
  const token = await auth.currentUser?.getIdToken();
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  const response = await api.get(`/api/user/compare/${targetFriendCode}`, { headers });
  return response.data;
};

export default api;
