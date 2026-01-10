import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Navbar from './components/Navbar';
import Home from './pages/Home';
import History from './pages/History';
import SessionDetails from './pages/SessionDetails';
import Stats from './pages/Stats';
import Login from './pages/Login';
import AuthGate from './components/AuthGate';
import { disconnectSocket } from './services/socket';

import { jwtDecode } from 'jwt-decode';

const PrivateRoute = ({ children }) => {
  const token = localStorage.getItem('token');
  
  if (!token) {
    // Gracefully disconnect socket if no token
    disconnectSocket("no token");
    return <Navigate to="/login" />;
  }

  try {
    const decoded = jwtDecode(token);
    const currentTime = Date.now() / 1000;
    
    if (decoded.exp < currentTime) {
      // Token expired - gracefully disconnect socket
      console.log('🔒 Token expired, disconnecting socket...');
      disconnectSocket("token expired");
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      return <Navigate to="/login" />;
    }
    
    // Wrap children with AuthGate to ensure socket initialization
    return <AuthGate>{children}</AuthGate>;
  } catch (error) {
    // Invalid token - gracefully disconnect socket
    console.error('🔒 Invalid token, disconnecting socket...');
    disconnectSocket("invalid token");
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    return <Navigate to="/login" />;
  }
};

function App() {
  return (
    <Router>
      <div className="min-h-screen text-white font-sans">
        <Navbar />
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/"
            element={
              <PrivateRoute>
                <Home />
              </PrivateRoute>
            
            }
          />
          <Route
            path="/history"
            element={
              <PrivateRoute>
                <History />
              </PrivateRoute>
            }
          />
          <Route
            path="/session/:sessionId"
            element={
              <PrivateRoute>
                <SessionDetails />
              </PrivateRoute>
            }
          />
          <Route
            path="/stats"
            element={
              <PrivateRoute>
                <Stats />
              </PrivateRoute>
            }
          />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
