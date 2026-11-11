import React from 'react';
import { BrowserRouter as Router, Navigate, Route, Routes } from 'react-router-dom';
import Navbar from './components/Navbar';
import { OnboardingGate } from './components/GenrePicker';
import HomePage from './pages/HomePage';
import SearchPage from './pages/SearchPage';
import BookDetailsPage from './pages/BookDetailsPage';
import AuthorDetailsPage from './pages/AuthorDetailsPage';
import MyLibraryPage from './pages/MyLibraryPage';
import ListsPage, { NewListPage } from './pages/ListsPage';
import ListDetailPage from './pages/ListDetailPage';
import FeedPage from './pages/FeedPage';
import PeoplePage from './pages/PeoplePage';
import ProfilePage from './pages/ProfilePage';
import SettingsPage from './pages/SettingsPage';
import ChatPage from './pages/ChatPage';
import AdminPage from './pages/AdminPage';
import { AuthProvider } from './contexts/AuthContext';

function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="min-h-screen flex flex-col bg-bg-base font-main text-text-main selection:bg-accent-teal selection:text-white">
          <Navbar />
          <OnboardingGate />

          <main className="flex-grow">
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/search" element={<SearchPage />} />
              <Route path="/book/:title" element={<BookDetailsPage />} />
              <Route path="/author/:name" element={<AuthorDetailsPage />} />
              <Route path="/library" element={<MyLibraryPage />} />
              <Route path="/lists" element={<ListsPage />} />
              <Route path="/lists/new" element={<NewListPage />} />
              <Route path="/lists/:id" element={<ListDetailPage />} />
              <Route path="/feed" element={<FeedPage />} />
              <Route path="/people" element={<PeoplePage />} />
              <Route path="/friends" element={<Navigate to="/people" replace />} />
              <Route path="/u/:username" element={<ProfilePage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/chat" element={<ChatPage />} />
              <Route path="/admin" element={<AdminPage />} />
              <Route path="*" element={<HomePage />} />
            </Routes>
          </main>

          <footer className="border-t-[3px] border-border bg-accent-navy text-white py-12 mt-auto relative overflow-hidden">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between z-10 relative">
              <div className="mb-8 md:mb-0">
                <span className="font-extrabold text-3xl tracking-tight leading-none text-white block mb-2">Book<span className="font-pixel text-4xl text-accent-red">Log</span></span>
                <p className="text-gray-400 font-medium">PostgreSQL · Neo4j · MongoDB · FastAPI</p>
              </div>
              <p className="font-pixel tracking-widest uppercase text-gray-300">A social book diary</p>
            </div>
            <div className="absolute top-0 right-0 w-64 h-64 bg-accent-red/20 rounded-full blur-3xl -z-0 translate-x-1/2 -translate-y-1/2"></div>
          </footer>
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;
