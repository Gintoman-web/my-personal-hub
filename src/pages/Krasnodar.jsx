import { useState, useEffect } from 'react';
import pb from '../pb';
import { Plus, X, Edit2, Trash2, UserPlus, AlertTriangle, CheckSquare, Square, Save } from 'lucide-react';

const TABS = [
  { key: 'games', label: 'Игры' },
  { key: 'goals', label: 'Голы' },
  { key: 'assists', label: 'Голевые' },
  { key: 'clean_sheets', label: 'Сухие' },
  { key: 'best_player', label: 'Лучший' },
  { key: 'yellow_cards', label: 'ЖК' },
  { key: 'red_cards', label: 'КК' }
];

export default function Krasnodar() {
  const [players, setPlayers] = useState([]);
  const [matches, setMatches] = useState([]);
  const [season, setSeason] = useState(null);
  
  const [activeTab, setActiveTab] = useState('games');
  const [viewMode, setViewMode] = useState('CURRENT'); // 'CURRENT' или 'ALL_TIME'
  
  // Состояния форм
  const [showPlayerForm, setShowPlayerForm] = useState(false);
  const [editingPlayerId, setEditingPlayerId] = useState(null);
  const [playerForm, setPlayerForm] = useState({
    name: '', is_active: true,
    base_games: 0, base_goals: 0, base_assists: 0, 
    base_clean_sheets: 0, base_best_player: 0, base_yellow_cards: 0, base_red_cards: 0
  });

  const [showMatchForm, setShowMatchForm] = useState(false);
  const [editingMatchId, setEditingMatchId] = useState(null);
  const [matchForm, setMatchForm] = useState({ opponent: '', score: '' });
  const [matchStats, setMatchStats] = useState({}); // { playerId: { played: true, goals: 1 ... } }

  const [showZeroGamesReport, setShowZeroGamesReport] = useState(false);

  // ЧИСТЫЕ ФУНКЦИИ ЗАГРУЗКИ
  const fetchKrasnodarData = async () => {
    let activeSeason;
    const seasons = await pb.collection('seasons').getFullList({ filter: 'is_active=true' });
    if (seasons.length > 0) activeSeason = seasons[0];
    
    const loadedPlayers = await pb.collection('krasnodar_players').getFullList({ sort: '-is_active,name' });
    
    let loadedMatches = [];
    if (activeSeason) {
      loadedMatches = await pb.collection('krasnodar_matches').getFullList({ filter: `season_id="${activeSeason.id}"` });
    }

    return { activeSeason, loadedPlayers, loadedMatches };
  };

  const fetchMatchesOnly = async (seasonId) => {
    return await pb.collection('krasnodar_matches').getFullList({ filter: `season_id="${seasonId}"` });
  };

  const fetchPlayersOnly = async () => {
    return await pb.collection('krasnodar_players').getFullList({ sort: '-is_active,name' });
  };

  useEffect(() => {
    let ignore = false;
    fetchKrasnodarData()
      .then(data => {
        if (!ignore) {
          setSeason(data.activeSeason);
          setPlayers(data.loadedPlayers);
          setMatches(data.loadedMatches);
        }
      })
      .catch(err => console.error("Ошибка:", err));
    return () => { ignore = true; };
  }, []);

  // --- ЛОГИКА ИГРОКОВ ---
  const handleSavePlayer = async (e) => {
    e.preventDefault();
    if (editingPlayerId) await pb.collection('krasnodar_players').update(editingPlayerId, playerForm);
    else await pb.collection('krasnodar_players').create(playerForm);
    
    setShowPlayerForm(false); setEditingPlayerId(null);
    resetPlayerForm();
    fetchPlayersOnly().then(data => setPlayers(data)).catch(console.error);
  };

  const handleEditPlayer = (player) => {
    setEditingPlayerId(player.id);
    setPlayerForm({ ...player });
    setShowPlayerForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeletePlayer = async (id, name) => {
    if (window.confirm(`Удалить игрока "${name}" из базы?`)) {
      await pb.collection('krasnodar_players').delete(id);
      fetchPlayersOnly().then(data => setPlayers(data)).catch(console.error);
    }
  };

  const resetPlayerForm = () => {
    setPlayerForm({
      name: '', is_active: true, base_games: 0, base_goals: 0, base_assists: 0, 
      base_clean_sheets: 0, base_best_player: 0, base_yellow_cards: 0, base_red_cards: 0
    });
  };

  // --- ЛОГИКА МАТЧЕЙ ---
  const handleTogglePlayerInMatch = (playerId) => {
    setMatchStats(prev => {
      const updated = { ...prev };
      if (updated[playerId]?.played) {
        delete updated[playerId]; // Если галочка снимается, удаляем его стату из матча
      } else {
        updated[playerId] = { played: true, goals: 0, assists: 0, clean_sheet: false, motm: false, yellow: 0, red: 0 };
      }
      return updated;
    });
  };

  const handleUpdatePlayerStat = (playerId, field, value) => {
    setMatchStats(prev => ({
      ...prev,
      [playerId]: { ...prev[playerId], [field]: value }
    }));
  };

  const handleSaveMatch = async (e) => {
    e.preventDefault();
    if (!season) return;

    // Конвертируем словарь в массив JSON
    const statsArray = Object.keys(matchStats).map(pId => ({
      player_id: pId, ...matchStats[pId]
    }));

    const matchData = { ...matchForm, season_id: season.id, stats: statsArray };

    if (editingMatchId) await pb.collection('krasnodar_matches').update(editingMatchId, matchData);
    else await pb.collection('krasnodar_matches').create(matchData);
    
    setShowMatchForm(false); setEditingMatchId(null);
    setMatchForm({ opponent: '', score: '' }); setMatchStats({});
    fetchMatchesOnly(season.id).then(data => setMatches(data)).catch(console.error);
  };

  const handleEditMatch = (match) => {
    setEditingMatchId(match.id);
    setMatchForm({ opponent: match.opponent, score: match.score });
    window.scrollTo({ top: 0, behavior: 'smooth' });
    
    const statsDict = {};
    if (Array.isArray(match.stats)) {
      match.stats.forEach(s => {
        statsDict[s.player_id] = s;
      });
    }
    setMatchStats(statsDict);
    setShowMatchForm(true);
  };

  const handleDeleteMatch = async (id) => {
    if (window.confirm("Удалить этот матч? Статистика игроков пересчитается автоматически.")) {
      await pb.collection('krasnodar_matches').delete(id);
      fetchMatchesOnly(season.id).then(data => setMatches(data)).catch(console.error);
    }
  };

  // --- ЗАВЕРШЕНИЕ СЕЗОНА (ПЕРЕНОС В АРХИВ + ПРОВЕРКА 0 ИГР) ---
  const handleArchiveKrasnodarSeason = async () => {
    if (!window.confirm("ВНИМАНИЕ! Эта кнопка прибавит статистику ТЕКУЩЕГО сезона к историческим данным игроков. Делайте это ТОЛЬКО в конце сезона!")) return;
    
    try {
      const stats = calculateStats(players, matches, 'CURRENT');
      for (const p of stats) {
        if (p.games > 0) {
          await pb.collection('krasnodar_players').update(p.id, {
            base_games: p.base_games + p.games,
            base_goals: p.base_goals + p.goals,
            base_assists: p.base_assists + p.assists,
            base_clean_sheets: p.base_clean_sheets + p.clean_sheets,
            base_best_player: p.base_best_player + p.best_player,
            base_yellow_cards: p.base_yellow_cards + p.yellow_cards,
            base_red_cards: p.base_red_cards + p.red_cards
          });
        }
      }
      alert("Статистика успешно заархивирована в профили игроков!");
      fetchPlayersOnly().then(data => setPlayers(data)).catch(console.error);
    } catch (error) {
      console.error(error);
      alert("Ошибка при сохранении!");
    }
  };

  // --- ВЫЧИСЛЕНИЯ СТАТИСТИКИ ---
  const calculateStats = (playersList, matchesList, mode) => {
    return playersList.map(p => {
      let current = { games: 0, goals: 0, assists: 0, clean_sheets: 0, best_player: 0, yellow_cards: 0, red_cards: 0 };
      
      matchesList.forEach(m => {
        if (Array.isArray(m.stats)) {
          const pStat = m.stats.find(s => s.player_id === p.id);
          if (pStat && pStat.played) {
            current.games += 1;
            current.goals += (pStat.goals || 0);
            current.assists += (pStat.assists || 0);
            if (pStat.clean_sheet) current.clean_sheets += 1;
            if (pStat.motm) current.best_player += 1;
            current.yellow_cards += (pStat.yellow || 0);
            current.red_cards += (pStat.red || 0);
          }
        }
      });

      if (mode === 'ALL_TIME') {
        return {
          ...p,
          games: current.games + p.base_games, goals: current.goals + p.base_goals,
          assists: current.assists + p.base_assists, clean_sheets: current.clean_sheets + p.base_clean_sheets,
          best_player: current.best_player + p.base_best_player, yellow_cards: current.yellow_cards + p.base_yellow_cards,
          red_cards: current.red_cards + p.base_red_cards,
        };
      }
      return { ...p, ...current };
    });
  };

  const statsData = calculateStats(players, matches, viewMode)
    .filter(p => viewMode === 'ALL_TIME' ? (p.games > 0 || p.is_active) : (p.games > 0 || p.is_active))
    .sort((a, b) => b[activeTab] - a[activeTab]); // Сортировка по активной вкладке

  // Игроки с 0 игр за сезон
  const zeroGamesPlayers = calculateStats(players, matches, 'CURRENT')
    .filter(p => p.is_active && p.games === 0);

  return (
    <div className="space-y-6">
      
      {/* ШАПКА */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-zinc-900 p-4 rounded-xl border border-emerald-900/50">
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setViewMode('CURRENT')}
            className={`px-4 py-2 rounded-lg font-bold transition-colors ${viewMode === 'CURRENT' ? 'bg-emerald-700 text-white' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'}`}>
            Сезон {season ? season.title.replace('Сезон', '').trim() : ''}
          </button>
          <button onClick={() => setViewMode('ALL_TIME')}
            className={`px-4 py-2 rounded-lg font-bold transition-colors ${viewMode === 'ALL_TIME' ? 'bg-emerald-700 text-white' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'}`}>
            За всю историю
          </button>
        </div>
        
        <div className="flex flex-wrap items-center gap-2">
          {viewMode === 'CURRENT' && (
            <>
              <button onClick={() => setShowZeroGamesReport(true)} className="flex items-center gap-2 bg-amber-900/50 hover:bg-amber-900 text-amber-500 border border-amber-900 px-3 py-2 rounded-lg font-bold text-sm">
                <AlertTriangle size={16} /> 0 игр
              </button>
              <button onClick={handleArchiveKrasnodarSeason} className="flex items-center gap-2 bg-red-950 hover:bg-red-900 text-red-400 border border-red-900/50 px-3 py-2 rounded-lg font-bold text-sm">
                <Save size={16} /> Завершить сезон
              </button>
              <button onClick={() => setShowMatchForm(!showMatchForm)} className="flex items-center gap-2 bg-emerald-700 hover:bg-emerald-600 text-white px-3 py-2 rounded-lg font-bold text-sm">
                {showMatchForm ? <X size={16} /> : <Plus size={16} />} Матч
              </button>
            </>
          )}
          <button onClick={() => { setShowPlayerForm(!showPlayerForm); if(!showPlayerForm) resetPlayerForm(); setEditingPlayerId(null); }} 
            className="flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-white border border-zinc-700 px-3 py-2 rounded-lg font-bold text-sm">
            {showPlayerForm ? <X size={16} /> : <UserPlus size={16} />} Игрок
          </button>
        </div>
      </div>

      {/* МОДАЛКА: ОТЧЕТ 0 ИГР */}
      {showZeroGamesReport && (
        <div className="bg-amber-950/50 border border-amber-900/50 p-6 rounded-xl space-y-4">
          <div className="flex justify-between items-center text-amber-500 font-bold text-lg">
            <span className="flex items-center gap-2"><AlertTriangle /> Игроки без матчей в текущем сезоне</span>
            <button onClick={() => setShowZeroGamesReport(false)} className="hover:text-amber-300"><X size={20}/></button>
          </div>
          <p className="text-sm text-amber-200/70">Эти игроки числятся в активном составе, но не сыграли ни одного матча в этом сезоне. Проверьте, нужно ли перевести их в бывшие игроки или удалить.</p>
          <div className="flex flex-wrap gap-2">
            {zeroGamesPlayers.length === 0 ? (
              <span className="text-emerald-400 font-bold">Таких игроков нет! Все при деле.</span>
            ) : (
              zeroGamesPlayers.map(p => (
                <div key={p.id} className="bg-amber-900/50 text-amber-100 px-3 py-1 rounded-full text-sm flex items-center gap-2 border border-amber-800/50">
                  {p.name}
                  <button onClick={() => handleEditPlayer(p)} className="hover:text-white" title="Редактировать профиль"><Edit2 size={14} /></button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ФОРМА ИГРОКА */}
      {showPlayerForm && (
        <form onSubmit={handleSavePlayer} className="bg-zinc-900 p-6 rounded-xl border border-emerald-900/50 space-y-4 shadow-lg">
          <h3 className="text-xl font-bold text-white">{editingPlayerId ? 'Редактировать игрока' : 'Добавить игрока Краснодара'}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input type="text" placeholder="Имя и Фамилия" required className="bg-black border border-zinc-700 p-2 rounded text-white"
              value={playerForm.name} onChange={e => setPlayerForm({...playerForm, name: e.target.value})} />
            <label className="flex items-center gap-2 text-white bg-black border border-zinc-700 p-2 rounded cursor-pointer">
              <input type="checkbox" checked={playerForm.is_active} onChange={e => setPlayerForm({...playerForm, is_active: e.target.checked})} className="w-5 h-5 accent-emerald-600" />
              Текущий игрок состава
            </label>
          </div>
          
          <p className="text-sm text-zinc-400 mt-2">Историческая статистика (до добавления в приложение):</p>
          <div className="grid grid-cols-4 md:grid-cols-7 gap-2">
            {[ { k: 'base_games', l: 'Игры' }, { k: 'base_goals', l: 'Голы' }, { k: 'base_assists', l: 'Пасы' }, { k: 'base_clean_sheets', l: 'Сухие' }, { k: 'base_best_player', l: 'Лучший' }, { k: 'base_yellow_cards', l: 'ЖК' }, { k: 'base_red_cards', l: 'КК' }].map(f => (
              <div key={f.k} className="flex flex-col">
                <label className="text-xs text-zinc-500 mb-1">{f.l}</label>
                <input type="number" min="0" required onFocus={e=>e.target.select()} className="bg-black border border-zinc-700 p-2 rounded text-center text-white text-sm"
                  value={playerForm[f.k]} onChange={e => setPlayerForm({...playerForm, [f.k]: Number(e.target.value)})} />
              </div>
            ))}
          </div>
          <button type="submit" className="w-full bg-emerald-700 hover:bg-emerald-600 py-3 rounded-lg font-bold text-white">Сохранить игрока</button>
        </form>
      )}

      {/* ФОРМА МАТЧА */}
      {showMatchForm && viewMode === 'CURRENT' && (
        <form onSubmit={handleSaveMatch} className="bg-zinc-900 p-6 rounded-xl border border-emerald-900/50 space-y-6 shadow-lg">
          <div className="flex justify-between">
            <h3 className="text-xl font-bold text-white">{editingMatchId ? 'Редактировать матч' : 'Внести матч Краснодара'}</h3>
            <button type="button" onClick={() => {setShowMatchForm(false); setMatchStats({});}} className="text-zinc-500 hover:text-white"><X size={24}/></button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input type="text" placeholder="Соперник (напр. Зенит)" required className="bg-black border border-zinc-700 p-2 rounded text-white"
              value={matchForm.opponent} onChange={e => setMatchForm({...matchForm, opponent: e.target.value})} />
            <input type="text" placeholder="Счет (напр. 2:0)" required className="bg-black border border-zinc-700 p-2 rounded text-white"
              value={matchForm.score} onChange={e => setMatchForm({...matchForm, score: e.target.value})} />
          </div>

          <div className="space-y-3">
            <h4 className="text-sm font-bold text-emerald-400 border-b border-zinc-800 pb-2">Кто играл и что сделал?</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2 max-h-96 overflow-y-auto pr-2">
              {/* Показываем только активных игроков для выбора */}
              {players.filter(p => p.is_active).map(p => {
                const stat = matchStats[p.id];
                const isPlayed = !!stat?.played;
                return (
                  <div key={p.id} className={`p-3 rounded-lg border transition-colors ${isPlayed ? 'bg-emerald-950/30 border-emerald-900/50' : 'bg-black border-zinc-800 opacity-70 hover:opacity-100'}`}>
                    <div className="flex items-center gap-3 cursor-pointer" onClick={() => handleTogglePlayerInMatch(p.id)}>
                      {isPlayed ? <CheckSquare className="text-emerald-500" size={20}/> : <Square className="text-zinc-600" size={20}/>}
                      <span className={`font-bold ${isPlayed ? 'text-white' : 'text-zinc-400'}`}>{p.name}</span>
                    </div>
                    
                    {isPlayed && (
                      <div className="mt-3 pt-3 border-t border-emerald-900/30 grid grid-cols-3 gap-2 text-xs">
                        <div className="flex flex-col gap-1">
                          <label className="text-zinc-500">Голы</label>
                          <input type="number" min="0" className="bg-black border border-zinc-700 p-1 rounded text-center text-white" onFocus={e=>e.target.select()}
                            value={stat.goals} onChange={e => handleUpdatePlayerStat(p.id, 'goals', Number(e.target.value))} />
                        </div>
                        <div className="flex flex-col gap-1">
                          <label className="text-zinc-500">Пасы</label>
                          <input type="number" min="0" className="bg-black border border-zinc-700 p-1 rounded text-center text-white" onFocus={e=>e.target.select()}
                            value={stat.assists} onChange={e => handleUpdatePlayerStat(p.id, 'assists', Number(e.target.value))} />
                        </div>
                        <div className="flex flex-col gap-1">
                          <label className="text-zinc-500">ЖК</label>
                          <input type="number" min="0" max="2" className="bg-black border border-zinc-700 p-1 rounded text-center text-white" onFocus={e=>e.target.select()}
                            value={stat.yellow} onChange={e => handleUpdatePlayerStat(p.id, 'yellow', Number(e.target.value))} />
                        </div>
                        <div className="col-span-3 flex justify-between items-center mt-1">
                          <label className="flex items-center gap-1 text-zinc-400 cursor-pointer hover:text-white">
                            <input type="checkbox" checked={stat.clean_sheet} onChange={e => handleUpdatePlayerStat(p.id, 'clean_sheet', e.target.checked)} className="accent-emerald-600"/> Сухой
                          </label>
                          <label className="flex items-center gap-1 text-zinc-400 cursor-pointer hover:text-amber-400">
                            <input type="checkbox" checked={stat.motm} onChange={e => handleUpdatePlayerStat(p.id, 'motm', e.target.checked)} className="accent-amber-500"/> Лучший
                          </label>
                          <label className="flex items-center gap-1 text-zinc-400 cursor-pointer hover:text-red-400">
                            <input type="checkbox" checked={stat.red > 0} onChange={e => handleUpdatePlayerStat(p.id, 'red', e.target.checked ? 1 : 0)} className="accent-red-600"/> КК
                          </label>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
          <button type="submit" className="w-full bg-emerald-700 hover:bg-emerald-600 py-3 rounded-lg font-bold text-white shadow-lg">Сохранить матч</button>
        </form>
      )}

      {/* ВКЛАДКИ СТАТИСТИКИ (7 ШТУК) */}
      <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)}
            className={`px-4 py-2 rounded-lg font-bold transition-all whitespace-nowrap ${
              activeTab === t.key ? 'bg-zinc-800 text-emerald-400 border border-emerald-900/50 shadow-lg' : 'bg-transparent text-zinc-500 hover:text-white hover:bg-zinc-800'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ТАБЛИЦА СТАТИСТИКИ */}
      <div className="bg-zinc-900 rounded-xl border border-emerald-900/50 overflow-x-auto shadow-lg">
        <table className="w-full text-center text-sm">
          <thead className="bg-black border-b border-emerald-900/50">
            <tr>
              <th className="p-3 text-zinc-500 font-medium w-10">№</th>
              <th className="p-3 text-zinc-500 font-medium text-left">Игрок</th>
              <th className="p-3 text-emerald-500 font-bold text-lg bg-emerald-950/20">{TABS.find(t=>t.key===activeTab).label}</th>
              {TABS.filter(t => t.key !== activeTab).map(t => (
                <th key={t.key} className="p-3 text-zinc-600 font-medium hidden sm:table-cell" title={t.label}>
                  {t.label.substring(0, 3)}.
                </th>
              ))}
              <th className="p-3 text-zinc-500 font-medium">Статус</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {statsData.length === 0 ? <tr><td colSpan="10" className="p-6 text-zinc-600">Нет данных для отображения.</td></tr> :
              statsData.map((p, i) => (
                <tr key={p.id} className="border-b border-zinc-800/50 hover:bg-zinc-800 text-white transition-colors">
                  <td className="p-3 font-bold text-zinc-500">{i + 1}</td>
                  <td className="p-3 text-left font-bold">{p.name}</td>
                  <td className="p-3 text-emerald-400 font-black text-lg bg-emerald-950/20">{p[activeTab]}</td>
                  {TABS.filter(t => t.key !== activeTab).map(t => (
                    <td key={t.key} className="p-3 text-zinc-400 hidden sm:table-cell">{p[t.key]}</td>
                  ))}
                  <td className="p-3">
                    {p.is_active ? <span className="text-xs bg-emerald-900/50 text-emerald-400 px-2 py-1 rounded-full border border-emerald-800">В составе</span> 
                                 : <span className="text-xs bg-zinc-800 text-zinc-400 px-2 py-1 rounded-full border border-zinc-700">Бывший</span>}
                  </td>
                  <td className="p-3">
                    <div className="flex gap-2 justify-end">
                      <button onClick={() => handleEditPlayer(p)} className="text-zinc-500 hover:text-emerald-400"><Edit2 size={16}/></button>
                      <button onClick={() => handleDeletePlayer(p.id, p.name)} className="text-zinc-500 hover:text-red-400"><Trash2 size={16}/></button>
                    </div>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {/* ИСТОРИЯ МАТЧЕЙ (показываем только в Текущем сезоне) */}
      {viewMode === 'CURRENT' && matches.length > 0 && (
        <div className="bg-zinc-900 p-6 rounded-xl border border-emerald-900/50 space-y-4 shadow-lg">
          <h3 className="text-lg font-bold text-white border-b border-zinc-800 pb-2">Сыгранные матчи ({matches.length})</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {matches.map(m => (
              <div key={m.id} className="bg-black/50 p-4 rounded-xl border border-zinc-800 flex flex-col gap-2">
                <div className="flex justify-between items-center border-b border-zinc-800 pb-2">
                  <div className="font-bold text-white">Краснодар <span className="text-emerald-400 mx-1">{m.score}</span> {m.opponent}</div>
                  <div className="flex gap-2">
                    <button onClick={() => handleEditMatch(m)} className="text-zinc-500 hover:text-emerald-400"><Edit2 size={14}/></button>
                    <button onClick={() => handleDeleteMatch(m.id)} className="text-zinc-500 hover:text-red-400"><Trash2 size={14}/></button>
                  </div>
                </div>
                <div className="text-xs text-zinc-400">
                  Сыграло игроков: <span className="text-white font-bold">{Array.isArray(m.stats) ? m.stats.filter(s=>s.played).length : 0}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}