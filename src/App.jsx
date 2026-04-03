import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { UploadProvider } from './context/UploadContext';
import ProtectedRoute from './components/auth/ProtectedRoute';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import UploadPage from './pages/UploadPage';
import AtlasPage from './pages/AtlasPage';
import HealthCheckPage from './pages/HealthCheckPage';
import ExtractionResultPage from './pages/ExtractionResultPage';
import AuditPage from './pages/AuditPage';
import MonitoringPage from './pages/MonitoringPage';
import NotFoundPage from './pages/NotFoundPage';

const App = () => {
  return (
    <AuthProvider>
      <UploadProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <DashboardPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <DashboardPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/upload"
              element={
                <ProtectedRoute>
                  <UploadPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/atlas"
              element={
                <ProtectedRoute>
                  <AtlasPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/health"
              element={
                <ProtectedRoute>
                  <HealthCheckPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/result/:uploadId"
              element={
                <ProtectedRoute>
                  <ExtractionResultPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/extraction/:uploadId"
              element={
                <ProtectedRoute>
                  <ExtractionResultPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/logs"
              element={
                <ProtectedRoute>
                  <AuditPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/monitoring"
              element={
                <ProtectedRoute>
                  <MonitoringPage />
                </ProtectedRoute>
              }
            />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </BrowserRouter>
      </UploadProvider>
    </AuthProvider>
  );
};

export default App;