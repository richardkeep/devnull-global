import {normalizeUser} from './globe-users.js';

export async function fetchUserProfile(handle, signal) {
  const response = await fetch(`/api/v1/users/${encodeURIComponent(handle)}`, {
    signal, headers: {Accept: 'application/json'}
  });
  if (!response.ok) throw new Error(`Could not load profile details (HTTP ${response.status}).`);
  const json = await response.json();
  const user = json.data;
  if (!user || typeof user !== 'object' || Array.isArray(user) || user.handle?.toLowerCase() !== handle.toLowerCase()) {
    throw new Error('Unexpected profile response.');
  }
  const count = value => value != null && Number.isFinite(Number(value)) && Number(value) >= 0 ? Number(value) : null;
  return {
    ...normalizeUser(user),
    commits_count: count(user.commits_count),
    followers_count: count(user.followers_count),
    following_count: count(user.following_count)
  };
}
