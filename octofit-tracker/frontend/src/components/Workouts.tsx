import { useEffect, useState } from 'react';
import { getJson } from '../api/client.js';
import { CapabilityCard } from './CapabilityCard.js';

type Workout = { title: string; reason: string };

export default function Workouts() {
  const [suggestions, setSuggestions] = useState<Workout[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const email = encodeURIComponent('mona@example.com');
    getJson<{ suggestions: Workout[] }>(`/api/workouts/suggestions/${email}`)
      .then((data) => setSuggestions(data.suggestions))
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'Unknown error'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <CapabilityCard title="Workout suggestions" description="Recommend workouts from activity patterns." loading={loading} error={error}>
      {suggestions.length === 0
        ? <p>No workout suggestions yet.</p>
        : <ul>{suggestions.map((workout, index) => <li key={index}>{workout.title}: {workout.reason}</li>)}</ul>}
    </CapabilityCard>
  );
}
