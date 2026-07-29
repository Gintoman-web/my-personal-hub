import { useState, useEffect } from 'react';
import pb from '../pb';
import { Plus, X, Trophy, Edit2, Trash2, Flag } from 'lucide-react';

export default function Season() {
  const [teams, setTeams] = useState([]);
  const [matches, setMatches] = useState([]);
  const [scorers, setScorers] = useState([]);
  const [tab, setTab] = useState('A');
  const [season, setSeason] = useState(null);
  
  const [showMatchForm, setShowMatchForm] = useState(false);
  const [editingMatchId, setEditingMatchId] = useState(null);

  const [matchForm, setMatchForm] = useState({
    team_id: '', opponent: '', team_score: 0, opponent_score: 0, scorers_list: []
  });

  const [newScorerName, setNewScorerName] = useState('');
  const [showAddScorerInput, setShowAddScorerInput] = useState(false);

  // ЧИСТЫЕ ФУНКЦИИ ФЕТЧИНГА
  const fetchSeasonData = async () => {
    let activeSeason;
    const seasons = await pb.collection('seasons').getFullList({ filter: 'is_active=true' });
    
    if (seasons.length > 0) {
      activeSeason = seasons[0];
    } else {
      const currentYear = new Date().getFullYear();
      const nextYearStr = String(currentYear + 1).slice(2);
      activeSeason = await pb.collection('seasons').create({ title: `Сезон ${currentYear}/${nextYearStr}`, is_active: true });
    }

    const loadedTeams = await pb.collection('teams').getFullList();
    const loadedMatches = await pb.collection('matches').getFullList({ filter: `season_id="${activeSeason.id}"` });
    const loadedScorers = await pb.collection('scorers').getFullList();

    return { activeSeason, loadedTeams, loadedMatches, loadedScorers };
  };

  const fetchMatchesAndScorers = async (seasonId) => {
    const updatedMatches = await pb.collection('matches').getFullList({ filter: `season_id="${seasonId}"` });
    const updatedScorers = await pb.collection('scorers').getFullList();
    return { updatedMatches, updatedScorers };
  };

  // СТРОГИЙ useEffect
  useEffect(() => {
    let ignore = false;
    fetchSeasonData()
      .then(data => {
        if (!ignore) {
          setSeason(data.activeSeason);
          setTeams(data.loadedTeams);
          setMatches(data.loadedMatches);
          setScorers(data.loadedScorers);
        }
      })
      .catch(err => console.error("Ошибка загрузки данных:", err));
    return () => { ignore = true; };
  }, []);

  // КНОПКА: ЗАВЕРШИТЬ СЕЗОН (ТРАНСФЕР ДАННЫХ В АРХИВ)
  const handleEndSeason = async () => {
    if (!season) return;
    const isConfirmed = window.confirm(
      "🚨 ВНИМАНИЕ! Вы точно хотите завершить сезон?\n\nВсе результаты будут приплюсованы к историческим данным команд в Архиве. Текущий сезон закроется, и начнется новый с чистого листа. Это действие нельзя отменить!"
    );
    if (!isConfirmed) return;

    try {
      // 1. Считаем и обновляем команды
      for (const team of teams) {
        const teamMatches = matches.filter(m => m.team_id === team.id);
        if (teamMatches.length === 0) continue; // Если не играли, пропускаем

        let w = 0, d = 0, l = 0, gs = 0, gc = 0;
        teamMatches.forEach(m => {
          gs += m.team_score;
          gc += m.opponent_score;
          if (m.team_score > m.opponent_score) w++;
          else if (m.team_score === m.opponent_score) d++;
          else l++;
        });

        const points = (w * 3) + (d * 1);

        await pb.collection('teams').update(team.id, {
          base_u: team.base_u + 1,
          base_i: team.base_i + teamMatches.length,
          base_v: team.base_v + w,
          base_n: team.base_n + d,
          base_p: team.base_p + l,
          base_goals_scored: team.base_goals_scored + gs,
          base_goals_conceded: team.base_goals_conceded + gc,
          base_points: team.base_points + points
        });
      }

      // 2. Считаем и обновляем бомбардиров
      const scorerGoals = {};
      matches.forEach(m => {
        if (Array.isArray(m.scorers_list)) {
          m.scorers_list.forEach(s => {
            if (!scorerGoals[s.scorer_id]) scorerGoals[s.scorer_id] = 0;
            scorerGoals[s.scorer_id] += s.count;
          });
        }
      });

      for (const scorerId of Object.keys(scorerGoals)) {
        const scorer = scorers.find(s => s.id === scorerId);
        if (scorer) {
          await pb.collection('scorers').update(scorerId, {
            base_goals: (scorer.base_goals || 0) + scorerGoals[scorerId]
          });
        }
      }

      // 3. Закрываем сезон и создаем новый
      await pb.collection('seasons').update(season.id, { is_active: false });
      
      const currentYear = new Date().getFullYear();
      const nextYearStr = String(currentYear + 1).slice(2);
      await pb.collection('seasons').create({ 
        title: `Сезон ${currentYear}/${nextYearStr}`, 
        is_active: true 
      });

      // Перезагружаем страницу, чтобы всё обнулилось визуально
      window.location.reload();
    } catch (error) {
      console.error("Ошибка при завершении сезона:", error);
      alert("Произошла ошибка при сохранении! Проверьте консоль.");
    }
  };

  // ФУНКЦИИ ФОРМЫ
  const handleCreateScorer = async () => {
    const name = newScorerName.trim();
    if (!name || !matchForm.team_id) return;

    // 1. Ищем исторического игрока строго по фамилии (без учета регистра)
    let existingScorer = scorers.find(s => 
      s.team_id === matchForm.team_id && 
      s.name.toLowerCase() === name.toLowerCase()
    );

    // 2. Если такого игрока никогда не было в истории клуба — создаем с нуля
    if (!existingScorer) {
      existingScorer = await pb.collection('scorers').create({
        name: name, team_id: matchForm.team_id, base_goals: 0
      });
      setScorers(prev => [...prev, existingScorer]);
    }

    // 3. Автоматически добавляем ему 1 гол в текущий заполняемый матч
    handleAddGoalToScorer(existingScorer);
    setNewScorerName(''); 
    setShowAddScorerInput(false);
  };

  const handleAddGoalToScorer = (scorer) => {
    const currentTotalGoals = matchForm.scorers_list.reduce((sum, s) => sum + s.count, 0);
    if (currentTotalGoals >= matchForm.team_score) {
      alert(`Все голы (${matchForm.team_score}) уже распределены!`); return;
    }
    setMatchForm(prev => {
      const idx = prev.scorers_list.findIndex(s => s.scorer_id === scorer.id);
      let updated = [...prev.scorers_list];
      if (idx >= 0) updated[idx].count += 1;
      else updated.push({ scorer_id: scorer.id, name: scorer.name, count: 1 });
      return { ...prev, scorers_list: updated };
    });
  };

  const handleStartEditMatch = (match) => {
    setEditingMatchId(match.id);
    setMatchForm({
      team_id: match.team_id, opponent: match.opponent,
      team_score: match.team_score, opponent_score: match.opponent_score,
      scorers_list: match.scorers_list || []
    });
    setShowMatchForm(true);
  };

  const handleDeleteMatch = async (matchId) => {
    if (!season || !window.confirm("Удалить матч?")) return;
    await pb.collection('matches').delete(matchId);
    fetchMatchesAndScorers(season.id).then(data => {
      setMatches(data.updatedMatches); setScorers(data.updatedScorers);
    }).catch(console.error);
  };

  const handleSaveMatch = async (e) => {
    e.preventDefault();
    if (!season || !matchForm.team_id) return;
    if (editingMatchId) await pb.collection('matches').update(editingMatchId, matchForm);
    else await pb.collection('matches').create({ ...matchForm, season_id: season.id });

    resetFormAndClose();
    fetchMatchesAndScorers(season.id).then(data => {
      setMatches(data.updatedMatches); setScorers(data.updatedScorers);
    }).catch(console.error);
  };

  const resetFormAndClose = () => {
    setShowMatchForm(false); setEditingMatchId(null);
    setMatchForm({ team_id: '', opponent: '', team_score: 0, opponent_score: 0, scorers_list: [] });
  };

  // ВЫЧИСЛЕНИЯ ТАБЛИЦЫ
  const getTableData = (group) => {
    return teams.filter(t => t.group === group).map(team => {
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
  };

  const getTopScorers = (group) => {
    const groupTeamIds = teams.filter(t => t.group === group).map(t => t.id);
    const groupMatches = matches.filter(m => groupTeamIds.includes(m.team_id));
    const scorerMap = {};
    groupMatches.forEach(m => {
      if (Array.isArray(m.scorers_list)) {
        m.scorers_list.forEach(s => {
          if (!scorerMap[s.name]) {
            const teamObj = teams.find(t => t.id === m.team_id);
            scorerMap[s.name] = { name: s.name, teamName: teamObj ? teamObj.name : '', goals: 0 };
          }
          scorerMap[s.name].goals += s.count;
        });
      }
    });
    return Object.values(scorerMap).sort((a, b) => b.goals - a.goals);
  };

  const tableData = getTableData(tab);
  const topScorers = getTopScorers(tab);
  // Фильтруем кнопки быстрого выбора: показываем ТОЛЬКО тех игроков, 
  // которые УЖЕ забивали в ТЕКУЩЕМ сезоне (чистый лист для каждого сезона)
  const currentSeasonScorerIds = new Set();
  matches.filter(m => m.team_id === matchForm.team_id).forEach(m => {
    if (Array.isArray(m.scorers_list)) {
      m.scorers_list.forEach(s => currentSeasonScorerIds.add(s.scorer_id));
    }
  });
  const currentTeamScorers = scorers.filter(s => currentSeasonScorerIds.has(s.id));
  const tabTeamIds = teams.filter(t => t.group === tab).map(t => t.id);
  const tabMatches = matches.filter(m => tabTeamIds.includes(m.team_id));

  return (
    <div className="space-y-6">
      
      {/* Шапка */}
      <div className="flex justify-between items-center bg-zinc-900 p-4 rounded-xl border border-emerald-900/50">
        <div className="flex space-x-2">
          {['A', 'B'].map(t => (
            <button key={t} onClick={() => { setTab(t); resetFormAndClose(); }}
              className={`px-4 py-2 rounded-lg font-bold transition-colors ${
                tab === t ? 'bg-emerald-700 text-white' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
              }`}>
              Сезон {t}
            </button>
          ))}
        </div>
        
        <div className="flex items-center gap-3">
          <span className="text-emerald-500 font-bold hidden md:inline mr-2">
            {season ? season.title : 'Загрузка...'}
          </span>
          
          <button onClick={handleEndSeason}
            className="flex items-center gap-2 bg-red-950 hover:bg-red-900 text-red-400 border border-red-900/50 px-4 py-2 rounded-lg font-bold transition-colors"
            title="Завершить текущий сезон">
            <Flag size={20} />
            <span className="hidden lg:inline">Завершить сезон</span>
          </button>

          <button onClick={() => { if (showMatchForm) resetFormAndClose(); else setShowMatchForm(true); }}
            className="flex items-center gap-2 bg-emerald-700 hover:bg-emerald-600 text-white px-4 py-2 rounded-lg font-bold transition-colors">
            {showMatchForm ? <X size={20} /> : <Plus size={20} />}
            <span className="hidden sm:inline">{showMatchForm ? 'Отмена' : 'Внести матч'}</span>
          </button>
        </div>
      </div>

      {/* Форма внесения матча */}
      {showMatchForm && (
        <form onSubmit={handleSaveMatch} className="bg-zinc-900 p-6 rounded-xl border border-emerald-900/50 space-y-6">
          <h3 className="text-xl font-bold text-white">
            {editingMatchId ? 'Редактировать результат матча' : 'Внести результат матча'}
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-center">
            <div className="col-span-2">
              <label className="text-xs text-zinc-400 mb-1 block">Наша команда</label>
              <select required className="w-full bg-black border border-zinc-700 p-2 rounded text-white"
                value={matchForm.team_id} onChange={e => setMatchForm({...matchForm, team_id: e.target.value, scorers_list: []})}>
                <option value="" disabled>Выберите команду...</option>
                {tableData.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>

            <div className="col-span-1 flex justify-center items-center gap-2 mt-4 md:mt-0">
              <input type="number" min="0" required onFocus={e => e.target.select()}
                className="w-16 bg-black border border-zinc-700 p-2 rounded text-center text-white font-bold"
                value={matchForm.team_score} onChange={e => setMatchForm({...matchForm, team_score: Number(e.target.value), scorers_list: []})} />
              <span className="text-zinc-500 font-bold">:</span>
              <input type="number" min="0" required onFocus={e => e.target.select()}
                className="w-16 bg-black border border-zinc-700 p-2 rounded text-center text-white font-bold"
                value={matchForm.opponent_score} onChange={e => setMatchForm({...matchForm, opponent_score: Number(e.target.value)})} />
            </div>

            <div className="col-span-2">
              <label className="text-xs text-zinc-400 mb-1 block">Команда соперника</label>
              <input type="text" placeholder="Например: Барселона" required
                className="w-full bg-black border border-zinc-700 p-2 rounded text-white"
                value={matchForm.opponent} onChange={e => setMatchForm({...matchForm, opponent: e.target.value})} />
            </div>
          </div>

          {matchForm.team_id && matchForm.team_score > 0 && (
            <div className="bg-black/50 p-4 rounded-lg border border-zinc-800 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm font-bold text-emerald-400">
                  Авторы ({matchForm.scorers_list.reduce((sum, s) => sum + s.count, 0)} из {matchForm.team_score})
                </span>
                <button type="button" onClick={() => setShowAddScorerInput(!showAddScorerInput)}
                  className="text-xs text-emerald-400 hover:underline">+ Новый игрок</button>
              </div>

              {showAddScorerInput && (
                <div className="flex gap-2">
                  <input type="text" placeholder="Имя игрока"
                    className="bg-zinc-900 border border-zinc-700 p-2 rounded text-sm text-white flex-1"
                    value={newScorerName} onChange={e => setNewScorerName(e.target.value)} />
                  <button type="button" onClick={handleCreateScorer}
                    className="bg-emerald-700 text-white px-3 py-1 rounded text-sm font-bold">Добавить</button>
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                {currentTeamScorers.length === 0 ? <p className="text-xs text-zinc-500">Добавьте игроков</p> :
                  currentTeamScorers.map(scorer => (
                    <button key={scorer.id} type="button" onClick={() => handleAddGoalToScorer(scorer)}
                      className="bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 px-3 py-1 rounded-full text-xs text-white flex items-center gap-2">
                      <span>{scorer.name}</span>
                      <span className="bg-emerald-900 text-emerald-300 font-bold px-1.5 py-0.5 rounded-full">+1</span>
                    </button>
                  ))}
              </div>

              {matchForm.scorers_list.length > 0 && (
                <div className="text-xs text-zinc-400 pt-2 border-t border-zinc-800 flex justify-between">
                  <span>Записано: {matchForm.scorers_list.map(s => `${s.name} (${s.count})`).join(', ')}</span>
                  <button type="button" onClick={() => setMatchForm({...matchForm, scorers_list: []})}
                    className="text-red-400 hover:underline">Сбросить</button>
                </div>
              )}
            </div>
          )}
          
          <button type="submit" className="w-full bg-emerald-700 hover:bg-emerald-600 py-3 rounded-lg font-bold text-white transition-colors">
            {editingMatchId ? 'Сохранить изменения' : 'Сохранить матч'}
          </button>
        </form>
      )}

      {/* Турнирная таблица */}
      <div className="bg-zinc-900 rounded-xl border border-emerald-900/50 overflow-x-auto shadow-lg">
        <table className="w-full text-center">
          <thead className="bg-black border-b border-emerald-900/50">
            <tr>
              <th className="p-3 text-zinc-500 font-medium">Место</th>
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
            {tableData.length === 0 ? (
              <tr><td colSpan="8" className="p-6 text-zinc-600">Команды не найдены.</td></tr>
            ) : (
              tableData.map((team, index) => (
                <tr key={team.id} className="border-b border-zinc-800/50 hover:bg-zinc-800 transition-colors text-white">
                  <td className="p-3 font-bold text-zinc-500">{index + 1}</td>
                  <td className="p-3 text-left font-bold">{team.name}</td>
                  <td className="p-3">{team.s_i}</td>
                  <td className="p-3">{team.s_w}</td>
                  <td className="p-3">{team.s_d}</td>
                  <td className="p-3">{team.s_l}</td>
                  <td className="p-3">{team.s_gs} - {team.s_gc}</td>
                  <td className="p-3 font-bold text-emerald-400">{team.s_points}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* История матчей */}
        <div className="bg-zinc-900 p-6 rounded-xl border border-emerald-900/50 space-y-4">
          <h3 className="text-lg font-bold text-white border-b border-zinc-800 pb-2">
            Сыгранные матчи ({tabMatches.length})
          </h3>
          <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
            {tabMatches.map(m => {
              const teamObj = teams.find(t => t.id === m.team_id);
              return (
                <div key={m.id} className="bg-black/50 p-3 rounded-lg border border-zinc-800 flex justify-between items-center text-sm">
                  <div>
                    <div>
                      <span className="font-bold text-white">{teamObj ? teamObj.name : 'Команда'}</span>
                      <span className="mx-2 text-emerald-400 font-bold">{m.team_score} : {m.opponent_score}</span>
                      <span className="text-zinc-400">{m.opponent}</span>
                    </div>
                    {Array.isArray(m.scorers_list) && m.scorers_list.length > 0 && (
                      <div className="text-xs text-zinc-500 mt-1">
                        ⚽ {m.scorers_list.map(s => `${s.name} (${s.count})`).join(', ')}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => handleStartEditMatch(m)} className="text-zinc-500 hover:text-emerald-400"><Edit2 size={16} /></button>
                    <button onClick={() => handleDeleteMatch(m.id)} className="text-zinc-500 hover:text-red-400"><Trash2 size={16} /></button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Бомбардиры */}
        <div className="bg-zinc-900 p-6 rounded-xl border border-emerald-900/50 space-y-4">
          <div className="flex items-center gap-2 text-emerald-400 font-bold text-lg border-b border-zinc-800 pb-2">
            <Trophy size={20} /> <span>Бомбардиры сезона {tab}</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-80 overflow-y-auto pr-1">
            {topScorers.map((scorer, i) => (
              <div key={i} className="bg-black/60 p-3 rounded-lg border border-zinc-800 flex justify-between items-center">
                <div>
                  <div className="font-bold text-white text-sm">{i + 1}. {scorer.name}</div>
                  <div className="text-xs text-zinc-500">{scorer.teamName}</div>
                </div>
                <div className="text-emerald-400 font-bold text-lg bg-emerald-950/50 px-3 py-1 rounded-lg border border-emerald-900/50">{scorer.goals}</div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}