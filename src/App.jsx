import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import Archive from './pages/Archive';
import Season from './pages/Season';
import Eurocups from './pages/Eurocups';
import Krasnodar from './pages/Krasnodar';

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
  return (
    <BrowserRouter>
      {/* Главный фон: почти черный (zinc-950) */}
      <div className="min-h-screen bg-zinc-950 text-white font-sans selection:bg-emerald-500/30">
        
        {/* Шапка с логотипом */}
        <header className="bg-black border-b border-emerald-900/50 p-4 sticky top-0 z-50">
          <div className="max-w-6xl mx-auto flex items-center gap-6">
            <img 
              src="https://www.fckrasnodar.ru/i/logo.fck.svg" 
              alt="ФК Краснодар" 
              className="h-12 w-auto drop-shadow-md"
            />
            <div className="flex gap-2 overflow-x-auto no-scrollbar">
              <NavLink to="/">Модуль: Сезон</NavLink>
              <NavLink to="/archive">Модуль: Архив</NavLink>
              <NavLink to="/euro">Еврокубки</NavLink>
              <NavLink to="/krasnodar">ФК Краснодар</NavLink>
            </div>
          </div>
        </header>

        {/* Контент страницы */}
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