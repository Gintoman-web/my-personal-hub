import { useState, useEffect } from 'react';
import pb from '../pb';
import { Trash2, Plus, X, Edit2, Trophy } from 'lucide-react';

// Хелпер для отрисовки медалек из строки "1 2 3"
const renderAchievements = (text) => {
  if (!text) return null;
  // Разбиваем по пробелам или запятым
  const parts = text.split(/[\s,]+/).map(p => p.trim()).filter(Boolean);
  if (parts.length === 3 && parts.every(p => !isNaN(p))) {
    const [gold, silver, bronze] = parts;
    return (
      <div className="flex items-center gap-2 justify-center font-bold text-sm">
        <span className="text-amber-400 drop-shadow" title="Золото">🥇 {gold}</span>
        <span className="text-zinc-300 drop-shadow" title="Серебро">🥈 {silver}</span>
        <span className="text-amber-700 drop-shadow" title="Бронза">🥉 {bronze}</span>
      </div>
    );
  }
  return <span className="text-amber-500 font-medium">{text}</span>;
};

export default function Archive() {
  const [teams, setTeams] = useState([]);
  const [scorers, setScorers] = useState([]);
  const [tab, setTab] = useState('A'); 
  const [showForm, setShowForm] = useState(false);
  
  const [editingTeamId, setEditingTeamId] = useState(null); // ID редактируемой команды
  
  const [formData, setFormData] = useState({
    name: '', group: 'A', achievements: '',
    base_u: 0, base_i: 0, base_v: 0, base_n: 0, base_p: 0,
    base_goals_scored: 0, base_goals_conceded: 0, base_points: 0
  });

  // ЧИСТАЯ АСИНХРОННАЯ ФУНКЦИЯ ЗАГРУЗКИ (ДО useEffect)
  const fetchArchiveData = async () => {
    const loadedTeams = await pb.collection('teams').getFullList({ sort: '-base_points' });
    const loadedScorers = await pb.collection('scorers').getFullList();
    return { loadedTeams, loadedScorers };
  };

  // СТРОГИЙ useEffect
  useEffect(() => {
    let ignore = false;
    
    fetchArchiveData()
      .then(data => {
        if (!ignore) {
          setTeams(data.loadedTeams);
          setScorers(data.loadedScorers);
        }
      })
      .catch(error => console.error("Ошибка загрузки архива:", error));

    return () => { ignore = true; };
  }, []);

  // Удаление команды
  const handleDelete = async (id, name) => {
    if (window.confirm(`Точно удалить команду "${name}"? Все её бомбардиры и матчи тоже исчезнут навсегда.`)) {
      await pb.collection('teams').delete(id);
      fetchArchiveData().then(data => {
        setTeams(data.loadedTeams); setScorers(data.loadedScorers);
      }).catch(console.error);
    }
  };

  // Открытие формы на редактирование
  const handleEditClick = (team) => {
    setEditingTeamId(team.id);
    setFormData({
      name: team.name, group: team.group, achievements: team.achievements,
      base_u: team.base_u, base_i: team.base_i, base_v: team.base_v,
      base_n: team.base_n, base_p: team.base_p,
      base_goals_scored: team.base_goals_scored, 
      base_goals_conceded: team.base_goals_conceded, 
      base_points: team.base_points
    });
    setShowForm(true);
  };

  // Сохранение (Создание или Обновление)
  const handleSaveSubmit = async (e) => {
    e.preventDefault();
    if (editingTeamId) {
      await pb.collection('teams').update(editingTeamId, formData);
    } else {
      await pb.collection('teams').create(formData);
    }
    
    resetFormAndClose();
    
    fetchArchiveData().then(data => {
      setTeams(data.loadedTeams); setScorers(data.loadedScorers);
    }).catch(console.error);
  };

  const resetFormAndClose = () => {
    setShowForm(false);
    setEditingTeamId(null);
    setFormData({
      name: '', group: 'A', achievements: '',
      base_u: 0, base_i: 0, base_v: 0, base_n: 0, base_p: 0,
      base_goals_scored: 0, base_goals_conceded: 0, base_points: 0
    });
  };

  // ФИЛЬТРАЦИЯ
  const displayedTeams = tab === 'ALL' ? teams : teams.filter(t => t.group === tab);
  
  // ВЫЧИСЛЕНИЕ ТОП-3 ИСТОРИЧЕСКИХ БОМБАРДИРОВ
  const getTopHistoricalScorers = () => {
    const displayedTeamIds = displayedTeams.map(t => t.id);
    const filteredScorers = scorers.filter(s => displayedTeamIds.includes(s.team_id));
    
    // Сортируем по историческим голам по убыванию
    filteredScorers.sort((a, b) => (b.base_goals || 0) - (a.base_goals || 0));
    
    // Берем только топ-3, у которых есть хотя бы 1 гол
    return filteredScorers.filter(s => s.base_goals > 0).slice(0, 3);
  };

  const topScorers = getTopHistoricalScorers();

  return (
    <div className="space-y-6">
      
      {/* Шапка и Вкладки */}
      <div className="flex justify-between items-center bg-zinc-900 p-4 rounded-xl border border-emerald-900/50">
        <div className="flex space-x-2">
          {['A', 'B', 'ALL'].map(t => (
            <button key={t} onClick={() => { setTab(t); resetFormAndClose(); }}
              className={`px-4 py-2 rounded-lg font-bold transition-colors ${
                tab === t ? 'bg-emerald-700 text-white' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
              }`}>
              {t === 'ALL' ? 'Общее' : `Сезон ${t}`}
            </button>
          ))}
        </div>
        <button
          onClick={() => { if (showForm) resetFormAndClose(); else setShowForm(true); }}
          className="flex items-center gap-2 bg-emerald-700 hover:bg-emerald-600 text-white px-4 py-2 rounded-lg font-bold transition-colors"
        >
          {showForm ? <X size={20} /> : <Plus size={20} />}
          <span className="hidden sm:inline">{showForm ? 'Отмена' : 'Добавить команду'}</span>
        </button>
      </div>

      {/* Форма */}
      {showForm && (
        <form onSubmit={handleSaveSubmit} className="bg-zinc-900 p-6 rounded-xl border border-emerald-900/50 space-y-4 shadow-lg shadow-black/50">
          <h3 className="text-xl font-bold mb-4 text-white">
            {editingTeamId ? 'Редактировать команду' : 'Новая команда в Архив'}
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <input type="text" placeholder="Название (напр. Лорьян)" required
              className="bg-black border border-zinc-700 p-2 rounded col-span-2 text-white"
              value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
            
            <select className="bg-black border border-zinc-700 p-2 rounded text-white"
              value={formData.group} onChange={e => setFormData({...formData, group: e.target.value})}>
              <option value="A">Группа A</option>
              <option value="B">Группа B</option>
            </select>
            
            <input type="text" placeholder="Достижения (напр. 0 2 1)"
              className="bg-black border border-zinc-700 p-2 rounded text-white"
              value={formData.achievements} onChange={e => setFormData({...formData, achievements: e.target.value})} />
          </div>

          <p className="text-sm text-zinc-400 mt-2">Стартовая (историческая) статистика:</p>
          <div className="grid grid-cols-4 md:grid-cols-8 gap-2">
            {[ 
              { key: 'base_u', label: 'У (Участия)' }, { key: 'base_i', label: 'И (Игры)' },
              { key: 'base_v', label: 'В (Победы)' }, { key: 'base_n', label: 'Н (Ничьи)' },
              { key: 'base_p', label: 'П (Пораж.)' }, { key: 'base_goals_scored', label: 'Забито' },
              { key: 'base_goals_conceded', label: 'Пропущ.' }, { key: 'base_points', label: 'Очки' }
            ].map(field => (
              <div key={field.key} className="flex flex-col">
                <label className="text-xs text-zinc-500 mb-1">{field.label}</label>
                <input type="number" min="0" required onFocus={e => e.target.select()}
                  className="bg-black border border-zinc-700 p-2 rounded text-center text-white font-bold"
                  value={formData[field.key]} onChange={e => setFormData({...formData, [field.key]: Number(e.target.value)})} />
              </div>
            ))}
          </div>
          
          <button type="submit" className="w-full bg-emerald-700 hover:bg-emerald-600 py-3 rounded-lg font-bold mt-4 text-white transition-colors">
            {editingTeamId ? 'Сохранить изменения' : 'Сохранить в базу'}
          </button>
        </form>
      )}

      {/* Таблица Архива */}
      <div className="bg-zinc-900 rounded-xl border border-emerald-900/50 overflow-x-auto shadow-lg">
        <table className="w-full text-center">
          <thead className="bg-black border-b border-emerald-900/50">
            <tr>
              <th className="p-3 text-zinc-500 font-medium">№</th>
              <th className="p-3 text-zinc-500 font-medium text-left">Команда</th>
              <th className="p-3 text-zinc-500 font-medium" title="Участия">У</th>
              <th className="p-3 text-zinc-500 font-medium">И</th>
              <th className="p-3 text-zinc-500 font-medium">В</th>
              <th className="p-3 text-zinc-500 font-medium">Н</th>
              <th className="p-3 text-zinc-500 font-medium">П</th>
              <th className="p-3 text-zinc-500 font-medium">Мячи</th>
              <th className="p-3 text-emerald-500 font-bold">О</th>
              <th className="p-3 text-zinc-500 font-medium text-center">Достижения</th>
              <th className="p-3 text-zinc-500 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {displayedTeams.length === 0 ? (
              <tr><td colSpan="11" className="p-6 text-zinc-600">В этой группе пока нет команд</td></tr>
            ) : (
              displayedTeams.map((team, index) => (
                <tr key={team.id} className="border-b border-zinc-800/50 hover:bg-zinc-800 transition-colors text-white">
                  <td className="p-3 font-bold text-zinc-500">{index + 1}</td>
                  <td className="p-3 text-left font-bold">{team.name}</td>
                  <td className="p-3 text-zinc-400">{team.base_u}</td>
                  <td className="p-3">{team.base_i}</td>
                  <td className="p-3">{team.base_v}</td>
                  <td className="p-3">{team.base_n}</td>
                  <td className="p-3">{team.base_p}</td>
                  <td className="p-3 whitespace-nowrap">{team.base_goals_scored} - {team.base_goals_conceded}</td>
                  <td className="p-3 font-bold text-emerald-400">{team.base_points}</td>
                  <td className="p-3 text-center">{renderAchievements(team.achievements)}</td>
                  <td className="p-3">
                    <div className="flex gap-2 justify-end">
                      <button onClick={() => handleEditClick(team)} className="text-zinc-500 hover:text-emerald-400 transition-colors" title="Редактировать">
                        <Edit2 size={18} />
                      </button>
                      <button onClick={() => handleDelete(team.id, team.name)} className="text-zinc-500 hover:text-red-400 transition-colors" title="Удалить">
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Блок «Исторические бомбардиры» */}
      <div className="bg-zinc-900 p-6 rounded-xl border border-emerald-900/50 space-y-4 shadow-lg">
        <div className="flex items-center gap-2 text-emerald-400 font-bold text-lg border-b border-zinc-800 pb-2">
          <Trophy size={20} />
          <span>Лучшие бомбардиры за всю историю ({tab === 'ALL' ? 'Общее' : `Группа ${tab}`})</span>
        </div>

        {topScorers.length === 0 ? (
          <p className="text-sm text-zinc-500">Исторических данных о голах пока нет.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {topScorers.map((scorer, i) => {
              const teamObj = teams.find(t => t.id === scorer.team_id);
              return (
                <div key={scorer.id} className="bg-black/60 p-4 rounded-xl border border-zinc-800 flex justify-between items-center relative overflow-hidden">
                  {/* Декоративная медалька для топ-3 */}
                  <div className="absolute -right-4 -top-4 opacity-10 text-6xl">
                    {i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉'}
                  </div>
                  <div className="relative z-10">
                    <div className="font-bold text-white text-lg">{i + 1}. {scorer.name}</div>
                    <div className="text-sm text-zinc-500">{teamObj ? teamObj.name : 'Неизвестно'}</div>
                  </div>
                  <div className="relative z-10 text-amber-400 font-black text-2xl bg-amber-950/30 px-4 py-2 rounded-lg border border-amber-900/50">
                    {scorer.base_goals}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
}