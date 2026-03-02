import { useEffect, useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import api from '@/lib/api';
import {
  classifyStatus,
  type VitalSigns, type VitalStatus,
} from '@/services/vitalsService';
import StatusBadge from '@/components/StatusBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Activity, LogOut, Search, Users, AlertTriangle, HeartPulse, CheckCircle, XCircle, Clock, Loader2, Bell, Wifi, WifiOff, Server } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';

interface DBPatient {
  id: string;
  full_name: string;
  email: string;
  status: string;
  created_at: string;
  last_seen: string | null;
  phone_number: string | null;
  device_name: string | null;
  device_status: string | null;
  device_last_seen: string | null;
  last_vitals_at: string | null;
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
  user_name: string | null;
}

interface DBAlert {
  id: string;
  patient_id: string;
  patient_name: string;
  message: string;
  level: string;
  resolved: boolean;
  created_at: string;
}

interface AlertAnalytics {
  last_24h: number;
  last_7d: number;
  unresolved: number;
  total: number;
}

interface SystemHealth {
  approvedPatients: number;
  totalDevices: number;
  onlineDevices: number;
  vitalsLastHour: number;
  serverUptime: number;
  timestamp: string;
}

export default function AdminDashboard() {
  const { profile, logout } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [patients, setPatients] = useState<DBPatient[]>([]);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [patientsLoading, setPatientsLoading] = useState(true);

  const [dbAlerts, setDbAlerts] = useState<DBAlert[]>([]);
  const [alertAnalytics, setAlertAnalytics] = useState<AlertAnalytics | null>(null);
  const [systemHealth, setSystemHealth] = useState<SystemHealth | null>(null);

  const [pendingUsers, setPendingUsers] = useState<PendingUser[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'vitals' | 'approvals' | 'alerts' | 'audit' | 'system'>('vitals');

  const fetchPatients = useCallback(async () => {
    try {
      const data = await api.admin.getPatients('approved');
      setPatients(data);
    } catch (err) {
      console.error('Failed to fetch patients:', err);
    }
    setPatientsLoading(false);
  }, []);

  const fetchPendingUsers = useCallback(async () => {
    try {
      const data = await api.admin.getPatients();
      setPendingUsers(data.map((u: DBPatient) => ({
        id: u.id, full_name: u.full_name, status: u.status,
        created_at: u.created_at, last_seen: u.last_seen, role: 'patient',
      })));
    } catch (err) {
      console.error('Failed to fetch pending:', err);
    }
  }, []);

  const fetchAlerts = useCallback(async () => {
    try {
      const data = await api.admin.getAlerts(false);
      setDbAlerts(data);
    } catch (err) {
      console.error('Failed to fetch alerts:', err);
    }
  }, []);

  const fetchAnalytics = useCallback(async () => {
    try {
      const [analytics, health] = await Promise.all([
        api.admin.getAlertAnalytics(),
        api.admin.getSystemHealth(),
      ]);
      setAlertAnalytics(analytics);
      setSystemHealth(health);
    } catch (err) {
      console.error('Failed to fetch analytics:', err);
    }
  }, []);

  const fetchAuditLogs = useCallback(async () => {
    try {
      const data = await api.admin.getAuditLogs();
      setAuditLogs(data);
    } catch (err) {
      console.error('Failed to fetch audit logs:', err);
    }
  }, []);

  useEffect(() => {
    fetchPatients();
    fetchPendingUsers();
    fetchAlerts();
    fetchAnalytics();
    fetchAuditLogs();

    // Refresh data every 30s
    const interval = setInterval(() => {
      fetchPatients();
      fetchAlerts();
      fetchAnalytics();
    }, 30000);
    return () => clearInterval(interval);
  }, [fetchPatients, fetchPendingUsers, fetchAlerts, fetchAnalytics, fetchAuditLogs]);

  const updateUserStatus = async (userId: string, newStatus: 'approved' | 'suspended') => {
    setActionLoading(userId);
    try {
      if (newStatus === 'approved') await api.admin.approvePatient(userId);
      else await api.admin.suspendPatient(userId);
      toast({ title: `User ${newStatus}`, description: `Account has been ${newStatus}.` });
      fetchPendingUsers();
      fetchPatients();
      fetchAuditLogs();
    } catch (err) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Failed', variant: 'destructive' });
    }
    setActionLoading(null);
  };

  const resolveAlert = async (alertId: string) => {
    try {
      await api.admin.resolveAlert(alertId);
      fetchAlerts();
      fetchAnalytics();
    } catch (err) {
      console.error('Resolve alert error:', err);
    }
  };

  const filtered = useMemo(() => {
    return patients.filter(p => {
      const matchesSearch = p.full_name.toLowerCase().includes(search.toLowerCase()) || p.id.includes(search);
      return matchesSearch;
    });
  }, [patients, search]);

  const isDeviceOnline = (lastSeen: string | null) => {
    if (!lastSeen) return false;
    return Date.now() - new Date(lastSeen).getTime() < 5 * 60 * 1000;
  };

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
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <Card className="border-border/50">
          <CardContent className="p-4 flex items-center gap-3">
            <Users className="w-8 h-8 text-muted-foreground" />
            <div>
              <p className="text-2xl font-mono font-bold">{systemHealth?.approvedPatients ?? patients.length}</p>
              <p className="text-xs text-muted-foreground">Patients</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/50 glow-green">
          <CardContent className="p-4 flex items-center gap-3">
            <Wifi className="w-8 h-8 text-success" />
            <div>
              <p className="text-2xl font-mono font-bold text-success">{systemHealth?.onlineDevices ?? 0}</p>
              <p className="text-xs text-muted-foreground">Devices Online</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/50 glow-amber">
          <CardContent className="p-4 flex items-center gap-3">
            <AlertTriangle className="w-8 h-8 text-warning" />
            <div>
              <p className="text-2xl font-mono font-bold text-warning">{alertAnalytics?.last_24h ?? 0}</p>
              <p className="text-xs text-muted-foreground">Alerts (24h)</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/50 glow-red">
          <CardContent className="p-4 flex items-center gap-3">
            <Bell className="w-8 h-8 text-critical" />
            <div>
              <p className="text-2xl font-mono font-bold text-critical">{alertAnalytics?.unresolved ?? 0}</p>
              <p className="text-xs text-muted-foreground">Unresolved</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="p-4 flex items-center gap-3">
            <HeartPulse className="w-8 h-8 text-primary" />
            <div>
              <p className="text-2xl font-mono font-bold">{systemHealth?.vitalsLastHour ?? 0}</p>
              <p className="text-xs text-muted-foreground">Vitals/hr</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-border/50 pb-2 overflow-x-auto">
        {(['vitals', 'approvals', 'alerts', 'audit', 'system'] as const).map(tab => (
          <Button
            key={tab}
            variant={activeTab === tab ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setActiveTab(tab)}
            className="capitalize whitespace-nowrap"
          >
            {tab === 'approvals' && <Clock className="w-4 h-4 mr-1" />}
            {tab === 'alerts' && <Bell className="w-4 h-4 mr-1" />}
            {tab === 'system' && <Server className="w-4 h-4 mr-1" />}
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
                      <TableHead>Device</TableHead>
                      <TableHead>Device Status</TableHead>
                      <TableHead>Last Vitals</TableHead>
                      <TableHead>Last Seen</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map(patient => (
                      <TableRow key={patient.id} className="cursor-pointer border-border/30 hover:bg-muted/30"
                        onClick={() => navigate(`/admin/patient/${patient.id}`)}>
                        <TableCell>
                          <p className="font-medium text-sm">{patient.full_name || 'Unnamed'}</p>
                          <p className="text-xs text-muted-foreground">{patient.email}</p>
                        </TableCell>
                        <TableCell className="text-sm">
                          {patient.device_name || <span className="text-muted-foreground">No device</span>}
                        </TableCell>
                        <TableCell>
                          {patient.device_status === 'active' ? (
                            isDeviceOnline(patient.device_last_seen) ? (
                              <Badge variant="default" className="gap-1 bg-success/20 text-success border-success/30">
                                <Wifi className="w-3 h-3" /> Online
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="gap-1">
                                <WifiOff className="w-3 h-3" /> Offline
                              </Badge>
                            )
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {patient.last_vitals_at ? new Date(patient.last_vitals_at).toLocaleString() : 'Never'}
                        </TableCell>
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

      {/* Approvals Tab */}
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
        <div className="space-y-4">
          {alertAnalytics && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <Card className="border-border/50">
                <CardContent className="p-3 text-center">
                  <p className="text-2xl font-mono font-bold">{alertAnalytics.last_24h}</p>
                  <p className="text-xs text-muted-foreground">Last 24h</p>
                </CardContent>
              </Card>
              <Card className="border-border/50">
                <CardContent className="p-3 text-center">
                  <p className="text-2xl font-mono font-bold">{alertAnalytics.last_7d}</p>
                  <p className="text-xs text-muted-foreground">Last 7 days</p>
                </CardContent>
              </Card>
              <Card className="border-border/50">
                <CardContent className="p-3 text-center">
                  <p className="text-2xl font-mono font-bold text-critical">{alertAnalytics.unresolved}</p>
                  <p className="text-xs text-muted-foreground">Unresolved</p>
                </CardContent>
              </Card>
              <Card className="border-border/50">
                <CardContent className="p-3 text-center">
                  <p className="text-2xl font-mono font-bold">{alertAnalytics.total}</p>
                  <p className="text-xs text-muted-foreground">Total</p>
                </CardContent>
              </Card>
            </div>
          )}
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
                          {alert.patient_name} · {new Date(alert.created_at).toLocaleString()}
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
        </div>
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
                      {log.user_name && (
                        <p className="text-xs text-muted-foreground">by {log.user_name}</p>
                      )}
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

      {/* System Tab */}
      {activeTab === 'system' && systemHealth && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card className="border-border/50">
            <CardHeader>
              <CardTitle className="text-sm">System Health</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between"><span className="text-sm text-muted-foreground">Approved Patients</span><span className="font-mono">{systemHealth.approvedPatients}</span></div>
              <div className="flex justify-between"><span className="text-sm text-muted-foreground">Total Devices</span><span className="font-mono">{systemHealth.totalDevices}</span></div>
              <div className="flex justify-between"><span className="text-sm text-muted-foreground">Online Devices</span><span className="font-mono text-success">{systemHealth.onlineDevices}</span></div>
              <div className="flex justify-between"><span className="text-sm text-muted-foreground">Vitals (last hour)</span><span className="font-mono">{systemHealth.vitalsLastHour}</span></div>
              <div className="flex justify-between"><span className="text-sm text-muted-foreground">Server Uptime</span><span className="font-mono">{Math.floor(systemHealth.serverUptime / 3600)}h {Math.floor((systemHealth.serverUptime % 3600) / 60)}m</span></div>
            </CardContent>
          </Card>
          <Card className="border-border/50">
            <CardHeader>
              <CardTitle className="text-sm">Alert Analytics</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {alertAnalytics && (
                <>
                  <div className="flex justify-between"><span className="text-sm text-muted-foreground">Last 24h</span><span className="font-mono">{alertAnalytics.last_24h}</span></div>
                  <div className="flex justify-between"><span className="text-sm text-muted-foreground">Last 7 days</span><span className="font-mono">{alertAnalytics.last_7d}</span></div>
                  <div className="flex justify-between"><span className="text-sm text-muted-foreground">Unresolved</span><span className="font-mono text-critical">{alertAnalytics.unresolved}</span></div>
                  <div className="flex justify-between"><span className="text-sm text-muted-foreground">Total</span><span className="font-mono">{alertAnalytics.total}</span></div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
