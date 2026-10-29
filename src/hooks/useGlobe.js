import {useEffect} from 'https://esm.sh/react@18.3.1';
import {initializeGlobe} from '../globe-controller.js';
export function useGlobe(){
  useEffect(() => { initializeGlobe(); }, []);
}
