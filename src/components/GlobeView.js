import React, {useRef} from 'react';
import {useGlobe} from '../hooks/useGlobe.js';

export function GlobeView(props) {
  const containerRef = useRef(null);
  useGlobe(containerRef, props);
  return React.createElement('div', {id: 'globe', ref: containerRef});
}
