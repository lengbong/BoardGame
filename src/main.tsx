import './styles.css'; // 공통 스타일을 먼저 불러와야 게임별 CSS가 덮어쓸 수 있다
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
