import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getImages, getStats, getHealth } from '../api';
import ImageCard from '../components/ImageCard';

export default function DashboardPage() {
  const [images, setImages] = useState([]);
  const [stats, setStats] = useState({ total: 0, pending: 0, unedited: 0, edited: 0 });
  const [health, setHealth] = useState({ auth: false, ai: false, historique: false });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [imgRes, statsRes, healthRes] = await Promise.allSettled([
          getImages(), getStats(), getHealth()
        ]);
        if (imgRes.status === 'fulfilled') setImages(imgRes.value.data);
        if (statsRes.status === 'fulfilled') setStats(statsRes.value.data);
        if (healthRes.status === 'fulfilled') setHealth(healthRes.value.data.services);
      } catch (e) { console.error(e); }
      setLoading(false);
    };
    load();
  }, []);

  if (loading) return <div className="loading">Loading...</div>;

  return (
    <div className="dashboard">
      <div className="stats-grid">
        <div className="stat-card stat-total"><div className="stat-icon">🖼️</div><div className="stat-info"><span className="stat-number">{stats.total}</span><span className="stat-label">TOTAL IMAGES</span></div></div>
        <div className="stat-card stat-unedited"><div className="stat-icon">✅</div><div className="stat-info"><span className="stat-number">{stats.unedited}</span><span className="stat-label">UNEDITED</span></div></div>
        <div className="stat-card stat-edited"><div className="stat-icon">✏️</div><div className="stat-info"><span className="stat-number">{stats.edited}</span><span className="stat-label">EDITED</span></div></div>
        <div className="stat-card stat-pending"><div className="stat-icon">⏳</div><div className="stat-info"><span className="stat-number">{stats.pending}</span><span className="stat-label">PENDING</span></div></div>
      </div>

      <div className="services-health">
        <h3>🔗 Microservices Status</h3>
        <div className="health-indicators">
          <span className={`health-dot ${health.auth ? 'healthy' : 'unhealthy'}`}>Auth Service</span>
          <span className={`health-dot ${health.ai ? 'healthy' : 'unhealthy'}`}>AI Service</span>
          <span className={`health-dot ${health.historique ? 'healthy' : 'unhealthy'}`}>History Service</span>
        </div>
      </div>

      <div className="section-header">
        <h2>All Images</h2>
        <Link to="/upload" className="btn btn-primary">⬆️ Upload New</Link>
      </div>

      {images.length > 0 ? (
        <div className="image-grid">
          {images.map(img => <ImageCard key={img.id} image={img} />)}
        </div>
      ) : (
        <div className="empty-state">
          <div className="empty-icon">🖼️</div>
          <h3>Your gallery is empty</h3>
          <p>Upload your first image to get started with AI verification.</p>
          <Link to="/upload" className="btn btn-primary">Upload Image</Link>
        </div>
      )}
    </div>
  );
}
