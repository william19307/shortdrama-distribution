import { MotionConfig } from 'framer-motion';
import { BrowserRouter } from 'react-router-dom';
import { AppRoutes } from './App';
import { AuthProvider } from './auth';
import { ThemeState } from './theme';
import 'antd/dist/reset.css';
import './styles.css';

export function App() {
  return (
    <MotionConfig reducedMotion="user">
      <ThemeState>
        <AuthProvider>
          <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
            <AppRoutes />
          </BrowserRouter>
        </AuthProvider>
      </ThemeState>
    </MotionConfig>
  );
}
