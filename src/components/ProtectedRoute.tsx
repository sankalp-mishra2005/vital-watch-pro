import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

interface Props {
  children: React.ReactNode;
  role: 'admin' | 'patient';
}

export default function ProtectedRoute({ children, role }: Props) {
  const { user, isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (user?.role !== role) return <Navigate to={`/${user?.role}`} replace />;
  return <>{children}</>;
}
