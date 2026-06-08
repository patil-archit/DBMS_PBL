import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import HomePage from './pages/HomePage';
import SearchPage from './pages/SearchPage';
import BookDetailsPage from './pages/BookDetailsPage';
import AuthorDetailsPage from './pages/AuthorDetailsPage';
import GraphPage from './pages/GraphPage';
import AlgorithmSimulationPage from './pages/AlgorithmSimulationPage';
import MyLibraryPage from './pages/MyLibraryPage';
import { AuthProvider } from './contexts/AuthContext';

function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="min-h-screen flex flex-col bg-bg-base font-main text-text-main selection:bg-accent-teal selection:text-white">
          <Navbar />
          
          <main className="flex-grow">
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/search" element={<SearchPage />} />
              <Route path="/book/:title" element={<BookDetailsPage />} />
              <Route path="/author/:name" element={<AuthorDetailsPage />} />
              <Route path="/graph" element={<GraphPage />} />
              <Route path="/simulation" element={<AlgorithmSimulationPage />} />
              <Route path="/library" element={<MyLibraryPage />} />
              {/* Fallback for other routes */}
              <Route path="*" element={<HomePage />} />
            </Routes>
          </main>

          <footer className="border-t-[3px] border-border bg-accent-navy text-white py-12 mt-auto relative overflow-hidden">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between z-10 relative">
              <div className="mb-8 md:mb-0">
                <span className="font-extrabold text-3xl tracking-tight leading-none text-white block mb-2">Biblio<span className="font-pixel text-4xl text-accent-red">Graph</span></span>
                <p className="text-gray-400 font-medium">Powered by Neo4j & FastAPI</p>
              </div>
              <div className="flex space-x-6 font-pixel tracking-widest uppercase">
                <a href="#" className="hover:text-accent-teal transition-colors">Privacy</a>
                <a href="#" className="hover:text-accent-blue transition-colors">Terms</a>
                <a href="#" className="hover:text-accent-red transition-colors">API</a>
              </div>
            </div>
            {/* Decorative Elements */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-accent-red/20 rounded-full blur-3xl -z-0 translate-x-1/2 -translate-y-1/2"></div>
          </footer>
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;
