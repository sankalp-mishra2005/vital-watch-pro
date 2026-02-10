import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { generatePatients, generateAlerts, type Patient, type Alert as AlertType } from '@/lib/mockData';
import StatusBadge from '@/components/StatusBadge';
import AlertPanel from '@/components/AlertPanel';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Activity, LogOut, Search, Users, AlertTriangle, HeartPulse } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function AdminDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [patients, setPatients] = useState<Patient[]>(() => generatePatients());
  const [alerts, setAlerts] = useState<AlertType[]>([]);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  useEffect(() => {
    const interval = setInterval(() => {
      const updated = generatePatients();
      setPatients(updated);
      setAlerts(generateAlerts(updated));
    }, 5000);
    setAlerts(generateAlerts(patients));
    return () => clearInterval(interval);
  }, []);

  const filtered = useMemo(() => {
    return patients.filter(p => {
      const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase()) || p.id.includes(search);
      const matchesStatus = filterStatus === 'all' || p.status === filterStatus;
      return matchesSearch && matchesStatus;
    });
  }, [patients, search, filterStatus]);

  const stats = useMemo(() => ({
    total: patients.length,
    normal: patients.filter(p => p.status === 'normal').length,
    warning: patients.filter(p => p.status === 'warning').length,
    critical: patients.filter(p => p.status === 'critical').length,
  }), [patients]);

  const handleLogout = () => { logout(); navigate('/login'); };

  return (
    <div className="min-h-screen p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Activity className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold">VitalSync Admin</h1>
            <p className="text-xs text-muted-foreground">{user?.name}</p>
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={handleLogout}>
          <LogOut className="w-4 h-4" />
        </Button>
      </header>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-border/50">
          <CardContent className="p-4 flex items-center gap-3">
            <Users className="w-8 h-8 text-muted-foreground" />
            <div>
              <p className="text-2xl font-mono font-bold">{stats.total}</p>
              <p className="text-xs text-muted-foreground">Total Patients</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/50 glow-green">
          <CardContent className="p-4 flex items-center gap-3">
            <HeartPulse className="w-8 h-8 text-success" />
            <div>
              <p className="text-2xl font-mono font-bold text-success">{stats.normal}</p>
              <p className="text-xs text-muted-foreground">Normal</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/50 glow-amber">
          <CardContent className="p-4 flex items-center gap-3">
            <AlertTriangle className="w-8 h-8 text-warning" />
            <div>
              <p className="text-2xl font-mono font-bold text-warning">{stats.warning}</p>
              <p className="text-xs text-muted-foreground">Warning</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/50 glow-red">
          <CardContent className="p-4 flex items-center gap-3">
            <AlertTriangle className="w-8 h-8 text-critical" />
            <div>
              <p className="text-2xl font-mono font-bold text-critical">{stats.critical}</p>
              <p className="text-xs text-muted-foreground">Critical</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Patient List */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search patients..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9 bg-muted/50"
              />
            </div>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-36 bg-muted/50">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="normal">Normal</SelectItem>
                <SelectItem value="warning">Warning</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Card className="border-border/50">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="border-border/50 hover:bg-transparent">
                    <TableHead>ID</TableHead>
                    <TableHead>Patient</TableHead>
                    <TableHead>Room</TableHead>
                    <TableHead>HR</TableHead>
                    <TableHead>SpO₂</TableHead>
                    <TableHead>Temp</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(patient => (
                    <TableRow
                      key={patient.id}
                      className="cursor-pointer border-border/30 hover:bg-muted/30"
                      onClick={() => navigate(`/admin/patient/${patient.id}`)}
                    >
                      <TableCell className="font-mono text-xs">{patient.id}</TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium text-sm">{patient.name}</p>
                          <p className="text-xs text-muted-foreground">{patient.age}{patient.gender === 'M' ? 'M' : 'F'}</p>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-sm">{patient.room}</TableCell>
                      <TableCell className="font-mono text-sm">{patient.vitals.heartRate}</TableCell>
                      <TableCell className="font-mono text-sm">{patient.vitals.spo2}%</TableCell>
                      <TableCell className="font-mono text-sm">{patient.vitals.temperature}°C</TableCell>
                      <TableCell><StatusBadge status={patient.status} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        {/* Alerts */}
        <AlertPanel alerts={alerts} />
      </div>
    </div>
  );
}
