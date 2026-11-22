import React, { useEffect, useState } from 'react';
import NeoButton, { cn } from './NeoButton';
import { Modal } from './ui';
import { useAuth } from '../contexts/AuthContext';
import { getGenres, setFavouriteGenres } from '../services/api';

export const GenreChips = ({ selected, onToggle, genres }) => (
  <div className="flex flex-wrap gap-2">
    {genres.map((g) => {
      const on = selected.includes(g.name);
      return (
        <button
          key={g.genre_id}
          type="button"
          aria-pressed={on}
          onClick={() => onToggle(g.name)}
          className={cn(
            'px-3 py-1.5 border border-border font-medium text-sm transition-all',
            on ? 'bg-text-main text-bg-base shadow-none' : 'bg-surface-white hover:-translate-y-0.5'
          )}
        >
          {g.name}
        </button>
      );
    })}
  </div>
);

const DISMISS_KEY = 'booklog.onboarding.dismissed';

/** First-sign-in prompt: pick favourite genres so recommendations work from day one. */
export const OnboardingGate = () => {
  const { me, refreshMe } = useAuth();
  const [genres, setGenres] = useState([]);
  const [selected, setSelected] = useState([]);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!me || me.favourite_genres?.length) return;
    let dismissed = false;
    try {
      dismissed = localStorage.getItem(`${DISMISS_KEY}.${me.user_id}`) === '1';
    } catch {
      /* storage unavailable */
    }
    if (dismissed) return;
    getGenres().then((g) => {
      setGenres(g.filter((x) => x.book_count >= 20));
      setOpen(true);
    });
  }, [me]);

  const close = () => {
    try {
      localStorage.setItem(`${DISMISS_KEY}.${me.user_id}`, '1');
    } catch {
      /* ignore */
    }
    setOpen(false);
  };

  const save = async () => {
    setSaving(true);
    await setFavouriteGenres(selected);
    await refreshMe();
    setSaving(false);
    setOpen(false);
  };

  const toggle = (name) => setSelected((s) => (s.includes(name) ? s.filter((x) => x !== name) : [...s, name]));

  return (
    <Modal open={open} onClose={close} title="Welcome to BookLog!" wide>
      <p className="text-lg font-medium mb-4">Pick a few genres you enjoy and we'll recommend books straight away.</p>
      <GenreChips genres={genres} selected={selected} onToggle={toggle} />
      <div className="flex justify-end gap-3 mt-6">
        <NeoButton variant="white" onClick={close}>Skip</NeoButton>
        <NeoButton variant="primary" onClick={save} disabled={!selected.length || saving}>
          {saving ? 'Saving…' : `Save ${selected.length || ''} genres`}
        </NeoButton>
      </div>
    </Modal>
  );
};
