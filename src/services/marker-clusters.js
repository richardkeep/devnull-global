export const CLUSTER_EXPAND_ALTITUDE = 1.2;
const MARKER_SPACING = 52;

// Group coordinates, not location labels: people in different cities in the same
// country must keep their own positions. Rounding tolerates sub-metre noise.
export function groupLocationMarkers(users, previousGroups = []) {
  const previous = new Map(previousGroups.map(group => [group.key, group]));
  const locations = new Map();
  for (const user of users) {
    const lng = Math.abs(user.lat) === 90 ? 0 : ((user.lng + 180) % 360 + 360) % 360 - 180;
    const key = `${user.lat.toFixed(5)}:${lng.toFixed(5)}`;
    if (!locations.has(key)) locations.set(key, []);
    locations.get(key).push(user);
  }
  return [...locations].map(([key, members]) => {
    members.sort((a, b) => a.handle < b.handle ? -1 : a.handle > b.handle ? 1 : 0);
    const old = previous.get(key);
    if (old?.users.length === members.length && old.users.every((user, index) => user === members[index])) return old;
    return {key, lat: members[0].lat, lng: members[0].lng, users: members};
  });
}

// Concentric rings leave at least 8px between the 44px avatars. Offsets only
// affect the HTML layout; profile coordinates and persisted data stay intact.
export function clusterOffset(index) {
  if (index === 0) return {x: 0, y: 0};
  let ring = 1;
  let slot = index - 1;
  while (slot >= ring * 6) { slot -= ring * 6; ring++; }
  const angle = slot / (ring * 6) * Math.PI * 2 - Math.PI / 2;
  return {x: Math.cos(angle) * ring * MARKER_SPACING, y: Math.sin(angle) * ring * MARKER_SPACING};
}

export function setClusterExpanded(element, expanded) {
  if (!element.classList.contains('marker-cluster')) return;
  element.classList.toggle('expanded', expanded);
  const button = element.querySelector('.cluster-count');
  const focusFirstMarker = expanded && document.activeElement === button;
  button.hidden = expanded;
  element.querySelectorAll('.person').forEach((marker, index) => {
    marker.hidden = !expanded && index >= 3;
    const offset = expanded ? clusterOffset(index) : {x: (index - 1) * 8, y: (index - 1) * 8};
    marker.style.setProperty('--marker-x', `${offset.x}px`);
    marker.style.setProperty('--marker-y', `${offset.y}px`);
  });
  if (focusFirstMarker) element.querySelector('.person').focus();
}

export function createLocationMarker(group, {createMarker, zoomToCluster, expanded}) {
  if (group.users.length === 1) return createMarker(group.users[0]);
  const element = document.createElement('div');
  element.className = 'marker-cluster';
  element.setAttribute('role', 'group');
  const location = group.users[0].location;
  element.setAttribute('aria-label', `${group.users.length} developers at ${location}`);
  group.users.forEach(user => element.appendChild(createMarker(user)));
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'cluster-count';
  button.textContent = String(group.users.length);
  button.setAttribute('aria-label', `Zoom in to see ${group.users.length} developers at ${location}`);
  button.title = 'Zoom in to spread out these developers';
  button.addEventListener('click', event => {
    event.stopPropagation();
    zoomToCluster(group);
  });
  element.appendChild(button);
  setClusterExpanded(element, expanded);
  return element;
}
