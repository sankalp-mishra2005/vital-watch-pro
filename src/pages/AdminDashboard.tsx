import { useEffect, useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import {
  generateVitals, classifyStatus,
  type VitalSigns, type VitalStatus,
} from '@/services/vitalsService';
import StatusBadge from '@/components/StatusBadge';
import AlertPanel from '@/components/AlertPanel';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Activity, LogOut, Search, Users, AlertTriangle, HeartPulse, CheckCircle, XCircle, Clock, Loader2, Bell } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';

interface DBPatient {
  id: string;
  full_name: string;
  status: string;
  created_at: string;
  last_seen: string | null;
  phone_number: string | null;
}

interface PatientWithMockVitals extends DBPatient {
  vitals: VitalSigns;
  vitalStatus: VitalStatus;
}

interface PendingUser {
  id: string;
  full_name: string;
  status: string;
  created_at: string;
  last_seen: string | null;
  role: string;
}

interface AuditLog {
  id: string;
  action: string;
  details: Record<string, unknown> | null;
  created_at: string;
  user_id: string | null;
}

interface DBAlert {
  id: string;
  patient_id: string;
  message: string;
  level: string;
  resolved: boolean;
  created_at: string;
}

export default function AdminDashboard() {
  const { profile, logout } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  // Real DB patients with mock vitals attached
  const [patients, setPatients] = useState<PatientWithMockVitals[]>([]);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [patientsLoading, setPatientsLoading] = useState(true);

  // Real DB alerts
  const [dbAlerts, setDbAlerts] = useState<DBAlert[]>([]);

  // Approvals tab data
  const [pendingUsers, setPendingUsers] = useState<PendingUser[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'vitals' | 'approvals' | 'alerts' | 'audit'>('vitals');

  // Fetch approved patients from DB and attach mock vitals
  const fetchPatients = useCallback(async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, status, created_at, last_seen, phone_number, user_roles!inner(role)')
      .eq('user_roles.role', 'patient')
      .eq('status', 'approved')
      .order('created_at', { ascending: false });

    if (data && !error) {
      const withVitals: PatientWithMockVitals[] = (data as any[]).map(p => {
        const vitals = generateVitals(Math.random() < 0.3);
        return {
          id: p.id,
          full_name: p.full_name,
          status: p.status,
          created_at: p.created_at,
          last_seen: p.last_seen,
          phone_number: p.phone_number,
          vitals,
          vitalStatus: classifyStatus(vitals),
        };
      });
      setPatients(withVitals);
    }
    setPatientsLoading(false);
  }, []);

  // Refresh mock vitals every 5s while keeping real patient identities
  useEffect(() => {
    fetchPatients();
    const interval = setInterval(() => {
      setPatients(prev =>
        prev.map(p => {
          const vitals = generateVitals(Math.random() < 0.3);
          return { ...p, vitals, vitalStatus: classifyStatus(vitals) };
        })
      );
    }, 5000);
    return () => clearInterval(interval);
  }, [fetchPatients]);

  // Fetch only patient-role users for approvals (never admins)
  const fetchPendingUsers = useCallback(async () => {
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, status, created_at, last_seen, user_roles!inner(role)')
      .eq('user_roles.role', 'patient')
      .order('created_at', { ascending: false });

    if (data) {
      const mapped: PendingUser[] = (data as any[]).map(u => ({
        id: u.id,
        full_name: u.full_name,
        status: u.status,
        created_at: u.created_at,
        last_seen: u.last_seen,
        role: (u.user_roles as any[])?.[0]?.role || 'patient',
      }));
      // Deduplicate by ID
      const unique = Array.from(new Map(mapped.map(u => [u.id, u])).values());
      setPendingUsers(unique);
    }
  }, []);

  // Fetch DB alerts
  const fetchAlerts = useCallback(async () => {
    const { data } = await supabase
      .from('alerts')
      .select('*')
      .eq('resolved', false)
      .order('created_at', { ascending: false })
      .limit(50);
    if (data) setDbAlerts(data as DBAlert[]);
  }, []);

  // Fetch audit logs
  const fetchAuditLogs = useCallback(async () => {
    const { data } = await supabase
      .from('audit_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);
    if (data) setAuditLogs(data as AuditLog[]);
  }, []);

  useEffect(() => {
    fetchPendingUsers();
    fetchAlerts();
    fetchAuditLogs();
  }, [fetchPendingUsers, fetchAlerts, fetchAuditLogs]);

  // Realtime alerts subscription
  useEffect(() => {
    const channel = supabase
      .channel('admin-alerts')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'alerts',
      }, () => {
        fetchAlerts();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchAlerts]);

  // Approve / suspend user (only patients, enforced by RLS)
  const updateUserStatus = async (userId: string, newStatus: 'approved' | 'suspended') => {
    setActionLoading(userId);
    const { error } = await supabase
      .from('profiles')
      .update({ status: newStatus })
      .eq('id', userId);

    if (!error) {
      await supabase.rpc('insert_audit_log', {
        _user_id: userId,
        _action: `user_${newStatus}`,
        _details: { target_user: userId } as unknown as never,
      });
      toast({ title: `User ${newStatus}`, description: `Account has been ${newStatus}.` });
      fetchPendingUsers();
      fetchAuditLogs();
    } else {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
    setActionLoading(null);
  };

  // Resolve alert
  const resolveAlert = async (alertId: string) => {
    await supabase.from('alerts').update({ resolved: true }).eq('id', alertId);
    fetchAlerts();
  };

  const filtered = useMemo(() => {
    return patients.filter(p => {
      const matchesSearch = p.full_name.toLowerCase().includes(search.toLowerCase()) || p.id.includes(search);
      const matchesStatus = filterStatus === 'all' || p.vitalStatus === filterStatus;
      return matchesSearch && matchesStatus;
    });
  }, [patients, search, filterStatus]);

  const stats = useMemo(() => ({
    total: patients.length,
    normal: patients.filter(p => p.vitalStatus === 'normal').length,
    warning: patients.filter(p => p.vitalStatus === 'warning').length,
    critical: patients.filter(p => p.vitalStatus === 'critical').length,
  }), [patients]);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

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
            <p className="text-xs text-muted-foreground">{profile?.fullName}</p>
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
              <p className="text-xs text-muted-foreground">Approved Patients</p>
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

      {/* Tabs */}
      <div className="flex gap-2 border-b border-border/50 pb-2">
        {(['vitals', 'approvals', 'alerts', 'audit'] as const).map(tab => (
          <Button
            key={tab}
            variant={activeTab === tab ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setActiveTab(tab)}
            className="capitalize"
          >
            {tab === 'approvals' && <Clock className="w-4 h-4 mr-1" />}
            {tab === 'alerts' && <Bell className="w-4 h-4 mr-1" />}
            {tab}
            {tab === 'approvals' && pendingUsers.filter(u => u.status === 'pending').length > 0 && (
              <Badge variant="destructive" className="ml-1 text-xs px-1.5">
                {pendingUsers.filter(u => u.status === 'pending').length}
              </Badge>
            )}
            {tab === 'alerts' && dbAlerts.length > 0 && (
              <Badge variant="destructive" className="ml-1 text-xs px-1.5">
                {dbAlerts.length}
              </Badge>
            )}
          </Button>
        ))}
      </div>

      {/* Vitals Tab */}
      {activeTab === 'vitals' && (
        <div className="space-y-4">
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
          {patientsLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : patients.length === 0 ? (
            <Card className="border-border/50">
              <CardContent className="p-8 text-center">
                <Users className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">No approved patients yet. Approve patients in the Approvals tab.</p>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-border/50">
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="border-border/50 hover:bg-transparent">
                      <TableHead>Patient</TableHead>
                      <TableHead>HR</TableHead>
                      <TableHead>SpO₂</TableHead>
                      <TableHead>Temp</TableHead>
                      <TableHead>Motion</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Last Seen</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map(patient => (
                      <TableRow key={patient.id} className="cursor-pointer border-border/30 hover:bg-muted/30"
                        onClick={() => navigate(`/admin/patient/${patient.id}`)}>
                        <TableCell>
                          <p className="font-medium text-sm">{patient.full_name || 'Unnamed'}</p>
                        </TableCell>
                        <TableCell className="font-mono text-sm">{patient.vitals.heartRate}</TableCell>
                        <TableCell className="font-mono text-sm">{patient.vitals.spo2}%</TableCell>
                        <TableCell className="font-mono text-sm">{patient.vitals.temperature}°C</TableCell>
                        <TableCell className="text-xs capitalize">{patient.vitals.motionStatus.replace('_', ' ')}</TableCell>
                        <TableCell><StatusBadge status={patient.vitalStatus} /></TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {patient.last_seen ? new Date(patient.last_seen).toLocaleString() : 'Never'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Approvals Tab — only patient-role users */}
      {activeTab === 'approvals' && (
        <Card className="border-border/50">
          <CardHeader>
            <CardTitle className="text-sm">Patient Account Management</CardTitle>
          </CardHeader>
          <CardContent>
            {pendingUsers.length === 0 ? (
              <p className="text-sm text-muted-foreground">No patient accounts found.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-border/50 hover:bg-transparent">
                    <TableHead>Name</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Registered</TableHead>
                    <TableHead>Last Seen</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingUsers.map(u => (
                    <TableRow key={u.id} className="border-border/30">
                      <TableCell className="font-medium text-sm">{u.full_name || 'Unnamed'}</TableCell>
                      <TableCell>
                        <Badge variant={u.status === 'approved' ? 'default' : u.status === 'pending' ? 'secondary' : 'destructive'}>
                          {u.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(u.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {u.last_seen ? new Date(u.last_seen).toLocaleString() : 'Never'}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          {u.status !== 'approved' && (
                            <Button size="sm" variant="outline" className="gap-1 text-success border-success/30 hover:bg-success/10"
                              disabled={actionLoading === u.id}
                              onClick={() => updateUserStatus(u.id, 'approved')}>
                              {actionLoading === u.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3 h-3" />}
                              Approve
                            </Button>
                          )}
                          {u.status !== 'suspended' && (
                            <Button size="sm" variant="outline" className="gap-1 text-critical border-critical/30 hover:bg-critical/10"
                              disabled={actionLoading === u.id}
                              onClick={() => updateUserStatus(u.id, 'suspended')}>
                              {actionLoading === u.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <XCircle className="w-3 h-3" />}
                              Suspend
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {/* Alerts Tab */}
      {activeTab === 'alerts' && (
        <Card className="border-border/50">
          <CardHeader>
            <CardTitle className="text-sm">Active Alerts</CardTitle>
          </CardHeader>
          <CardContent>
            {dbAlerts.length === 0 ? (
              <p className="text-sm text-muted-foreground">No active alerts.</p>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {dbAlerts.map(alert => (
                  <div
                    key={alert.id}
                    className={`flex items-start gap-3 p-3 rounded-lg border ${
                      alert.level === 'critical' ? 'border-critical/30 bg-critical/5' : 'border-warning/30 bg-warning/5'
                    }`}
                  >
                    <AlertTriangle className={`w-4 h-4 mt-0.5 shrink-0 ${alert.level === 'critical' ? 'text-critical' : 'text-warning'}`} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{alert.message}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date(alert.created_at).toLocaleString()}
                      </p>
                    </div>
                    <Button size="sm" variant="ghost" onClick={() => resolveAlert(alert.id)} className="text-xs">
                      Resolve
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Audit Tab */}
      {activeTab === 'audit' && (
        <Card className="border-border/50">
          <CardHeader>
            <CardTitle className="text-sm">Audit Logs</CardTitle>
          </CardHeader>
          <CardContent>
            {auditLogs.length === 0 ? (
              <p className="text-sm text-muted-foreground">No audit logs yet.</p>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {auditLogs.map(log => (
                  <div key={log.id} className="flex items-start gap-3 p-3 rounded-lg border border-border/30 bg-muted/20">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{log.action}</p>
                      {log.details && (
                        <p className="text-xs text-muted-foreground mt-0.5 font-mono">
                          {JSON.stringify(log.details)}
                        </p>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(log.created_at).toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
