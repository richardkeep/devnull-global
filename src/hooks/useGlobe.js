import { useEffect, useRef } from 'react';
import { createProfileMarker } from '../services/profile-markers.js';
// test
export function useGlobe(containerRef, {users, activeHandle, showProfile, hideProfileSoon}) {
  const globeRef = useRef(null);
  const activeHandleRef = useRef(activeHandle);
  useEffect(() => {
    const container = containerRef.current;
    const globe = Globe()(container)
      .globeImageUrl('https://unpkg.com/three-globe/example/img/earth-night.jpg')
      .bumpImageUrl('https://unpkg.com/three-globe/example/img/earth-topology.png')
      .backgroundImageUrl('https://unpkg.com/three-globe/example/img/night-sky.png')
      .htmlLat(user => user.lat)
      .htmlLng(user => user.lng)
      .htmlAltitude(0.035)
      .htmlElement(user => {
        const marker = createProfileMarker(user, {showProfile, hideProfileSoon});
        marker.classList.toggle('profile-selected', user.handle === activeHandleRef.current);
        return marker;
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
    };
  }, [containerRef, showProfile, hideProfileSoon]);

  useEffect(() => { globeRef.current.htmlElementsData(users); }, [users]);
  useEffect(() => {
    activeHandleRef.current = activeHandle;
    globeRef.current.controls().autoRotate = !activeHandle;
    containerRef.current.querySelectorAll('.person').forEach(element => {
      element.classList.toggle('profile-selected', element.dataset.handle === activeHandle);
    });
  }, [containerRef, users, activeHandle]);
}
