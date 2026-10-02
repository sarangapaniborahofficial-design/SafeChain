import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ShieldAlert, Phone, Lock } from 'lucide-react';

export default function Login() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({ phone: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      const data = await res.json();
      
      if (res.ok) {
        localStorage.setItem('navshield_token', data.token);
        localStorage.setItem('navshield_user', JSON.stringify(data.user));
        navigate('/');
      } else {
        setError(data.error || 'Login failed');
      }
    } catch (err) {
      setError('Network error. Is the backend running?');
    }
    setLoading(false);
  };

  return (
    <div className="w-full h-screen bg-gray-900 flex items-center justify-center font-sans px-4">
      <div className="w-full max-w-sm bg-white rounded-3xl p-8 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-brand to-safe"></div>
        
        <div className="w-16 h-16 bg-blue-50 text-brand rounded-2xl flex items-center justify-center mb-6 mx-auto shadow-sm">
          <ShieldAlert size={32} />
        </div>
        
        <h1 className="text-2xl font-black text-center text-dark mb-2">Welcome Back</h1>
        <p className="text-gray-500 text-center text-sm mb-8 font-medium">Log in to SafeChain</p>

        {error && <div className="bg-red-50 text-red-500 text-sm font-bold p-3 rounded-xl mb-4 text-center">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input type="tel" placeholder="Phone Number" required
              className="w-full bg-gray-50 border border-gray-200 rounded-xl py-3 pl-12 pr-4 text-sm font-bold text-dark outline-none focus:border-brand transition-colors"
              value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})}
            />
          </div>
          
          <div className="relative">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input type="password" placeholder="Password" required
              className="w-full bg-gray-50 border border-gray-200 rounded-xl py-3 pl-12 pr-4 text-sm font-bold text-dark outline-none focus:border-brand transition-colors"
              value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})}
            />
          </div>

          <button type="submit" disabled={loading} className="w-full bg-brand text-white font-bold py-3.5 rounded-xl mt-4 shadow-md hover:bg-blue-500 transition disabled:opacity-50">
            {loading ? 'Authenticating...' : 'Log In'}
          </button>
        </form>
        
        <p className="text-center text-sm font-bold text-gray-500 mt-6 mb-4">
          New to SafeChain? <Link to="/register" className="text-dark">Create Account</Link>
        </p>
        
        {/* Guest Mode Bypass */}
        <div className="border-t border-gray-100 pt-4">
          <button 
            type="button" 
            onClick={() => {
              localStorage.setItem('navshield_token', 'guest_bypass_token');
              localStorage.setItem('navshield_user', JSON.stringify({ id: 'guest', name: 'Guest User', phone: 'N/A' }));
              navigate('/');
            }}
            className="w-full bg-gray-100 text-gray-600 font-bold py-3.5 rounded-xl hover:bg-gray-200 transition"
          >
            Continue as Guest (Free Mode)
          </button>
        </div>
      </div>
    </div>
  );
}
