import React, { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import api from '../api';
import { Waypoints, Eye, EyeOff, User, KeyRound, Loader2, Sparkles, CheckCircle2, AlertCircle } from 'lucide-react';

const DEMO = { username: 'priyanshu', password: 'Priyanshu1@' };

const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
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
    setError('');
    setLoading(true);
    try {
      const response = await api.post('/auth/login', { username, password });
      localStorage.setItem('token', response.data.token);
      localStorage.setItem('user', JSON.stringify(response.data.user));
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const fillDemo = () => {
    setUsername(DEMO.username);
    setPassword(DEMO.password);
  };

  return (
    <div className="min-h-[calc(100vh-65px)] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md animate-scale-in">
        {/* Brand mark */}
        <div className="flex flex-col items-center mb-8">
          <span className="grid place-items-center w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-secondary shadow-xl shadow-primary/40">
            <Waypoints className="w-8 h-8 text-white" />
          </span>
          <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-gradient">Welcome back</h1>
          <p className="mt-1 text-sm text-gray-400">Sign in to continue crawling</p>
        </div>

        <div className="glass-card rounded-2xl p-8">
          {/* Demo credentials */}
          <div className="mb-6 rounded-xl border border-primary/20 bg-primary/5 p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-primary-soft">
                <Sparkles className="w-3.5 h-3.5" /> Demo credentials
              </p>
              <button
                type="button"
                onClick={fillDemo}
                className="text-xs font-medium text-primary-soft hover:text-white transition-colors underline-offset-2 hover:underline"
              >
                Autofill
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="block text-xs text-gray-500">Username</span>
                <span className="font-mono text-gray-200">{DEMO.username}</span>
              </div>
              <div>
                <span className="block text-xs text-gray-500">Password</span>
                <span className="font-mono text-gray-200">{DEMO.password}</span>
              </div>
            </div>
          </div>

          {justRegistered && (
            <div className="mb-4 flex items-center gap-2 rounded-lg border border-success/40 bg-success/10 p-3 text-sm text-success">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              Account created! Please log in.
            </div>
          )}
          {error && (
            <div className="mb-4 flex items-center gap-2 rounded-lg border border-danger/40 bg-danger/10 p-3 text-sm text-danger">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1.5">Username</label>
              <div className="relative">
                <User className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter your username"
                  className="w-full rounded-xl border border-hairline bg-dark/60 pl-10 pr-4 py-2.5 text-white placeholder:text-gray-600 transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
                  required
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1.5">Password</label>
              <div className="relative">
                <KeyRound className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full rounded-xl border border-hairline bg-dark/60 pl-10 pr-11 py-2.5 text-white placeholder:text-gray-600 transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="btn-glow flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary to-secondary py-2.5 font-semibold text-white transition-all hover:brightness-110 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-gray-400">
            Don&apos;t have an account?{' '}
            <Link to="/register" className="font-semibold text-primary-soft hover:text-white transition-colors">
              Create one
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
