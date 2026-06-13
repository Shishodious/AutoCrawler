import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { Waypoints, Telescope, History, BarChart3, LogOut } from 'lucide-react';
import { disconnectSocket } from "../services/socket";

const navItems = [
  { to: '/', label: 'Crawl', icon: Telescope, end: true },
  { to: '/history', label: 'History', icon: History },
  { to: '/stats', label: 'Stats', icon: BarChart3 },
];

const Navbar = () => {
  const navigate = useNavigate();
  const token = localStorage.getItem('token');

  let username = '';
  try {
    username = JSON.parse(localStorage.getItem('user') || '{}')?.username || '';
  } catch {
    username = '';
  }

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    disconnectSocket("logout");
    navigate('/login');
  };

  return (
    <nav className="sticky top-0 z-40 border-b border-hairline bg-dark/70 backdrop-blur-xl">
      <div className="container mx-auto flex items-center justify-between px-6 py-3.5">
        {/* Brand */}
        <NavLink to="/" className="group flex items-center gap-2.5">
          <span className="grid place-items-center w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-secondary shadow-lg shadow-primary/30 transition-transform group-hover:scale-105">
            <Waypoints className="w-5 h-5 text-white" />
          </span>
          <span className="text-xl font-extrabold tracking-tight text-gradient">
            AutoCrawler
          </span>
        </NavLink>

        {token && (
          <div className="flex items-center gap-1.5 sm:gap-2">
            <div className="flex items-center gap-1 rounded-xl border border-hairline bg-dark-light/60 p-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    className={({ isActive }) =>
                      `flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-all ${
                        isActive
                          ? 'bg-primary/20 text-primary-soft shadow-inner'
                          : 'text-gray-400 hover:bg-white/5 hover:text-white'
                      }`
                    }
                  >
                    <Icon className="w-4 h-4" />
                    <span className="hidden sm:inline">{item.label}</span>
                  </NavLink>
                );
              })}
            </div>

            {username && (
              <span className="hidden md:flex items-center gap-2 rounded-xl border border-hairline bg-dark-light/60 px-3 py-1.5 text-sm">
                <span className="grid place-items-center w-6 h-6 rounded-full bg-gradient-to-br from-primary to-secondary text-xs font-bold text-white">
                  {username.charAt(0).toUpperCase()}
                </span>
                <span className="text-gray-300">{username}</span>
              </span>
            )}

            <button
              onClick={handleLogout}
              title="Log out"
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-gray-400 transition-colors hover:bg-danger/10 hover:text-danger"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        )}
      </div>
    </nav>
  );
};

export default Navbar;
