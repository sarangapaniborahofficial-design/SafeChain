import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ShieldAlert, Phone, Lock, User } from 'lucide-react';

export default function Register() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({ name: '', phone: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      const data = await res.json();
      
      if (res.ok) {
        localStorage.setItem('safechain_token', data.token);
        localStorage.setItem('safechain_user', JSON.stringify(data.user));
        navigate('/');
      } else {
        setError(data.error || 'Registration failed');
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
        
        <h1 className="text-2xl font-black text-center text-dark mb-2">Create Account</h1>
        <p className="text-gray-500 text-center text-sm mb-8 font-medium">Join SafeChain</p>

        {error && <div className="bg-red-50 text-red-500 text-sm font-bold p-3 rounded-xl mb-4 text-center">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <User className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input type="text" placeholder="Full Name" required
              className="w-full bg-gray-50 border border-gray-200 rounded-xl py-3 pl-12 pr-4 text-sm font-bold text-dark outline-none focus:border-brand transition-colors"
              value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})}
            />
          </div>
          
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

          <button type="submit" disabled={loading} className="w-full bg-dark text-white font-bold py-3.5 rounded-xl mt-4 shadow-md hover:bg-gray-800 transition disabled:opacity-50">
            {loading ? 'Creating...' : 'Sign Up'}
          </button>
        </form>
        
        <p className="text-center text-sm font-bold text-gray-500 mt-6">
          Already have an account? <Link to="/login" className="text-brand">Log In</Link>
        </p>
      </div>
    </div>
  );
}
