import axios from 'axios';

const AUTH_URL = 'http://localhost:8000';
const GALLERY_URL = 'http://localhost:8001';

export const authApi = axios.create({ baseURL: AUTH_URL });
export const galleryApi = axios.create({ baseURL: GALLERY_URL });

// Attach JWT token to every Gallery API request
galleryApi.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Auth API calls
export const login = (username, password) =>
  authApi.post('/api/auth/login/', { username, password });

export const register = (data) =>
  authApi.post('/api/auth/register/', data);

// Gallery API calls
export const getImages = (status) => {
  const params = status ? { status } : {};
  return galleryApi.get('/gallery/api/images/', { params });
};

export const getImageDetail = (id) =>
  galleryApi.get(`/gallery/api/images/${id}/`);

export const uploadImage = (formData) =>
  galleryApi.post('/gallery/api/images/', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });

export const verifyImage = (id) =>
  galleryApi.post(`/gallery/api/images/${id}/verify/`);

export const deleteImage = (id) =>
  galleryApi.delete(`/gallery/api/images/${id}/`);

export const getStats = () =>
  galleryApi.get('/gallery/api/stats/');

export const getHealth = () =>
  galleryApi.get('/gallery/api/health/');
