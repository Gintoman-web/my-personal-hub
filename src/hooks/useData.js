import { useState, useEffect } from 'react';
import pb from '../pb';

/**
 * Хук для загрузки данных с обработкой ошибок и состоянием загрузки
 * @param {Function} fetchFn - Функция для получения данных
 * @param {Array} dependencies - Зависимости для useEffect
 */
export function useDataLoader(fetchFn, dependencies = []) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let ignore = false;
    
    const loadData = async () => {
      try {
        setLoading(true);
        setError(null);
        const result = await fetchFn();
        if (!ignore) {
          setData(result);
        }
      } catch (err) {
        if (!ignore) {
          setError(err);
          console.error("Ошибка загрузки данных:", err);
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    };

    loadData();
    
    return () => { ignore = true; };
  }, dependencies);

  return { data, loading, error, setData };
}

/**
 * Хук для работы с сезонами
 */
export function useSeason() {
  const [season, setSeason] = useState(null);
  const [teams, setTeams] = useState([]);
  const [matches, setMatches] = useState([]);
  const [scorers, setScorers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadSeasonData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      let activeSeason;
      const seasons = await pb.collection('seasons').getFullList({ 
        filter: 'is_active=true',
        $cache: 'no-store'
      });
      
      if (seasons.length > 0) {
        activeSeason = seasons[0];
      } else {
        const currentYear = new Date().getFullYear();
        const nextYearStr = String(currentYear + 1).slice(2);
        activeSeason = await pb.collection('seasons').create({ 
          title: `Сезон ${currentYear}/${nextYearStr}`, 
          is_active: true 
        });
      }

      const [loadedTeams, loadedMatches, loadedScorers] = await Promise.all([
        pb.collection('teams').getFullList(),
        pb.collection('matches').getFullList({ 
          filter: `season_id="${activeSeason.id}"`,
          $cache: 'no-store'
        }),
        pb.collection('scorers').getFullList()
      ]);

      setSeason(activeSeason);
      setTeams(loadedTeams);
      setMatches(loadedMatches);
      setScorers(loadedScorers);
    } catch (err) {
      setError(err);
      console.error("Ошибка загрузки данных сезона:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSeasonData();
  }, []);

  const refreshData = async () => {
    const seasonId = season?.id;
    if (!seasonId) return;
    
    try {
      const [updatedMatches, updatedScorers] = await Promise.all([
        pb.collection('matches').getFullList({ 
          filter: `season_id="${seasonId}"`,
          $cache: 'no-store'
        }),
        pb.collection('scorers').getFullList()
      ]);
      setMatches(updatedMatches);
      setScorers(updatedScorers);
    } catch (err) {
      console.error("Ошибка обновления данных:", err);
      throw err;
    }
  };

  return { 
    season, 
    teams, 
    matches, 
    scorers, 
    loading, 
    error, 
    refreshData,
    setSeason,
    setTeams,
    setMatches,
    setScorers
  };
}

/**
 * Хук для обработки матчей
 */
export function useMatchHandler(season, refreshCallback) {
  const [showMatchForm, setShowMatchForm] = useState(false);
  const [editingMatchId, setEditingMatchId] = useState(null);
  const [matchForm, setMatchForm] = useState({
    team_id: '', 
    opponent: '', 
    team_score: 0, 
    opponent_score: 0, 
    scorers_list: []
  });

  const handleStartEditMatch = (match) => {
    setEditingMatchId(match.id);
    setMatchForm({
      team_id: match.team_id, 
      opponent: match.opponent,
      team_score: match.team_score, 
      opponent_score: match.opponent_score,
      scorers_list: match.scorers_list || []
    });
    setShowMatchForm(true);
  };

  const handleDeleteMatch = async (matchId) => {
    if (!season || !window.confirm("Удалить матч?")) return;
    try {
      await pb.collection('matches').delete(matchId);
      if (refreshCallback) await refreshCallback();
    } catch (error) {
      console.error("Ошибка удаления матча:", error);
      throw error;
    }
  };

  const handleSaveMatch = async (e) => {
    e.preventDefault();
    if (!season || !matchForm.team_id) {
      alert("Выберите команду!");
      return;
    }

    try {
      if (editingMatchId) {
        await pb.collection('matches').update(editingMatchId, matchForm);
      } else {
        await pb.collection('matches').create({ 
          ...matchForm, 
          season_id: season.id 
        });
      }
      
      resetFormAndClose();
      if (refreshCallback) await refreshCallback();
    } catch (error) {
      console.error("Ошибка сохранения матча:", error);
      alert("Произошла ошибка при сохранении! Проверьте консоль.");
      throw error;
    }
  };

  const resetFormAndClose = () => {
    setShowMatchForm(false); 
    setEditingMatchId(null);
    setMatchForm({ 
      team_id: '', 
      opponent: '', 
      team_score: 0, 
      opponent_score: 0, 
      scorers_list: [] 
    });
  };

  const toggleMatchForm = () => {
    if (showMatchForm) {
      resetFormAndClose();
    } else {
      setShowMatchForm(true);
    }
  };

  return {
    showMatchForm,
    editingMatchId,
    matchForm,
    setMatchForm,
    handleStartEditMatch,
    handleDeleteMatch,
    handleSaveMatch,
    resetFormAndClose,
    toggleMatchForm
  };
}
