import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import AuthenticatedLayout from './AuthenticatedLayout';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: ('ADMIN' | 'RECEPTIONIST')[];
}

export default function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { isAuthenticated, user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F6F7FA]">
        <div className="w-8 h-8 border-4 border-[#4B5694] border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && user && !allowedRoles.includes(user.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <AuthenticatedLayout>{children}</AuthenticatedLayout>;
}
