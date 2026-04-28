"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Search, Image as ImageIcon, Activity, Loader2 } from "lucide-react";
import GalleryGrid from "@/components/dashboard/GalleryGrid";
import { getImages, getStats, checkAllServicesHealth } from "@/lib/api";

/**
 * Compute stats from an images array — used as a fallback when
 * the stats API endpoint fails (auth timeout, network issues, etc.).
 */
function computeStatsFromImages(images) {
  return {
    total: images.length,
    pending: images.filter((i) => i.verification_status === "pending").length,
    unedited: images.filter((i) => i.verification_status === "unedited").length,
    edited: images.filter((i) => i.verification_status === "edited").length,
  };
}

export default function GalleryPage() {
  const [images, setImages] = useState([]);
  const [stats, setStats] = useState({ total: 0, pending: 0, unedited: 0, edited: 0 });
  const [health, setHealth] = useState(null); // null = loading
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const galleryWasDown = useRef(false);
  const retryTimer = useRef(null);
  const retryCount = useRef(0);

  // ── Load gallery data (images + stats) ──
  const loadData = useCallback(async () => {
    try {
      const [imgData, statsData] = await Promise.allSettled([
        getImages(),
        getStats(),
      ]);

      let loadedImages = [];
      if (imgData.status === "fulfilled") {
        loadedImages = imgData.value;
        setImages(loadedImages);
        setLoadError("");
        retryCount.current = 0;
      } else {
        const err = imgData.reason;
        const details =
          err?.status ? ` (HTTP ${err.status})` : err?.message ? ` (${err.message})` : "";
        setLoadError(`Gallery data is temporarily unavailable${details}. Retrying in the background.`);
      }

      if (statsData.status === "fulfilled") {
        setStats(statsData.value);
      } else if (loadedImages.length > 0) {
        // Stats API failed but images loaded — compute locally
        setStats(computeStatsFromImages(loadedImages));
      } else if (imgData.status === "fulfilled") {
        setStats(computeStatsFromImages(loadedImages));
      }

      // If images failed, retry in the background without trapping the page
      if (imgData.status !== "fulfilled") {
        clearTimeout(retryTimer.current);
        retryCount.current += 1;
        const delay = Math.min(15000, 2000 * retryCount.current);
        retryTimer.current = setTimeout(loadData, delay);
      }
    } catch (e) {
      console.error("Failed to load gallery data:", e);
      setLoadError("Gallery data is temporarily unavailable. Retrying in the background.");
      clearTimeout(retryTimer.current);
      retryCount.current += 1;
      const delay = Math.min(15000, 2000 * retryCount.current);
      retryTimer.current = setTimeout(loadData, delay);
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Health check + auto-reload when gallery recovers ──
  const loadHealth = useCallback(async () => {
    try {
      const data = await checkAllServicesHealth();
      setHealth(data);

      // If gallery was down and is now back up, reload data automatically
      if (galleryWasDown.current && data.gallery) {
        galleryWasDown.current = false;
        loadData();
      }
      // Track if gallery goes down
      if (!data.gallery) {
        galleryWasDown.current = true;
      }
    } catch {
      setHealth({ auth: false, gallery: false, ai: false, historique: false });
      galleryWasDown.current = true;
    }
  }, [loadData]);

  useEffect(() => {
    loadData();
    loadHealth();

    // Poll health every 15s — also triggers data reload on gallery recovery
    const healthInterval = setInterval(loadHealth, 15000);

    return () => {
      clearInterval(healthInterval);
      clearTimeout(retryTimer.current);
    };
  }, [loadData, loadHealth]);

  const handleImageDeleted = (deletedId) => {
    setImages((prev) => {
      const updated = prev.filter((img) => img.id !== deletedId);
      // Recompute stats from remaining images
      setStats(computeStatsFromImages(updated));
      return updated;
    });
  };

  const handleImageUpdated = () => {
    // Reload stats when an image is verified (status changes)
    getStats()
      .then(setStats)
      .catch(() => {
        // Fallback: recompute from images
        setStats((prev) => prev);
        getImages()
          .then((imgs) => {
            setImages(imgs);
            setStats(computeStatsFromImages(imgs));
          })
          .catch(() => {});
      });
  };

  // Filter images by search + status
  const filteredImages = images.filter((img) => {
    const matchesSearch =
      !searchTerm ||
      img.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      img.original_filename?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus =
      !statusFilter || img.verification_status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex items-center gap-3">
          <Loader2 className="text-[#adc6ff] animate-spin" size={24} />
          <span className="text-sm text-slate-400 font-bold uppercase tracking-widest">
            Loading vault…
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      {loadError && (
        <section className="px-4 py-3 rounded-2xl bg-[#eb4141]/10 border border-[#eb4141]/20 text-xs font-bold text-[#ffb4b4]">
          {loadError}
        </section>
      )}

      {/* Stats Row */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Images" value={stats.total} color="#adc6ff" icon="🖼️" />
        <StatCard label="Authentic" value={stats.unedited} color="#4edea3" icon="✅" />
        <StatCard label="Modified" value={stats.edited} color="#eb4141" icon="⚠️" />
        <StatCard label="Pending" value={stats.pending} color="#fbbf24" icon="⏳" />
      </section>

      {/* Microservices Health */}
      <section className="p-5 rounded-2xl bg-[#131b2e] border border-white/5">
        <div className="flex items-center gap-2 mb-4">
          <Activity size={14} className="text-[#adc6ff]" />
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
            Microservices Status
          </span>
        </div>
        <div className="flex flex-wrap gap-5">
          {health ? (
            <>
              <HealthDot label="Auth Service" healthy={health.auth} />
              <HealthDot label="Gallery Service" healthy={health.gallery} />
              <HealthDot label="AI Service" healthy={health.ai} />
              <HealthDot label="History Service" healthy={health.historique} />
            </>
          ) : (
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest animate-pulse">
              Checking services…
            </span>
          )}
        </div>
      </section>

      {/* Header & Search Section */}
      <section className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-1">
          <p className="text-[10px] font-bold tracking-[0.3em] text-[#adc6ff] uppercase">
            Personal Repository
          </p>
          <h2 className="text-4xl font-headline font-black text-white">
            Media Gallery
          </h2>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
              size={14}
            />
            <input
              type="text"
              placeholder="Search assets..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-[#131b2e] border border-white/5 rounded-xl py-2 pl-10 pr-4 text-xs text-white focus:ring-1 focus:ring-[#adc6ff] w-64 transition-all focus:outline-none"
            />
          </div>

          {/* Status filter dropdown */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-[#131b2e] border border-white/5 rounded-xl py-2.5 px-3 text-xs text-slate-400 focus:ring-1 focus:ring-[#adc6ff] transition-all focus:outline-none appearance-none cursor-pointer"
          >
            <option value="">All Status</option>
            <option value="unedited">✅ Authentic</option>
            <option value="edited">⚠️ Modified</option>
            <option value="pending">⏳ Pending</option>
          </select>
        </div>
      </section>

      {/* Gallery Grid */}
      <GalleryGrid images={filteredImages} onImageDeleted={handleImageDeleted} onImageUpdated={handleImageUpdated} />

      {/* Capacity Indicator */}
      <section className="mt-12 p-6 rounded-3xl bg-[#131b2e] border border-white/5 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-[#adc6ff]/10 rounded-2xl">
            <ImageIcon className="text-[#adc6ff]" size={20} />
          </div>
          <div>
            <p className="text-white text-xs font-bold uppercase">
              Vault Storage
            </p>
            <p className="text-[10px] text-slate-500 font-medium">
              {stats.total} image{stats.total !== 1 ? "s" : ""} stored
            </p>
          </div>
        </div>
        <div className="w-64 h-2 bg-[#0b1326] rounded-full overflow-hidden">
          <div
            className="h-full bg-[#adc6ff] rounded-full shadow-[0_0_10px_rgba(173,198,255,0.3)] transition-all duration-700"
            style={{ width: `${Math.min(100, (stats.total / 100) * 100)}%` }}
          ></div>
        </div>
      </section>
    </div>
  );
}

/* ── Sub-components ── */

function StatCard({ label, value, color, icon }) {
  return (
    <div className="p-5 rounded-2xl bg-[#131b2e] border border-white/5 hover:border-white/10 transition-all duration-300 hover:-translate-y-0.5">
      <div className="flex items-center gap-3 mb-3">
        <span className="text-xl">{icon}</span>
        <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">
          {label}
        </span>
      </div>
      <p className="text-3xl font-black" style={{ color }}>
        {value}
      </p>
    </div>
  );
}

function HealthDot({ label, healthy, unknown }) {
  let dotClass = "w-2 h-2 rounded-full ";
  if (unknown) {
    dotClass += "bg-slate-500 animate-pulse";
  } else if (healthy) {
    dotClass += "bg-[#4edea3] shadow-[0_0_8px_#4edea3]";
  } else {
    dotClass += "bg-[#eb4141] shadow-[0_0_8px_#eb4141]";
  }

  return (
    <div className="flex items-center gap-2">
      <div className={dotClass} />
      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
        {label}
      </span>
    </div>
  );
}
