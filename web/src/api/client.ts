const API_BASE = '/api';

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${url}`, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    ...options,
  });

  if (res.status === 401) {
    window.location.href = `${API_BASE}/auth/login`;
    throw new Error('Unauthorized');
  }

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `HTTP ${res.status}`);
  }

  return res.json();
}

export const api = {
  auth: {
    me: () => request<import('../types').AuthResponse>('/auth/me'),
    logout: () => request<{ success: boolean }>('/auth/logout', { method: 'POST' }),
    loginUrl: `${API_BASE}/auth/login`,
  },

  guilds: {
    list: () => request<import('../types').Guild[]>('/guilds'),
    getSettings: (id: string) => request<import('../types').GuildSettings>(`/guilds/${id}/settings`),
    updateSettings: (id: string, data: Partial<import('../types').GuildSettings>) =>
      request<import('../types').GuildSettings>(`/guilds/${id}/settings`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    getAllowlist: (id: string) => request<import('../types').AllowlistEntry[]>(`/guilds/${id}/allowlist`),
    addAllowlist: (id: string, target_id: string, target_type: 'user' | 'role') =>
      request<{ success: boolean }>(`/guilds/${id}/allowlist`, {
        method: 'POST',
        body: JSON.stringify({ target_id, target_type }),
      }),
    removeAllowlist: (id: string, targetId: string) =>
      request<{ success: boolean }>(`/guilds/${id}/allowlist/${targetId}`, { method: 'DELETE' }),
    getRoles: (id: string) => request<import('../types').Role[]>(`/guilds/${id}/roles`),
    getChannels: (id: string) => request<import('../types').Channel[]>(`/guilds/${id}/channels`),
  },

  bot: {
    status: () => request<import('../types').BotStatus>('/bot/status'),
  },
};
