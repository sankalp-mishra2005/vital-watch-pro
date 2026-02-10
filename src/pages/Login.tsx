import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Heart, Shield, User } from 'lucide-react';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const success = login(username, password);
    if (success) {
      const role = username === 'admin' ? 'admin' : 'patient';
      navigate(`/${role}`);
    } else {
      setError('Invalid credentials');
    }
  };

  const handleDemoLogin = (role: 'admin' | 'patient') => {
    const creds = role === 'admin' ? { u: 'admin', p: 'admin123' } : { u: 'patient', p: 'patient123' };
    const success = login(creds.u, creds.p);
    if (success) navigate(`/${role}`);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8">
        {/* Logo */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 glow-green">
            <Heart className="w-8 h-8 text-primary animate-pulse-glow" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">VitalSync</h1>
          <p className="text-muted-foreground">IoT Health Monitoring System</p>
        </div>

        {/* Login Card */}
        <Card className="border-border/50 bg-card/80 backdrop-blur">
          <CardHeader>
            <CardTitle className="text-lg text-center">Sign In</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  placeholder="Enter username"
                  className="bg-muted/50"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Enter password"
                  className="bg-muted/50"
                />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button type="submit" className="w-full">Sign In</Button>
            </form>

            <div className="mt-6 space-y-3">
              <p className="text-xs text-center text-muted-foreground">Quick Demo Access</p>
              <div className="grid grid-cols-2 gap-3">
                <Button variant="outline" onClick={() => handleDemoLogin('admin')} className="gap-2">
                  <Shield className="w-4 h-4" /> Admin
                </Button>
                <Button variant="outline" onClick={() => handleDemoLogin('patient')} className="gap-2">
                  <User className="w-4 h-4" /> Patient
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
