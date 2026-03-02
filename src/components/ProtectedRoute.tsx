import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';

interface Props {
  children: React.ReactNode;
  role: 'admin' | 'patient';
}

export default function ProtectedRoute({ children, role }: Props) {
  const { isAuthenticated, loading, role: userRole, profile } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated) return <Navigate to="/login" replace />;

  if (profile?.status === 'pending') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center space-y-4 max-w-md">
          <div className="w-16 h-16 rounded-2xl bg-warning/10 flex items-center justify-center mx-auto">
            <Loader2 className="w-8 h-8 text-warning" />
          </div>
          <h2 className="text-xl font-bold">Account Pending Approval</h2>
          <p className="text-muted-foreground text-sm">
            Your account is awaiting admin approval. You'll be able to access your dashboard once approved.
          </p>
        </div>
      </div>
    );
  }

  if (profile?.status === 'suspended') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center space-y-4 max-w-md">
          <h2 className="text-xl font-bold text-critical">Account Suspended</h2>
          <p className="text-muted-foreground text-sm">
            Your account has been suspended. Please contact your administrator.
          </p>
        </div>
      </div>
    );
  }

  if (userRole && userRole !== role) {
    return <Navigate to={`/${userRole}`} replace />;
  }

  return <>{children}</>;
}
