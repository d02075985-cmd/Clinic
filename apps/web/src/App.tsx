import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import PatientsList from './pages/PatientsList'
import PatientForm from './pages/PatientForm'
import PatientProfile from './pages/PatientProfile'
import AppointmentsList from './pages/AppointmentsList'
import AppointmentForm from './pages/AppointmentForm'
import AppointmentDetail from './pages/AppointmentDetail'
import VisitsList from './pages/VisitsList'
import VisitForm from './pages/VisitForm'
import VisitDetail from './pages/VisitDetail'
import ServicesList from './pages/ServicesList'
import ServiceForm from './pages/ServiceForm'
import InvoicesList from './pages/InvoicesList'
import InvoiceForm from './pages/InvoiceForm'
import InvoiceDetail from './pages/InvoiceDetail'
import ReportsPage from './pages/ReportsPage'
import DailyClosingPage from './pages/DailyClosingPage'
import SettingsPage from './pages/SettingsPage'
import ProtectedRoute from './components/ProtectedRoute'
import { ToastProvider } from './contexts/ToastContext'

const queryClient = new QueryClient()

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <ToastProvider>
            <Routes>
            <Route path="/login" element={<Login />} />
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/patients"
              element={
                <ProtectedRoute>
                  <PatientsList />
                </ProtectedRoute>
              }
            />
            <Route
              path="/patients/new"
              element={
                <ProtectedRoute>
                  <PatientForm />
                </ProtectedRoute>
              }
            />
            <Route
              path="/patients/:id/edit"
              element={
                <ProtectedRoute>
                  <PatientForm />
                </ProtectedRoute>
              }
            />
            <Route
              path="/patients/:id"
              element={
                <ProtectedRoute>
                  <PatientProfile />
                </ProtectedRoute>
              }
            />
            <Route
              path="/appointments"
              element={
                <ProtectedRoute>
                  <AppointmentsList />
                </ProtectedRoute>
              }
            />
            <Route
              path="/appointments/new"
              element={
                <ProtectedRoute>
                  <AppointmentForm />
                </ProtectedRoute>
              }
            />
            <Route
              path="/appointments/:id"
              element={
                <ProtectedRoute>
                  <AppointmentDetail />
                </ProtectedRoute>
              }
            />
            <Route
              path="/appointments/:id/edit"
              element={
                <ProtectedRoute>
                  <AppointmentForm />
                </ProtectedRoute>
              }
            />
            <Route
              path="/visits"
              element={
                <ProtectedRoute>
                  <VisitsList />
                </ProtectedRoute>
              }
            />
            <Route
              path="/visits/new"
              element={
                <ProtectedRoute>
                  <VisitForm />
                </ProtectedRoute>
              }
            />
            <Route
              path="/visits/:id"
              element={
                <ProtectedRoute>
                  <VisitDetail />
                </ProtectedRoute>
              }
            />
            <Route
              path="/services"
              element={
                <ProtectedRoute>
                  <ServicesList />
                </ProtectedRoute>
              }
            />
            <Route
              path="/services/new"
              element={
                <ProtectedRoute>
                  <ServiceForm />
                </ProtectedRoute>
              }
            />
            <Route
              path="/services/:id/edit"
              element={
                <ProtectedRoute>
                  <ServiceForm />
                </ProtectedRoute>
              }
            />
            <Route
              path="/invoices"
              element={
                <ProtectedRoute>
                  <InvoicesList />
                </ProtectedRoute>
              }
            />
            <Route
              path="/invoices/new"
              element={
                <ProtectedRoute>
                  <InvoiceForm />
                </ProtectedRoute>
              }
            />
            <Route
              path="/invoices/:id"
              element={
                <ProtectedRoute>
                  <InvoiceDetail />
                </ProtectedRoute>
              }
            />
            <Route
              path="/reports"
              element={
                <ProtectedRoute allowedRoles={['ADMIN']}>
                  <ReportsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/reports/daily-closing"
              element={
                <ProtectedRoute allowedRoles={['ADMIN']}>
                  <DailyClosingPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/settings"
              element={
                <ProtectedRoute allowedRoles={['ADMIN']}>
                  <SettingsPage />
                </ProtectedRoute>
              }
            />
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </ToastProvider>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  )
}

export default App
