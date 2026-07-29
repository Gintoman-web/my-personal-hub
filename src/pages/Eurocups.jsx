import { useState, useEffect } from 'react';
import pb from '../pb';
import { Plus, X, Edit2, Trash2, Flag, Globe } from 'lucide-react';

// Хелпер для отрисовки стадий или медалей
const renderEuroAchievement = (text) => {
  if (!text) return <span className="text-zinc-600">-</span>;
  const parts = text.split(/[\s,]+/).map(p => p.trim()).filter(Boolean);
  if (parts.length === 3 && parts.every(p => !isNaN(p))) {
    const [gold, silver, bronze] = parts;
    return (
      <div className="flex items-center gap-1 justify-center text-xs font-bold">
        {gold > 0 && <span className="text-amber-400">🥇{gold}</span>}
        {silver > 0 && <span className="text-zinc-300">🥈{silver}</span>}
        {bronze > 0 && <span className="text-amber-700">🥉{bronze}</span>}
      </div>
    );
  }
  return <span className="text-emerald-400 font-medium text-xs">{text}</span>;
};

export default function Eurocups() {
  const [teams, setTeams] = useState([]);
  const [matches, setMatches] = useState([]); // Только текущие (не архивированные) матчи
  const [season, setSeason] = useState(null);
  const [tab, setTab] = useState('CURRENT'); // 'CURRENT' | 'ALL'
  
  // Состояния форм
  const [showTeamForm, setShowTeamForm] = useState(false);
  const [editingTeamId, setEditingTeamId] = useState(null);
  const [teamForm, setTeamForm] = useState({
    name: '', u: 0, achievements_ucl: '', achievements_uel: '', achievements_ucl_conf: '',
    base_i: 0, base_v: 0, base_n: 0, base_p: 0, base_goals_scored: 0, base_goals_conceded: 0, base_points: 0
  });

  const [showMatchForm, setShowMatchForm] = useState(false);
  const [editingMatchId, setEditingMatchId] = useState(null);
  const [matchForm, setMatchForm] = useState({
    team_id: '', opponent: '', team_score: 0, opponent_score: 0
  });

  // ЧИСТЫЕ ФУНКЦИИ ЗАГРУЗКИ
  const fetchEuroData = async () => {
    let activeSeason;
    const seasons = await pb.collection('seasons').getFullList({ filter: 'is_active=true' });
    if (seasons.length > 0) activeSeason = seasons[0];
    
    const loadedTeams = await pb.collection('euro_teams').getFullList({ sort: '-base_points' });
    
    let loadedMatches = [];
    if (activeSeason) {
      loadedMatches = await pb.collection('euro_matches').getFullList({ 
        filter: `season_id="${activeSeason.id}" && is_archived=false` 
      });
    }

    return { activeSeason, loadedTeams, loadedMatches };
  };

  const fetchEuroMatchesOnly = async (seasonId) => {
    return await pb.collection('euro_matches').getFullList({ 
      filter: `season_id="${seasonId}" && is_archived=false` 
    });
  };

  const fetchEuroTeamsOnly = async () => {
    return await pb.collection('euro_teams').getFullList({ sort: '-base_points' });
  };

  useEffect(() => {
    let ignore = false;
    fetchEuroData()
      .then(data => {
        if (!ignore) {
          setSeason(data.activeSeason);
          setTeams(data.loadedTeams);
          setMatches(data.loadedMatches);
        }
      })
      .catch(err => console.error("Ошибка:", err));
    return () => { ignore = true; };
  }, []);

  // --- ЛОГИКА КОМАНД (ВКЛАДКА ОБЩАЯ) ---
  const handleSaveTeam = async (e) => {
    e.preventDefault();
    if (editingTeamId) await pb.collection('euro_teams').update(editingTeamId, teamForm);
    else await pb.collection('euro_teams').create(teamForm);
    
    setShowTeamForm(false); setEditingTeamId(null);
    setTeamForm({
      name: '', u: 0, achievements_ucl: '', achievements_uel: '', achievements_ucl_conf: '',
      base_i: 0, base_v: 0, base_n: 0, base_p: 0, base_goals_scored: 0, base_goals_conceded: 0, base_points: 0
    });
    fetchEuroTeamsOnly().then(data => setTeams(data)).catch(console.error);
  };

  const handleEditTeam = (team) => {
    setEditingTeamId(team.id);
    setTeamForm({ ...team });
    setShowTeamForm(true);
  };

  const handleDeleteTeam = async (id, name) => {
    if (window.confirm(`Удалить команду "${name}" из Еврокубков?`)) {
      await pb.collection('euro_teams').delete(id);
      fetchEuroTeamsOnly().then(data => setTeams(data)).catch(console.error);
    }
  };

  // --- ЛОГИКА МАТЧЕЙ (ВКЛАДКА ТЕКУЩИЙ СЕЗОН) ---
  const handleSaveMatch = async (e) => {
    e.preventDefault();
    if (!season || !matchForm.team_id) return;

    if (editingMatchId) {
      await pb.collection('euro_matches').update(editingMatchId, matchForm);
    } else {
      await pb.collection('euro_matches').create({
        ...matchForm, season_id: season.id, is_archived: false
      });
    }
    
    setShowMatchForm(false); setEditingMatchId(null);
    setMatchForm({ team_id: '', opponent: '', team_score: 0, opponent_score: 0 });
    fetchEuroMatchesOnly(season.id).then(data => setMatches(data)).catch(console.error);
  };

  const handleEditMatch = (match) => {
    setEditingMatchId(match.id);
    setMatchForm({
      team_id: match.team_id, opponent: match.opponent, 
      team_score: match.team_score, opponent_score: match.opponent_score
    });
    setShowMatchForm(true);
  };

  const handleDeleteMatch = async (id) => {
    if (window.confirm("Удалить этот матч?")) {
      await pb.collection('euro_matches').delete(id);
      fetchEuroMatchesOnly(season.id).then(data => setMatches(data)).catch(console.error);
    }
  };

  // --- ПЕРЕНОС ЕВРО-СЕЗОНА В АРХИВ ---
  const handleArchiveEuroSeason = async () => {
    if (!window.confirm("Приплюсовать текущие очки к историческим и очистить вкладку сезона?")) return;
    try {
      const activeTeamIds = [...new Set(matches.map(m => m.team_id))];
      
      for (const tId of activeTeamIds) {
        const team = teams.find(t => t.id === tId);
        const teamMatches = matches.filter(m => m.team_id === tId);
        
        let w = 0, d = 0, l = 0, gs = 0, gc = 0;
        teamMatches.forEach(m => {
          gs += m.team_score; gc += m.opponent_score;
          if (m.team_score > m.opponent_score) w++;
          else if (m.team_score === m.opponent_score) d++; else l++;
        });

        await pb.collection('euro_teams').update(tId, {
          u: team.u + 1,
          base_i: team.base_i + teamMatches.length,
          base_v: team.base_v + w, base_n: team.base_n + d, base_p: team.base_p + l,
          base_goals_scored: team.base_goals_scored + gs,
          base_goals_conceded: team.base_goals_conceded + gc,
          base_points: team.base_points + (w * 3) + (d * 1)
        });
      }

      for (const m of matches) {
        await pb.collection('euro_matches').update(m.id, { is_archived: true });
      }

      window.location.reload();
    } catch (error) {
      console.error(error); alert("Ошибка при архивации!");
    }
  };

  // --- ВЫЧИСЛЕНИЯ ДЛЯ ТАБЛИЦ ---
  const currentSeasonTable = teams.filter(t => matches.some(m => m.team_id === t.id)).map(team => {
    const teamMatches = matches.filter(m => m.team_id === team.id);
    let w = 0, d = 0, l = 0, gs = 0, gc = 0;
    teamMatches.forEach(m => {
      gs += m.team_score; gc += m.opponent_score;
      if (m.team_score > m.opponent_score) w++;
      else if (m.team_score === m.opponent_score) d++; else l++;
    });
    return {
      ...team, s_i: teamMatches.length, s_w: w, s_d: d, s_l: l,
      s_gs: gs, s_gc: gc, s_points: (w * 3) + (d * 1)
    };
  }).sort((a, b) => b.s_points - a.s_points);

  return (
    <div className="space-y-6">
      {/* Шапка */}
      <div className="flex justify-between items-center bg-zinc-900 p-4 rounded-xl border border-emerald-900/50">
        <div className="flex space-x-2">
          <button onClick={() => setTab('CURRENT')}
            className={`px-4 py-2 rounded-lg font-bold transition-colors flex items-center gap-2 ${
              tab === 'CURRENT' ? 'bg-emerald-700 text-white' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
            }`}>
            <Globe size={18} /> Текущий сезон
          </button>
          <button onClick={() => setTab('ALL')}
            className={`px-4 py-2 rounded-lg font-bold transition-colors ${
              tab === 'ALL' ? 'bg-emerald-700 text-white' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
            }`}>
            Общая таблица
          </button>
        </div>
        
        {tab === 'CURRENT' ? (
          <div className="flex items-center gap-2">
             <button onClick={handleArchiveEuroSeason} className="hidden md:flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-emerald-400 border border-emerald-900/50 px-4 py-2 rounded-lg font-bold">
              <Flag size={18} /> Завершить сезон 
            </button>
            <button onClick={() => setShowMatchForm(!showMatchForm)} className="flex items-center gap-2 bg-emerald-700 hover:bg-emerald-600 text-white px-4 py-2 rounded-lg font-bold">
              {showMatchForm ? <X size={20} /> : <Plus size={20} />} <span className="hidden sm:inline">Внести матч</span>
            </button>
          </div>
        ) : (
          <button onClick={() => setShowTeamForm(!showTeamForm)} className="flex items-center gap-2 bg-emerald-700 hover:bg-emerald-600 text-white px-4 py-2 rounded-lg font-bold">
            {showTeamForm ? <X size={20} /> : <Plus size={20} />} <span className="hidden sm:inline">Команда</span>
          </button>
        )}
      </div>

      {/* --- ВКЛАДКА: ТЕКУЩИЙ СЕЗОН --- */}
      {tab === 'CURRENT' && (
        <div className="space-y-6">
          {showMatchForm && (
            <form onSubmit={handleSaveMatch} className="bg-zinc-900 p-6 rounded-xl border border-emerald-900/50 space-y-4 shadow-lg">
              <h3 className="text-xl font-bold text-white">{editingMatchId ? 'Редактировать евро-матч' : 'Новый евро-матч'}</h3>
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-center">
                <select required className="col-span-2 w-full bg-black border border-zinc-700 p-2 rounded text-white"
                  value={matchForm.team_id} onChange={e => setMatchForm({...matchForm, team_id: e.target.value})}>
                  <option value="" disabled>Наша команда...</option>
                  {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
                <div className="col-span-1 flex justify-center items-center gap-2">
                  <input type="number" min="0" required onFocus={e => e.target.select()} className="w-16 bg-black border border-zinc-700 p-2 rounded text-center text-white font-bold"
                    value={matchForm.team_score} onChange={e => setMatchForm({...matchForm, team_score: Number(e.target.value)})} />
                  <span className="text-zinc-500 font-bold">:</span>
                  <input type="number" min="0" required onFocus={e => e.target.select()} className="w-16 bg-black border border-zinc-700 p-2 rounded text-center text-white font-bold"
                    value={matchForm.opponent_score} onChange={e => setMatchForm({...matchForm, opponent_score: Number(e.target.value)})} />
                </div>
                <input type="text" placeholder="Соперник (напр. Арсенал)" required className="col-span-2 w-full bg-black border border-zinc-700 p-2 rounded text-white"
                  value={matchForm.opponent} onChange={e => setMatchForm({...matchForm, opponent: e.target.value})} />
              </div>
              <button type="submit" className="w-full bg-emerald-700 hover:bg-emerald-600 py-3 rounded-lg font-bold text-white">Сохранить</button>
            </form>
          )}

          <div className="bg-zinc-900 rounded-xl border border-emerald-900/50 overflow-x-auto">
            <table className="w-full text-center">
              <thead className="bg-black border-b border-emerald-900/50">
                <tr>
                  <th className="p-3 text-zinc-500 font-medium">М</th>
                  <th className="p-3 text-zinc-500 font-medium text-left">Команда</th>
                  <th className="p-3 text-zinc-500 font-medium">И</th>
                  <th className="p-3 text-zinc-500 font-medium">В</th>
                  <th className="p-3 text-zinc-500 font-medium">Н</th>
                  <th className="p-3 text-zinc-500 font-medium">П</th>
                  <th className="p-3 text-zinc-500 font-medium">Мячи</th>
                  <th className="p-3 text-emerald-500 font-bold">О</th>
                </tr>
              </thead>
              <tbody>
                {currentSeasonTable.length === 0 ? <tr><td colSpan="8" className="p-6 text-zinc-600">Внесите результаты матчей, чтобы команды появились здесь.</td></tr> :
                  currentSeasonTable.map((t, i) => (
                    <tr key={t.id} className="border-b border-zinc-800/50 hover:bg-zinc-800 text-white">
                      <td className="p-3 font-bold text-zinc-500">{i + 1}</td>
                      <td className="p-3 text-left font-bold">{t.name}</td>
                      <td className="p-3">{t.s_i}</td><td className="p-3">{t.s_w}</td>
                      <td className="p-3">{t.s_d}</td><td className="p-3">{t.s_l}</td>
                      <td className="p-3">{t.s_gs} - {t.s_gc}</td><td className="p-3 font-bold text-emerald-400">{t.s_points}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>

          <div className="bg-zinc-900 p-6 rounded-xl border border-emerald-900/50 space-y-4">
            <h3 className="text-lg font-bold text-white border-b border-zinc-800 pb-2">Сыгранные матчи</h3>
            <div className="space-y-2">
              {matches.map(m => {
                const teamObj = teams.find(t => t.id === m.team_id);
                return (
                  <div key={m.id} className="bg-black/50 p-3 rounded-lg border border-zinc-800 flex justify-between items-center text-sm">
                    <div>
                      <span className="font-bold text-white">{teamObj?.name}</span>
                      <span className="mx-2 text-emerald-400 font-bold">{m.team_score} : {m.opponent_score}</span>
                      <span className="text-zinc-400">{m.opponent}</span>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => handleEditMatch(m)} className="text-zinc-500 hover:text-emerald-400"><Edit2 size={16} /></button>
                      <button onClick={() => handleDeleteMatch(m.id)} className="text-zinc-500 hover:text-red-400"><Trash2 size={16} /></button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* --- ВКЛАДКА: ОБЩАЯ ТАБЛИЦА --- */}
      {tab === 'ALL' && (
        <div className="space-y-6">
          {showTeamForm && (
            <form onSubmit={handleSaveTeam} className="bg-zinc-900 p-6 rounded-xl border border-emerald-900/50 space-y-4 shadow-lg">
              <h3 className="text-xl font-bold text-white">{editingTeamId ? 'Редактировать евро-команду' : 'Добавить команду в Еврокубки'}</h3>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <input type="text" placeholder="Название" required className="bg-black border border-zinc-700 p-2 rounded col-span-2 text-white"
                  value={teamForm.name} onChange={e => setTeamForm({...teamForm, name: e.target.value})} />
                <input type="text" placeholder="Стадия ЛЧ (напр. 1/2)" className="bg-black border border-zinc-700 p-2 rounded text-white"
                  value={teamForm.achievements_ucl} onChange={e => setTeamForm({...teamForm, achievements_ucl: e.target.value})} />
                <input type="text" placeholder="Стадия ЛЕ" className="bg-black border border-zinc-700 p-2 rounded text-white"
                  value={teamForm.achievements_uel} onChange={e => setTeamForm({...teamForm, achievements_uel: e.target.value})} />
                <input type="text" placeholder="Стадия ЛК" className="bg-black border border-zinc-700 p-2 rounded text-white"
                  value={teamForm.achievements_ucl_conf} onChange={e => setTeamForm({...teamForm, achievements_ucl_conf: e.target.value})} />
              </div>
              <div className="grid grid-cols-4 md:grid-cols-8 gap-2">
                {[{ key: 'u', label: 'У' }, { key: 'base_i', label: 'И' }, { key: 'base_v', label: 'В' }, { key: 'base_n', label: 'Н' }, { key: 'base_p', label: 'П' }, { key: 'base_goals_scored', label: 'Заб.' }, { key: 'base_goals_conceded', label: 'Проп.' }, { key: 'base_points', label: 'О' }].map(f => (
                  <div key={f.key} className="flex flex-col">
                    <label className="text-xs text-zinc-500 mb-1">{f.label}</label>
                    <input type="number" min="0" required onFocus={e => e.target.select()} className="bg-black border border-zinc-700 p-2 rounded text-center text-white"
                      value={teamForm[f.key]} onChange={e => setTeamForm({...teamForm, [f.key]: Number(e.target.value)})} />
                  </div>
                ))}
              </div>
              <button type="submit" className="w-full bg-emerald-700 hover:bg-emerald-600 py-3 rounded-lg font-bold text-white">Сохранить</button>
            </form>
          )}

          <div className="bg-zinc-900 rounded-xl border border-emerald-900/50 overflow-x-auto">
            <table className="w-full text-center text-sm">
              <thead className="bg-black border-b border-emerald-900/50">
                <tr>
                  <th className="p-3 text-zinc-500 font-medium">М</th>
                  <th className="p-3 text-zinc-500 font-medium text-left">Команда</th>
                  <th className="p-3 text-zinc-500 font-medium">У</th>
                  <th className="p-3 text-zinc-500 font-medium">И</th>
                  <th className="p-3 text-zinc-500 font-medium">В</th>
                  <th className="p-3 text-zinc-500 font-medium">Н</th>
                  <th className="p-3 text-zinc-500 font-medium">П</th>
                  <th className="p-3 text-zinc-500 font-medium">Мячи</th>
                  <th className="p-3 text-emerald-500 font-bold">О</th>
                  <th className="p-3 text-zinc-400 font-medium border-l border-zinc-800">ЛЧ</th>
                  <th className="p-3 text-zinc-400 font-medium">ЛЕ</th>
                  <th className="p-3 text-zinc-400 font-medium">ЛК</th>
                  <th className="p-3"></th>
                </tr>
              </thead>
              <tbody>
                {teams.map((t, i) => (
                  <tr key={t.id} className="border-b border-zinc-800/50 hover:bg-zinc-800 text-white">
                    <td className="p-3 font-bold text-zinc-500">{i + 1}</td>
                    <td className="p-3 text-left font-bold">{t.name}</td>
                    <td className="p-3 text-zinc-400">{t.u}</td>
                    <td className="p-3">{t.base_i}</td><td className="p-3">{t.base_v}</td>
                    <td className="p-3">{t.base_n}</td><td className="p-3">{t.base_p}</td>
                    <td className="p-3 whitespace-nowrap">{t.base_goals_scored} - {t.base_goals_conceded}</td>
                    <td className="p-3 font-bold text-emerald-400">{t.base_points}</td>
                    <td className="p-3 border-l border-zinc-800 bg-black/20">{renderEuroAchievement(t.achievements_ucl)}</td>
                    <td className="p-3 bg-black/20">{renderEuroAchievement(t.achievements_uel)}</td>
                    <td className="p-3 bg-black/20">{renderEuroAchievement(t.achievements_ucl_conf)}</td>
                    <td className="p-3">
                      <div className="flex gap-2 justify-end">
                        <button onClick={() => handleEditTeam(t)} className="text-zinc-500 hover:text-emerald-400"><Edit2 size={16} /></button>
                        <button onClick={() => handleDeleteTeam(t.id, t.name)} className="text-zinc-500 hover:text-red-400"><Trash2 size={16} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}