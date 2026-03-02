/**
 * VitalSync API Client
 * Replaces all Supabase calls with REST API calls to the Node.js backend.
 */

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

interface TokenStore {
  accessToken: string | null;
  refreshToken: string | null;
}

const tokens: TokenStore = {
  accessToken: localStorage.getItem('vs_access_token'),
  refreshToken: localStorage.getItem('vs_refresh_token'),
};

function setTokens(access: string | null, refresh: string | null) {
  tokens.accessToken = access;
  tokens.refreshToken = refresh;
  if (access) localStorage.setItem('vs_access_token', access);
  else localStorage.removeItem('vs_access_token');
  if (refresh) localStorage.setItem('vs_refresh_token', refresh);
  else localStorage.removeItem('vs_refresh_token');
}

export function getAccessToken() {
  return tokens.accessToken;
}

async function refreshAccessToken(): Promise<boolean> {
  if (!tokens.refreshToken) return false;
  try {
    const res = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: tokens.refreshToken }),
    });
    if (!res.ok) return false;
    const data = await res.json();
    setTokens(data.accessToken, data.refreshToken);
    return true;
  } catch {
    return false;
  }
}

async function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };
  if (tokens.accessToken) {
    headers['Authorization'] = `Bearer ${tokens.accessToken}`;
  }

  let res = await fetch(`${API_BASE}${path}`, { ...options, headers });

  // Auto-refresh on 401
  if (res.status === 401 && tokens.refreshToken) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      headers['Authorization'] = `Bearer ${tokens.accessToken}`;
      res = await fetch(`${API_BASE}${path}`, { ...options, headers });
    }
  }

  return res;
}

// ─── Auth ────────────────────────────────────────────

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    fullName: string;
    email: string;
    role: 'admin' | 'patient';
    status: string;
  };
}

export const api = {
  auth: {
    async login(email: string, password: string) {
      const res = await apiFetch('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Login failed');
      setTokens(data.accessToken, data.refreshToken);
      return data as LoginResponse;
    },

    async register(email: string, password: string, fullName: string, phoneNumber?: string) {
      const res = await apiFetch('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ email, password, fullName, phoneNumber }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Registration failed');
      return data;
    },

    async resetPassword(email: string, newPassword: string) {
      const res = await apiFetch('/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ email, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Reset failed');
      return data;
    },

    logout() {
      setTokens(null, null);
    },

    getStoredUser(): LoginResponse['user'] | null {
      const stored = localStorage.getItem('vs_user');
      return stored ? JSON.parse(stored) : null;
    },

    storeUser(user: LoginResponse['user']) {
      localStorage.setItem('vs_user', JSON.stringify(user));
    },

    clearUser() {
      localStorage.removeItem('vs_user');
    },
  },

  // ─── Admin ──────────────────────────────────────

  admin: {
    async getPatients(status?: string) {
      const query = status ? `?status=${status}` : '';
      const res = await apiFetch(`/admin/patients${query}`);
      return res.json();
    },

    async approvePatient(id: string) {
      const res = await apiFetch(`/admin/approve/${id}`, { method: 'PUT' });
      return res.json();
    },

    async suspendPatient(id: string) {
      const res = await apiFetch(`/admin/suspend/${id}`, { method: 'PUT' });
      return res.json();
    },

    async getAlerts(resolved?: boolean) {
      const query = resolved !== undefined ? `?resolved=${resolved}` : '';
      const res = await apiFetch(`/admin/alerts${query}`);
      return res.json();
    },

    async resolveAlert(id: string) {
      const res = await apiFetch(`/admin/alerts/${id}/resolve`, { method: 'PUT' });
      return res.json();
    },

    async getAlertAnalytics() {
      const res = await apiFetch('/admin/alerts/analytics');
      return res.json();
    },

    async getSystemHealth() {
      const res = await apiFetch('/admin/system-health');
      return res.json();
    },

    async getThresholds() {
      const res = await apiFetch('/admin/thresholds');
      return res.json();
    },

    async updateThreshold(data: { metric: string; warningLow?: number | null; warningHigh?: number | null; criticalLow?: number | null; criticalHigh?: number | null }) {
      const res = await apiFetch('/admin/thresholds', {
        method: 'PUT',
        body: JSON.stringify(data),
      });
      return res.json();
    },

    async getDevices() {
      const res = await apiFetch('/admin/devices');
      return res.json();
    },

    async createDevice(patientId: string, deviceName?: string) {
      const res = await apiFetch('/admin/devices', {
        method: 'POST',
        body: JSON.stringify({ patientId, deviceName }),
      });
      return res.json();
    },

    async revokeDevice(id: string) {
      const res = await apiFetch(`/admin/devices/${id}/revoke`, { method: 'PUT' });
      return res.json();
    },

    async getAuditLogs() {
      const res = await apiFetch('/admin/audit-logs');
      return res.json();
    },
  },

  // ─── Patient ────────────────────────────────────

  patient: {
    async getProfile() {
      const res = await apiFetch('/patient/profile');
      return res.json();
    },

    async getVitals(limit = 100) {
      const res = await apiFetch(`/patient/vitals?limit=${limit}`);
      return res.json();
    },

    async getLatestVitals() {
      const res = await apiFetch('/patient/vitals/latest');
      return res.json();
    },

    async getAlerts() {
      const res = await apiFetch('/patient/alerts');
      return res.json();
    },

    async getDevice() {
      const res = await apiFetch('/patient/device');
      return res.json();
    },
  },

  // ─── Vitals (admin reading) ─────────────────────

  vitals: {
    async getForPatient(patientId: string, limit = 100) {
      const res = await apiFetch(`/vitals/${patientId}?limit=${limit}`);
      return res.json();
    },

    async getLatest(patientId: string) {
      const res = await apiFetch(`/vitals/${patientId}/latest`);
      return res.json();
    },
  },

  // ─── Health ─────────────────────────────────────

  async health() {
    const res = await fetch(`${API_BASE}/health`);
    return res.json();
  },
};

export default api;
