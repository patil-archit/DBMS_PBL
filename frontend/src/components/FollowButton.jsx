import React, { useState } from 'react';
import NeoButton from './NeoButton';
import { useAuth } from '../contexts/AuthContext';
import { followUser, unfollowUser } from '../services/api';

const FollowButton = ({ username, following, onChange, size = 'sm' }) => {
  const { me, loginWithGoogle } = useAuth();
  const [state, setState] = useState(following);
  const [busy, setBusy] = useState(false);

  if (me?.username === username) return null;

  const toggle = async () => {
    if (!me) return loginWithGoogle();
    setBusy(true);
    try {
      if (state) await unfollowUser(username);
      else await followUser(username);
      setState(!state);
      onChange?.(!state);
    } finally {
      setBusy(false);
    }
  };

  return (
    <NeoButton size={size} variant={state ? 'secondary' : 'navy'} onClick={toggle} disabled={busy}>
      {state ? 'Following' : 'Follow'}
    </NeoButton>
  );
};

export default FollowButton;
