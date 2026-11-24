import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import ListCard from '../components/ListCard';
import NeoButton from '../components/NeoButton';
import { Empty, ErrorBox, Field, Input, Page, PageTitle, Spinner, Tabs, TextArea, Toggle } from '../components/ui';
import { useAuth } from '../contexts/AuthContext';
import { browseLists, createList, errorMessage } from '../services/api';

export const ListsPage = () => {
  const { currentUser } = useAuth();
  const [sort, setSort] = useState('popular');
  const [lists, setLists] = useState(null);

  useEffect(() => {
    setLists(null);
    browseLists(sort).then(setLists).catch(() => setLists([]));
  }, [sort, currentUser]);

  return (
    <Page>
      <PageTitle animal="bear" prop="crown"
        kicker="( Lists ) ranked collections by readers"
        right={currentUser && <Link to="/lists/new"><NeoButton variant="primary"><Plus className="w-5 h-5 mr-1" /> New list</NeoButton></Link>}
      >
        Lists
      </PageTitle>
      <Tabs active={sort} onChange={setSort} tabs={[{ id: 'popular', label: 'Popular' }, { id: 'recent', label: 'Recent' }]} />
      {lists === null ? (
        <Spinner />
      ) : lists.length ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">{lists.map((l) => <ListCard key={l.list_id} list={l} />)}</div>
      ) : (
        <Empty title="No public lists yet">Make the first one!</Empty>
      )}
    </Page>
  );
};

export const NewListPage = () => {
  const navigate = useNavigate();
  const { currentUser, loginWithGoogle } = useAuth();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  if (!currentUser) {
    return (
      <Page className="text-center">
        <NeoButton onClick={loginWithGoogle} variant="primary">Sign in to create a list</NeoButton>
      </Page>
    );
  }

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const created = await createList({ name, description, is_public: isPublic });
      navigate(`/lists/${created.list_id}`);
    } catch (err) {
      setError(errorMessage(err));
      setSaving(false);
    }
  };

  return (
    <Page className="max-w-2xl">
      <PageTitle kicker="( Lists ) ranked, public or private">New list</PageTitle>
      <form onSubmit={submit}>
        <ErrorBox>{error}</ErrorBox>
        <Field label="Name"><Input value={name} onChange={(e) => setName(e.target.value)} maxLength={200} required /></Field>
        <Field label="Description"><TextArea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={2000} /></Field>
        <div className="mb-6"><Toggle checked={isPublic} onChange={setIsPublic} label="Public (anyone can see it)" /></div>
        <p className="text-text-muted mb-6 font-medium">Add books from any book page with “Add to list”.</p>
        <NeoButton type="submit" variant="primary" disabled={saving || !name.trim()}>Create list</NeoButton>
      </form>
    </Page>
  );
};

export default ListsPage;
