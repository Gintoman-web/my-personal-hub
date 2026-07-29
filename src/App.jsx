import { useState } from 'react';
import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import Archive from './pages/Archive';
import Season from './pages/Season';
import Eurocups from './pages/Eurocups';
import Krasnodar from './pages/Krasnodar';
import { Lock, LogOut } from 'lucide-react';

// 🔑 ЗАДАЙ СВОЙ ПАРОЛЬ ДЛЯ ВХОДА ЗДЕСЬ:
const SECRET_PASSWORD = "yD4S8hPx"; 

function NavLink({ to, children }) {
  const location = useLocation();
  const isActive = location.pathname === to;
  return (
    <Link to={to} className={`px-4 py-2 rounded-lg font-bold transition-all ${
      isActive 
        ? 'bg-emerald-700 text-white shadow-lg shadow-emerald-900/50' 
        : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'
    }`}>
      {children}
    </Link>
  );
}

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return localStorage.getItem('app_auth') === 'true';
  });
  const [inputPassword, setInputPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const handleLoginSubmit = (e) => {
    e.preventDefault();
    if (inputPassword === SECRET_PASSWORD) {
      localStorage.setItem('app_auth', 'true');
      setIsAuthenticated(true);
      setErrorMsg('');
    } else {
      setErrorMsg('Неверный пароль доступа!');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('app_auth');
    setIsAuthenticated(false);
  };

  // ЭКРАН БЛОКИРОВКИ (показывается необразованным гостям)
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4 selection:bg-emerald-500/30">
        <form onSubmit={handleLoginSubmit} className="bg-zinc-900 p-8 rounded-2xl border border-emerald-900/50 max-w-sm w-full space-y-6 shadow-2xl">
          <div className="text-center space-y-2">
            <div className="inline-flex p-3 bg-emerald-950/50 border border-emerald-900/50 rounded-full text-emerald-400 mb-2">
              <Lock size={32} />
            </div>
            <h2 className="text-2xl font-bold text-white">Доступ ограничен</h2>
            <p className="text-xs text-zinc-400">Введите пароль для входа в панель статистики</p>
          </div>

          <div>
            <input 
              type="password" 
              placeholder="Пароль" 
              required 
              className="w-full bg-black border border-zinc-700 p-3 rounded-lg text-white text-center text-lg tracking-widest outline-none focus:ring-1 focus:ring-emerald-500"
              value={inputPassword}
              onChange={(e) => setInputPassword(e.target.value)}
            />
            {errorMsg && <p className="text-red-400 text-xs text-center mt-2 font-bold">{errorMsg}</p>}
          </div>

          <button type="submit" className="w-full bg-emerald-700 hover:bg-emerald-600 text-white font-bold py-3 rounded-lg transition-colors">
            Войти в систему
          </button>
        </form>
      </div>
    );
  }

  // ОСНОВНОЕ ПРИЛОЖЕНИЕ (показывается только после ввода пароля)
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-zinc-950 text-white font-sans selection:bg-emerald-500/30">
        <header className="bg-black border-b border-emerald-900/50 p-4 sticky top-0 z-50">
          <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <img 
                src="https://upload.wikimedia.org/wikipedia/commons/thumb/c/c5/FC_Krasnodar_logo.svg/512px-FC_Krasnodar_logo.svg.png" 
                alt="ФК Краснодар" 
                className="h-10 w-auto"
              />
              <div className="flex gap-2 overflow-x-auto no-scrollbar">
                <NavLink to="/">Сезон</NavLink>
                <NavLink to="/archive">Архив</NavLink>
                <NavLink to="/euro">Еврокубки</NavLink>
                <NavLink to="/krasnodar">Краснодар</NavLink>
              </div>
            </div>

            <button 
              onClick={handleLogout} 
              className="text-zinc-500 hover:text-red-400 p-2 transition-colors"
              title="Выйти из системы"
            >
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
    </BrowserRouter>
  );
}

export default App;