import React, { useEffect, useState } from 'react';
import { Target } from 'lucide-react';
import NeoButton from './NeoButton';
import { Input } from './ui';
import { getGoal, setGoal } from '../services/api';

/** Yearly reading goal: progress bar + set/edit target. Pass `goal` to show someone else's (read-only). */
const GoalWidget = ({ goal: external, readOnly = false }) => {
  const year = new Date().getFullYear();
  const [goal, setGoalState] = useState(external ?? null);
  const [editing, setEditing] = useState(false);
  const [target, setTarget] = useState('');

  useEffect(() => {
    if (external !== undefined) {
      setGoalState(external);
      return;
    }
    getGoal(year).then(setGoalState).catch(() => {});
  }, [external, year]);

  const save = async (e) => {
    e.preventDefault();
    const n = parseInt(target, 10);
    if (!n || n < 1) return;
    setGoalState(await setGoal(year, n));
    setEditing(false);
  };

  if (!goal) return null;
  const pct = goal.target_books ? Math.min(100, Math.round((100 * goal.books_finished) / goal.target_books)) : 0;

  return (
    <div className="bg-accent-teal border-[3px] border-border shadow-brutal p-5">
      <div className="flex items-center justify-between gap-3 mb-3">
        <h3 className="font-black text-xl flex items-center gap-2">
          <Target className="w-5 h-5" /> {goal.year ?? year} Reading Goal
        </h3>
        {!readOnly && !editing && (
          <button
            className="font-bold underline"
            onClick={() => {
              setTarget(goal.target_books || '');
              setEditing(true);
            }}
          >
            {goal.target_books ? 'Edit' : 'Set goal'}
          </button>
        )}
      </div>
      {editing ? (
        <form onSubmit={save} className="flex gap-2">
          <Input type="number" min={1} max={1000} value={target} onChange={(e) => setTarget(e.target.value)} placeholder="Books this year" autoFocus />
          <NeoButton type="submit" variant="navy" size="sm">Save</NeoButton>
        </form>
      ) : goal.target_books ? (
        <>
          <p className="font-bold text-lg mb-2">
            {goal.books_finished} of {goal.target_books} books ({pct}%)
          </p>
          <div className="h-5 bg-surface-white border-2 border-border" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
            <div className="h-full bg-accent-red border-r-2 border-border" style={{ width: `${pct}%` }} />
          </div>
        </>
      ) : (
        <p className="font-medium">{goal.books_finished} books logged this year. {!readOnly && 'Set a target to track progress.'}</p>
      )}
    </div>
  );
};

export default GoalWidget;
