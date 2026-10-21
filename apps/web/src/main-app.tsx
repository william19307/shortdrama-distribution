import { App as AntApp } from 'antd';
import { BrowserRouter } from 'react-router-dom';
import { AppRoutes } from './App';
import { AuthProvider } from './auth';
import '@ds/tokens.css';
import '@ds/components.css';
import 'antd/dist/reset.css';
import './styles.css';

export function App() {
  return (
    <AntApp>
      <AuthProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </AuthProvider>
    </AntApp>
  );
}
