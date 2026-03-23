import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import type { Guild } from '../types';

export function DashboardPage() {
  const [guilds, setGuilds] = useState<Guild[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.guilds.list()
      .then(setGuilds)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="loading"><div className="spinner" /></div>;
  }

  if (error) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">⚠️</div>
        <h3>Lỗi tải dữ liệu</h3>
        <p>{error}</p>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <h1>🏠 Dashboard</h1>
        <p>Chọn server để cấu hình bot</p>
      </div>

      {guilds.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">🤖</div>
          <h3>Chưa có server nào</h3>
          <p>Bot chưa được thêm vào server nào mà bạn có quyền quản trị.</p>
        </div>
      ) : (
        <div className="guilds-grid">
          {guilds.map(guild => (
            <Link key={guild.id} to={`/guild/${guild.id}`} style={{ textDecoration: 'none' }}>
              <div className="card card-clickable">
                <div className="guild-card">
                  {guild.icon ? (
                    <img src={guild.icon} alt={guild.name} className="guild-card-icon" />
                  ) : (
                    <div className="guild-card-icon-placeholder">
                      {guild.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="guild-card-info">
                    <h3>{guild.name}</h3>
                    <p>{guild.memberCount.toLocaleString()} thành viên</p>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
