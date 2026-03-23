import { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../api/client';
import type { GuildSettings, AllowlistEntry, Role, Channel } from '../types';

type Tab = 'general' | 'permissions' | 'autoread' | 'allowlist';

export function GuildPage() {
  const { id } = useParams<{ id: string }>();
  const [settings, setSettings] = useState<GuildSettings | null>(null);
  const [allowlist, setAllowlist] = useState<AllowlistEntry[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('general');
  const [newAllowlistId, setNewAllowlistId] = useState('');
  const [newAllowlistType, setNewAllowlistType] = useState<'user' | 'role'>('user');

  const showToast = useCallback((message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  useEffect(() => {
    if (!id) return;
    Promise.all([
      api.guilds.getSettings(id),
      api.guilds.getAllowlist(id),
      api.guilds.getRoles(id),
      api.guilds.getChannels(id),
    ])
      .then(([s, a, r, c]) => {
        setSettings(s);
        setAllowlist(a);
        setRoles(r);
        setChannels(c);
      })
      .catch(err => showToast(err.message, 'error'))
      .finally(() => setLoading(false));
  }, [id, showToast]);

  const updateField = <K extends keyof GuildSettings>(key: K, value: GuildSettings[K]) => {
    if (!settings) return;
    setSettings({ ...settings, [key]: value });
    setDirty(true);
  };

  const handleSave = async () => {
    if (!settings || !id) return;
    setSaving(true);
    try {
      const updated = await api.guilds.updateSettings(id, settings);
      setSettings(updated);
      setDirty(false);
      showToast('Đã lưu cấu hình thành công!', 'success');
    } catch (err: any) {
      showToast(err.message || 'Lỗi lưu cấu hình', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleAddAllowlist = async () => {
    if (!id || !newAllowlistId.trim()) return;
    try {
      await api.guilds.addAllowlist(id, newAllowlistId.trim(), newAllowlistType);
      const updated = await api.guilds.getAllowlist(id);
      setAllowlist(updated);
      setNewAllowlistId('');
      showToast('Đã thêm vào allowlist!', 'success');
    } catch (err: any) {
      showToast(err.message || 'Lỗi thêm allowlist', 'error');
    }
  };

  const handleRemoveAllowlist = async (targetId: string) => {
    if (!id) return;
    try {
      await api.guilds.removeAllowlist(id, targetId);
      setAllowlist(prev => prev.filter(e => e.target_id !== targetId));
      showToast('Đã xóa khỏi allowlist!', 'success');
    } catch (err: any) {
      showToast(err.message || 'Lỗi xóa allowlist', 'error');
    }
  };

  if (loading || !settings) {
    return <div className="loading"><div className="spinner" /></div>;
  }

  const textChannels = channels.filter(c => c.type === 'text');

  const providerOptions = [
    { value: 'gtts', label: '🆓 gTTS (Miễn phí)' },
    { value: 'edge', label: '🔷 Edge TTS (Miễn phí, chất lượng cao)' },
    { value: 'elevenlabs', label: '🌟 ElevenLabs (Cao cấp)' },
    { value: 'google', label: '☁️ Google Cloud TTS' },
    { value: 'openai', label: '🤖 OpenAI TTS' },
  ];

  const languageOptions = [
    { value: 'vi', label: '🇻🇳 Tiếng Việt' },
    { value: 'en', label: '🇺🇸 English' },
    { value: 'ja', label: '🇯🇵 日本語' },
    { value: 'ko', label: '🇰🇷 한국어' },
  ];

  return (
    <div>
      <div className="page-breadcrumb">
        <Link to="/">Dashboard</Link>
        <span>/</span>
        <span>Cấu hình Server</span>
      </div>

      <div className="page-header">
        <h1>⚙️ Cấu Hình Server</h1>
      </div>

      {/* Tabs */}
      <div className="tabs">
        {([
          ['general', '🛠️ Tổng quan'],
          ['permissions', '🔐 Phân quyền'],
          ['autoread', '📖 Auto-Read'],
          ['allowlist', '📋 Allowlist'],
        ] as [Tab, string][]).map(([key, label]) => (
          <button
            key={key}
            className={`tab ${activeTab === key ? 'active' : ''}`}
            onClick={() => setActiveTab(key)}
          >
            {label}
          </button>
        ))}
      </div>

      {/* === Tab General === */}
      {activeTab === 'general' && (
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">TTS Provider mặc định</label>
              <select
                className="form-select"
                value={settings.default_provider}
                onChange={e => updateField('default_provider', e.target.value)}
              >
                {providerOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Ngôn ngữ mặc định</label>
              <select
                className="form-select"
                value={settings.default_language}
                onChange={e => updateField('default_language', e.target.value)}
              >
                {languageOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">
              Giới hạn ký tự: <strong>{settings.text_limit}</strong>
            </label>
            <input
              type="range"
              className="form-range"
              min={100}
              max={5000}
              step={100}
              value={settings.text_limit}
              onChange={e => updateField('text_limit', Number(e.target.value))}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              <span>100</span>
              <span>5000</span>
            </div>
          </div>
        </div>
      )}

      {/* === Tab Permissions === */}
      {activeTab === 'permissions' && (
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <div className="form-group">
            <label className="form-label">Chế độ phân quyền</label>
            <div className="radio-group">
              {[
                { value: 'open', label: '🌐 Open', desc: 'Mọi người đều có thể sử dụng bot' },
                { value: 'role', label: '🎭 Role', desc: 'Chỉ user có DJ role mới sử dụng được' },
                { value: 'allowlist', label: '📋 Allowlist', desc: 'Chỉ user/role trong danh sách cho phép' },
              ].map(opt => (
                <label
                  key={opt.value}
                  className={`radio-option ${settings.permission_mode === opt.value ? 'selected' : ''}`}
                >
                  <input
                    type="radio"
                    name="permission_mode"
                    value={opt.value}
                    checked={settings.permission_mode === opt.value}
                    onChange={e => updateField('permission_mode', e.target.value as GuildSettings['permission_mode'])}
                  />
                  <div>
                    <div className="radio-option-label">{opt.label}</div>
                    <div className="radio-option-desc">{opt.desc}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {settings.permission_mode === 'role' && (
            <div className="form-group">
              <label className="form-label">DJ Role</label>
              <select
                className="form-select"
                value={settings.dj_role_id}
                onChange={e => updateField('dj_role_id', e.target.value)}
              >
                <option value="">— Chọn role —</option>
                {roles.map(role => (
                  <option key={role.id} value={role.id}>
                    {role.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      )}

      {/* === Tab Auto-Read === */}
      {activeTab === 'autoread' && (
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <div className="form-group">
            <div className="toggle-wrapper">
              <span className="toggle-label">Tự động đọc tin nhắn</span>
              <label className="toggle">
                <input
                  type="checkbox"
                  checked={!!settings.auto_read_enabled}
                  onChange={e => updateField('auto_read_enabled', e.target.checked ? 1 : 0)}
                />
                <span className="toggle-slider" />
              </label>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Giới hạn kênh text (để trống = tất cả kênh)</label>
            <select
              className="form-select"
              value={settings.auto_read_channel_id}
              onChange={e => updateField('auto_read_channel_id', e.target.value)}
            >
              <option value="">— Tất cả kênh —</option>
              {textChannels.map(ch => (
                <option key={ch.id} value={ch.id}>#{ch.name}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Bỏ qua tin nhắn bắt đầu bằng</label>
            <input
              type="text"
              className="form-input"
              value={settings.auto_read_ignore_prefix}
              onChange={e => updateField('auto_read_ignore_prefix', e.target.value)}
              placeholder="!,/"
            />
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
              Phân cách bằng dấu phẩy. VD: !,/,?
            </div>
          </div>
        </div>
      )}

      {/* === Tab Allowlist === */}
      {activeTab === 'allowlist' && (
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
            <select
              className="form-select"
              style={{ width: '120px', flexShrink: 0 }}
              value={newAllowlistType}
              onChange={e => setNewAllowlistType(e.target.value as 'user' | 'role')}
            >
              <option value="user">👤 User</option>
              <option value="role">🎭 Role</option>
            </select>
            <input
              type="text"
              className="form-input"
              placeholder={newAllowlistType === 'user' ? 'User ID...' : 'Role ID...'}
              value={newAllowlistId}
              onChange={e => setNewAllowlistId(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAddAllowlist()}
            />
            <button className="btn btn-primary" onClick={handleAddAllowlist}>
              Thêm
            </button>
          </div>

          {allowlist.length === 0 ? (
            <div className="empty-state">
              <p>Allowlist trống. Thêm user hoặc role ở trên.</p>
            </div>
          ) : (
            <div className="table-wrapper">
              <table className="table">
                <thead>
                  <tr>
                    <th>Loại</th>
                    <th>ID</th>
                    <th style={{ width: '80px' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {allowlist.map(entry => (
                    <tr key={entry.id}>
                      <td>
                        <span className={`badge ${entry.target_type === 'user' ? 'badge-accent' : 'badge-warning'}`}>
                          {entry.target_type === 'user' ? '👤 User' : '🎭 Role'}
                        </span>
                      </td>
                      <td style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{entry.target_id}</td>
                      <td>
                        <button
                          className="btn btn-danger btn-small"
                          onClick={() => handleRemoveAllowlist(entry.target_id)}
                        >
                          Xóa
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Save Bar */}
      {dirty && (
        <div className="save-bar">
          <p>Bạn có thay đổi chưa lưu</p>
          <button className="btn btn-secondary" onClick={() => { setDirty(false); window.location.reload(); }}>
            Hủy
          </button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Đang lưu...' : '💾 Lưu thay đổi'}
          </button>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className={`toast toast-${toast.type}`}>
          {toast.type === 'success' ? '✅' : '❌'} {toast.message}
        </div>
      )}
    </div>
  );
}
