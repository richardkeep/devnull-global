import { useEffect, useRef } from 'react';
import { createProfileMarker } from '../services/profile-markers.js';
import {CLUSTER_EXPAND_ALTITUDE, createLocationMarker, groupLocationMarkers, setClusterExpanded} from '../services/marker-clusters.js';
// test
export function useGlobe(containerRef, {users, activeHandle, showProfile, hideProfileSoon}) {
  const globeRef = useRef(null);
  const activeHandleRef = useRef(activeHandle);
  const groupsRef = useRef([]);
  useEffect(() => {
    const container = containerRef.current;
    let expanded = false;
    const globe = Globe()(container)
      .globeImageUrl('https://unpkg.com/three-globe/example/img/earth-night.jpg')
      .bumpImageUrl('https://unpkg.com/three-globe/example/img/earth-topology.png')
      .backgroundImageUrl('https://unpkg.com/three-globe/example/img/night-sky.png')
      .htmlLat(user => user.lat)
      .htmlLng(user => user.lng)
      .htmlAltitude(0.035)
      .htmlElement(group => createLocationMarker(group, {
        expanded,
        createMarker: user => {
          const marker = createProfileMarker(user, {showProfile, hideProfileSoon});
          marker.classList.toggle('profile-selected', user.handle === activeHandleRef.current);
          return marker;
        },
        zoomToCluster: group => globe.pointOfView({lat: group.lat, lng: group.lng, altitude: 0.9}, 700)
      }))
      .onZoom(({altitude}) => {
        const next = altitude <= CLUSTER_EXPAND_ALTITUDE;
        if (next === expanded) return;
        expanded = next;
        container.querySelectorAll('.marker-cluster').forEach(element => setClusterExpanded(element, expanded));
      });
    globe.pointOfView({lat: 10, lng: 15, altitude: 2.3});
    globe.controls().autoRotate = true;
    globe.controls().autoRotateSpeed = 0.25;
    globeRef.current = globe;
    const resize = () => globe.width(innerWidth).height(innerHeight);
    window.addEventListener('resize', resize);
    return () => {
      window.removeEventListener('resize', resize);
      globe._destructor();
      container.replaceChildren();
      globeRef.current = null;
      groupsRef.current = [];
    };
  }, [containerRef, showProfile, hideProfileSoon]);

  useEffect(() => {
    groupsRef.current = groupLocationMarkers(users, groupsRef.current);
    globeRef.current.htmlElementsData(groupsRef.current);
  }, [users]);
  useEffect(() => {
    activeHandleRef.current = activeHandle;
    globeRef.current.controls().autoRotate = !activeHandle;
    containerRef.current.querySelectorAll('.person').forEach(element => {
      element.classList.toggle('profile-selected', element.dataset.handle === activeHandle);
    });
  }, [containerRef, users, activeHandle]);
}
