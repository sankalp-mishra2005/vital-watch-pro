import { useLocation, Link } from 'react-router-dom';

const NotFound = () => {
  const location = useLocation();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold">404</h1>
        <p className="text-xl text-muted-foreground">Page not found: {location.pathname}</p>
        <Link to="/login" className="text-primary underline hover:text-primary/90">
          Back to Login
        </Link>
      </div>
    </div>
  );
};

export default NotFound;
