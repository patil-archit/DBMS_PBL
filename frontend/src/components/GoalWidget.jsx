import React, { useEffect, useState } from 'react';
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

  const R = 52;
  const C = 2 * Math.PI * R;
  return (
    <div className="border-t border-border pt-3">
      <div className="flex items-center justify-between gap-3 mb-5">
        <p className="label">( {goal.year ?? year} reading goal )</p>
        {!readOnly && !editing && (
          <button className="label !text-text-main link-under" onClick={() => { setTarget(goal.target_books || ''); setEditing(true); }}>
            {goal.target_books ? 'Edit' : 'Set goal'}
          </button>
        )}
      </div>
      {editing ? (
        <form onSubmit={save} className="flex gap-2">
          <Input type="number" min={1} max={1000} value={target} onChange={(e) => setTarget(e.target.value)} placeholder="Books this year" autoFocus />
          <NeoButton type="submit" size="md">Save</NeoButton>
        </form>
      ) : (
        <div className="flex items-center gap-5">
          <svg viewBox="0 0 120 120" className="w-28 h-28 -rotate-90 shrink-0" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
            <circle cx="60" cy="60" r={R} fill="none" stroke="var(--color-border)" strokeWidth="6" />
            <circle
              cx="60" cy="60" r={R} fill="none" stroke="var(--color-accent-red)" strokeWidth="6" strokeLinecap="round"
              strokeDasharray={C} strokeDashoffset={C * (1 - pct / 100)}
              style={{ transition: 'stroke-dashoffset 1.6s cubic-bezier(0.16,1,0.3,1)' }}
            />
          </svg>
          <div>
            <p className="display-num text-5xl tabular-nums">{goal.books_finished}<span className="text-text-muted text-2xl">/{goal.target_books || '–'}</span></p>
            <p className="label mt-2">
              {goal.target_books ? `${pct}% of this year’s goal` : `books logged this year${readOnly ? '' : '. Set a target to track progress.'}`}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default GoalWidget;
