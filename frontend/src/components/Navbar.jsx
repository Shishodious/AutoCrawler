import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Activity, History, LogOut } from 'lucide-react';
import { disconnectSocket } from "../services/socket";

const Navbar = () => {
  const navigate = useNavigate();
  const token = localStorage.getItem('token');

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    disconnectSocket("logout");
    navigate('/login');
  };

  // if (!token) return null;

  return (
    <nav className="bg-dark-light border-b border-gray-700 p-4">
      <div className="container mx-auto flex justify-between items-center">
        <Link to="/" className="text-2xl font-bold text-primary flex items-center gap-2">
          <Activity className="w-8 h-8" />
          AutoCrawler
        </Link>
        <div className="flex items-center gap-6">
          <Link to="/" className="hover:text-primary transition-colors">Crawl</Link>
          <Link to="/history" className="hover:text-primary transition-colors flex items-center gap-1">
            <History className="w-4 h-4" /> History
          </Link>
          <button onClick={handleLogout} className="text-red-400 hover:text-red-300 flex items-center gap-1">
            <LogOut className="w-4 h-4" /> Logout
          </button>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
