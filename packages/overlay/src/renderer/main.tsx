import { createRoot } from 'react-dom/client';
import Overlay from './Overlay';
import Panel from './Panel';

createRoot(document.getElementById('root')!).render(location.hash.includes('overlay') ? <Overlay /> : <Panel />);
