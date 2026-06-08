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

export const getRecommendations = async (title) => {
  const response = await api.get(`/recommendations/${encodeURIComponent(title)}`);
  return response.data;
};

export const addToLibrary = async (uid, bookTitle) => {
  const token = await auth.currentUser?.getIdToken();
  const response = await api.post('/library/add', 
    { book_title: bookTitle },
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

export default api;
