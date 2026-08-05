import { useState } from 'react';
import { HashRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import pb from './pb';
import Season from './pages/Season';
import Archive from './pages/Archive';
import Eurocups from './pages/Eurocups';
import Krasnodar from './pages/Krasnodar';
import { LogOut } from 'lucide-react';

function NavLink({ to, children }) {
  const location = useLocation();
  const isActive = location.pathname === to;
  return (
    <Link to={to} className={`px-4 py-2 rounded-lg font-bold transition-all whitespace-nowrap ${
      isActive ? 'bg-emerald-700 text-white shadow-lg shadow-emerald-900/50' : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'
    }`}>
      {children}
    </Link>
  );
}

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(pb.authStore.isValid);
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    try {
      // 1. Пробуем войти как обычный пользователь по логину/email
      await pb.collection('users').authWithPassword(login, password);
      setIsAuthenticated(true);
    } catch {
      try {
        // 2. Запасной вариант для админа
        await pb.admins.authWithPassword(login, password);
        setIsAuthenticated(true);
      } catch (err) {
        console.error(err);
        setError('Неверный Логин или Пароль');
      }
    }
  };

  const handleLogout = () => {
    pb.authStore.clear();
    setIsAuthenticated(false);
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4 selection:bg-emerald-500/30">
        <form onSubmit={handleLogin} className="bg-zinc-900 p-8 rounded-2xl border border-emerald-900/50 space-y-6 w-full max-w-sm shadow-2xl">
          <div className="text-center">
            <img src="/logo.png" alt="ФК Краснодар" className="h-24 mx-auto drop-shadow-md mb-6" />
            <h2 className="text-2xl font-black text-white">Вход в панель</h2>
          </div>
          
          {error && <p className="text-red-400 text-sm text-center font-bold bg-red-950/50 p-2 rounded">{error}</p>}
          
          <div className="space-y-4">
            <input type="text" placeholder="Логин или Email" required
              className="w-full bg-black border border-zinc-700 focus:border-emerald-500 focus:outline-none p-3 rounded-lg text-white transition-colors"
              value={login} onChange={e => setLogin(e.target.value)} />
            
            <input type="password" placeholder="Пароль" required
              className="w-full bg-black border border-zinc-700 focus:border-emerald-500 focus:outline-none p-3 rounded-lg text-white transition-colors"
              value={password} onChange={e => setPassword(e.target.value)} />
          </div>

          <button type="submit" className="w-full bg-emerald-700 hover:bg-emerald-600 py-3 rounded-lg font-bold text-white transition-colors shadow-lg shadow-emerald-900/50">
            Войти
          </button>
        </form>
      </div>
    );
  }

  return (
    <HashRouter>
      <div className="min-h-screen bg-zinc-950 text-white font-sans selection:bg-emerald-500/30">
        <header className="bg-black border-b border-emerald-900/50 p-4 sticky top-0 z-50">
          <div className="max-w-6xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-6">
              <img src="/logo.png" alt="ФК Краснодар" className="h-10 w-auto drop-shadow-md hidden sm:block" />
              <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                <NavLink to="/">Сезон</NavLink>
                <NavLink to="/archive">Архив</NavLink>
                <NavLink to="/euro">Еврокубки</NavLink>
                <NavLink to="/krasnodar">Краснодар</NavLink>
              </div>
            </div>
            
            <button onClick={handleLogout} className="text-zinc-500 hover:text-red-400 p-2 transition-colors" title="Выйти">
              <LogOut size={20} />
            </button>
          </div>
        </header>

        <main className="max-w-6xl mx-auto p-4 py-8">
          <Routes>
            <Route path="/" element={<Season />} />
            <Route path="/archive" element={<Archive />} /> 
            <Route path="/euro" element={<Eurocups />} />
            <Route path="/krasnodar" element={<Krasnodar />} />
          </Routes>
        </main>
      </div>
    </HashRouter>
  );
}