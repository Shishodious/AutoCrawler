import React, { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import api from '../api';
import { Lock, Eye, EyeOff } from 'lucide-react';

const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const location = useLocation();
  const justRegistered = location.state?.registered;

  React.useEffect(() => {
    if (localStorage.getItem('token')) {
      navigate('/');
    }
  }, [navigate]);

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const response = await api.post('/auth/login', { username, password });
      localStorage.setItem('token', response.data.token);
      localStorage.setItem('user', JSON.stringify(response.data.user));
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-dark">
      <div className="bg-dark-light p-8 rounded-xl shadow-2xl w-full max-w-md border border-gray-700">
        <div className="flex justify-center mb-6">
          <div className="bg-primary/20 p-4 rounded-full">
            <Lock className="w-8 h-8 text-primary" />
          </div>
        </div>
        <h2 className="text-2xl font-bold text-center mb-6 text-white">Welcome Back</h2>
        <div className="mb-6 bg-gradient-to-r from-indigo-500/10 to-purple-500/10 border border-indigo-500/20 rounded-lg p-3 text-center">
  <p className="text-xs uppercase tracking-wider text-indigo-400 mb-1">
    Demo Credentials
  </p>
  <p className="text-sm text-gray-300">
    <span className="font-medium text-white">Username:</span>{" "}
    <span className="text-indigo-400 font-semibold">priyanshu</span>
  </p>
  <p className="text-sm text-gray-300">
    <span className="font-medium text-white">Password:</span>{" "}
    <span className="text-indigo-400 font-semibold">Priyanshu1@</span>
  </p>
</div>
        {justRegistered && (
          <div className="bg-green-900/20 border border-green-500/50 text-green-200 p-3 rounded mb-4 text-sm text-center">
            Account created! Please log in.
          </div>
        )}
        {error && (
          <div className="bg-red-900/20 border border-red-500/50 text-red-200 p-3 rounded mb-4 text-sm text-center">
            {error}
          </div>
        )}
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-gray-400 text-sm mb-1">Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full bg-dark border border-gray-600 rounded-lg px-4 py-2 focus:outline-none focus:border-primary text-white"
              required
            />
          </div>
          <div>
            <label className="block text-gray-400 text-sm mb-1">Password</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-dark border border-gray-600 rounded-lg px-4 py-2 focus:outline-none focus:border-primary text-white pr-10"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white focus:outline-none"
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
          </div>
          <button
            type="submit"
            className="w-full bg-indigo-500 hover:bg-indigo-600 text-white py-2 rounded-lg font-semibold transition-colors mt-4"
          >
            Login
          </button>
        </form>
        <p className="text-center text-gray-400 text-sm mt-6">
          Don&apos;t have an account?{' '}
          <Link to="/register" className="text-indigo-400 hover:text-indigo-300 font-medium">
            Register
          </Link>
        </p>
      </div>
    </div>
  );
};

export default Login;
