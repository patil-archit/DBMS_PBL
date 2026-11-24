import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Download, Trash2 } from 'lucide-react';
import NeoButton from '../components/NeoButton';
import { GenreChips } from '../components/GenrePicker';
import { Card, ErrorBox, Field, Input, Modal, Page, PageTitle, Select, Spinner, TextArea, Toggle } from '../components/ui';
import { useAuth } from '../contexts/AuthContext';
import { deleteAccount, errorMessage, exportMyData, getGenres, setFavouriteGenres, updateMe } from '../services/api';
import SignInGate from '../components/SignInGate';

const LANGUAGES = [['en', 'English'], ['hi', 'Hindi'], ['kn', 'Kannada'], ['fr', 'French'], ['es', 'Spanish'], ['de', 'German']];

const SettingsPage = () => {
  const navigate = useNavigate();
  const { me, refreshMe, logout, loading } = useAuth();
  const [form, setForm] = useState(null);
  const [genres, setGenres] = useState([]);
  const [favs, setFavs] = useState([]);
  const [msg, setMsg] = useState(null);
  const [error, setError] = useState(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [confirmText, setConfirmText] = useState('');

  useEffect(() => {
    if (!me) return;
    setForm({ username: me.username, bio: me.bio || '', language: me.language, is_private: me.is_private });
    setFavs(me.favourite_genres || []);
  }, [me]);

  useEffect(() => {
    getGenres().then(setGenres).catch(() => {});
  }, []);

  if (loading) return <Spinner />;
  if (!me) return <SignInGate animal="owl" title="Settings" text="Sign in to change your profile, privacy and data." prop="glasses" seed={12} />;
  if (!form) return <Spinner />;

  const save = async (e) => {
    e.preventDefault();
    setError(null);
    setMsg(null);
    try {
      await updateMe(form);
      await setFavouriteGenres(favs);
      await refreshMe();
      setMsg('Saved.');
    } catch (err) {
      setError(errorMessage(err, 'Could not save'));
    }
  };

  const download = async () => {
    const data = await exportMyData();
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `booklog-${me.username}-export.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const destroy = async () => {
    await deleteAccount();
    await logout();
    navigate('/home');
  };

  const toggleGenre = (name) => setFavs((f) => (f.includes(name) ? f.filter((x) => x !== name) : [...f, name]));

  return (
    <Page className="max-w-3xl">
      <PageTitle animal="owl" kicker="( Settings ) account, privacy and your data">Settings</PageTitle>
      <form onSubmit={save} className="space-y-8">
        <Card>
          <h2 className="font-medium text-2xl mb-4">Profile</h2>
          <ErrorBox>{error}</ErrorBox>
          <Field label="Username" hint="3–30 characters: lowercase letters, digits and _">
            <Input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value.toLowerCase() })} maxLength={30} />
          </Field>
          <Field label="Bio"><TextArea value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} maxLength={1000} /></Field>
          <Field label="Language">
            <Select value={form.language} onChange={(e) => setForm({ ...form, language: e.target.value })}>
              {LANGUAGES.map(([code, name]) => <option key={code} value={code}>{name}</option>)}
            </Select>
          </Field>
          <Toggle checked={form.is_private} onChange={(v) => setForm({ ...form, is_private: v })} label="Private account (only you see your diary, shelves and reading goal; only your followers see your takes on Flips)" />
        </Card>

        <Card>
          <h2 className="font-medium text-2xl mb-2">Favourite genres</h2>
          <p className="text-text-muted font-medium mb-4">Used for recommendations.</p>
          <GenreChips genres={genres} selected={favs} onToggle={toggleGenre} />
        </Card>

        <div className="flex items-center gap-4">
          <NeoButton type="submit" variant="primary">Save settings</NeoButton>
          {msg && <span className="font-medium text-accent-teal">{msg}</span>}
        </div>
      </form>

      <Card className="mt-10">
        <h2 className="font-medium text-2xl mb-2">Your data</h2>
        <p className="text-text-muted font-medium mb-4">Download everything BookLog stores about you, or delete your account.</p>
        <div className="flex flex-wrap gap-3">
          <NeoButton variant="white" onClick={download}><Download className="w-4 h-4 mr-2" /> Export my data (JSON)</NeoButton>
          <NeoButton variant="primary" onClick={() => setDeleteOpen(true)}><Trash2 className="w-4 h-4 mr-2" /> Delete account</NeoButton>
        </div>
      </Card>

      <Modal open={deleteOpen} onClose={() => setDeleteOpen(false)} title="Delete your account?">
        <p className="font-medium mb-4">
          This permanently deletes your diary, reviews, lists, comments, follows, shelves, goals and chat history. It can't be undone.
        </p>
        <Field label={`Type ${me.username} to confirm`}>
          <Input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} />
        </Field>
        <div className="flex justify-end gap-3">
          <NeoButton variant="white" onClick={() => setDeleteOpen(false)}>Cancel</NeoButton>
          <NeoButton variant="primary" disabled={confirmText !== me.username} onClick={destroy}>Delete forever</NeoButton>
        </div>
      </Modal>
    </Page>
  );
};

export default SettingsPage;
