import test from 'node:test';
import assert from 'node:assert/strict';
import {clusterOffset, groupLocationMarkers} from '../src/services/marker-clusters.js';

const user = (handle, lat = 56.1304, lng = -106.3468) => ({handle, lat, lng, location: 'Canada'});

test('groups co-located users while keeping other locations separate', () => {
  const users = [user('c'), user('a'), user('b'), user('other', 43.65, -79.38)];
  const groups = groupLocationMarkers(users);
  assert.equal(groups.length, 2);
  assert.deepEqual(groups[0].users.map(user => user.handle), ['a', 'b', 'c']);
  assert.equal(groups[1].users[0].handle, 'other');
  assert.deepEqual(users.map(user => user.handle), ['c', 'a', 'b', 'other']);
  assert.equal(groups[0].lat, users[0].lat);
  assert.equal(groups[0].lng, users[0].lng);
});

test('handles rounding noise, the antimeridian, and the poles', () => {
  assert.equal(groupLocationMarkers([user('a'), user('b', 56.1304001, -106.3468001)]).length, 1);
  assert.equal(groupLocationMarkers([user('a', 0, 180), user('b', 0, -180)]).length, 1);
  assert.equal(groupLocationMarkers([user('a', 90, 15), user('b', 90, 150)]).length, 1);
});

test('keeps existing groups stable when pages append users elsewhere', () => {
  const users = [user('a'), user('b')];
  const previous = groupLocationMarkers(users);
  const next = groupLocationMarkers([...users, user('elsewhere', 0, 0)], previous);
  assert.equal(next[0], previous[0]);
  const reordered = groupLocationMarkers([...users].reverse(), previous);
  assert.equal(reordered[0], previous[0]);
  const changed = groupLocationMarkers([...users, user('c')], previous);
  assert.notEqual(changed[0], previous[0]);
  assert.equal(changed[0].users.length, 3);
});

test('expanded clusters have a visible gap between every pair of avatars', () => {
  // Include several rings to catch collisions between neighbouring rings too.
  const points = Array.from({length: 200}, (_, index) => clusterOffset(index));
  for (let i = 0; i < points.length; i++) {
    assert.ok(Number.isFinite(points[i].x) && Number.isFinite(points[i].y));
    for (let j = 0; j < i; j++) {
      assert.ok(Math.hypot(points[i].x - points[j].x, points[i].y - points[j].y) >= 52 - 1e-9);
    }
  }
});
