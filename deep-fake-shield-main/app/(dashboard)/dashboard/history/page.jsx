"use client";

import React, { useState, useEffect } from "react";
import {
  Calendar,
  Tag,
  LayoutGrid,
  List,
  BadgeCheck,
  Clock,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  Loader2,
} from "lucide-react";

import { getImages, getStats } from "@/lib/api";

const GALLERY_URL = process.env.NEXT_PUBLIC_GALLERY_URL || "http://localhost:8001";

export default function HistoryPage() {
  const [images, setImages] = useState([]);
  const [stats, setStats] = useState({ total: 0, unedited: 0, edited: 0, pending: 0 });
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const perPage = 12;

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [imgData, statsData] = await Promise.allSettled([
        getImages(),
        getStats(),
      ]);
      if (imgData.status === "fulfilled") {
        // Sort by most recent
        const sorted = [...imgData.value].sort(
          (a, b) => new Date(b.uploaded_at) - new Date(a.uploaded_at)
        );
        setImages(sorted);
      }
      if (statsData.status === "fulfilled") setStats(statsData.value);
    } catch {
      console.error("Failed to load history data");
    }
    setLoading(false);
  };

  const getImageUrl = (img) => {
    const url = img?.thumbnail_url || img?.image_url || "";
    return url.startsWith("http") ? url : `${GALLERY_URL}${url}`;
  };

  // Filter
  const filtered = statusFilter
    ? images.filter((img) => img.verification_status === statusFilter)
    : images;

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const paginated = filtered.slice((page - 1) * perPage, page * perPage);

  // Featured = most recent verified image
  const featured = images.find(
    (img) =>
      img.verification_status === "unedited" ||
      img.verification_status === "edited"
  );

  // Verified count
  const verifiedCount = images.filter(
    (img) => img.verification_status !== "pending"
  ).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex items-center gap-3">
          <Loader2 className="text-[#adc6ff] animate-spin" size={24} />
          <span className="text-sm text-slate-400 font-bold uppercase tracking-widest">
            Loading archive…
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* HEADER */}
      <section className="mb-10">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 p-6 rounded-2xl bg-[#131b2e] border border-white/5">
          <div className="space-y-1">
            <p className="text-[10px] font-bold tracking-[0.2em] text-[#adc6ff] uppercase">
              Archive Protocol
            </p>
            <h2 className="text-2xl font-headline font-extrabold text-white">
              Verified Assets
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Status filter */}
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="bg-[#222a3d] border border-white/5 rounded-xl px-4 py-2.5 text-[11px] font-bold text-[#c6c6cd] focus:outline-none focus:ring-1 focus:ring-[#adc6ff] appearance-none cursor-pointer"
            >
              <option value="">All Status</option>
              <option value="unedited">✅ Authentic</option>
              <option value="edited">⚠️ Modified</option>
              <option value="pending">⏳ Pending</option>
            </select>

            <FilterButton icon={<Calendar size={14} />} label="Last 30 Days" />
            <FilterButton icon={<Tag size={14} />} label="Evidence Tags" />

            <div className="flex bg-[#060e20] p-1 rounded-xl border border-white/5">
              <button className="p-2 bg-[#2d3449] rounded-lg text-[#adc6ff]">
                <LayoutGrid size={16} />
              </button>
              <button className="p-2 text-slate-500">
                <List size={16} />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* GRID */}
      {filtered.length === 0 ? (
        <div className="text-center py-24 space-y-4">
          <div className="text-5xl mb-4">📭</div>
          <h3 className="text-xl font-bold text-white">No images found</h3>
          <p className="text-sm text-slate-400">
            {statusFilter
              ? "No images match the selected filter."
              : "Upload and verify images to see them here."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* FEATURED */}
          {featured && page === 1 && !statusFilter && (
            <div className="sm:col-span-2 sm:row-span-2 group relative overflow-hidden rounded-[2.5rem] bg-[#131b2e] border border-white/5 min-h-[300px]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                alt="Featured Asset"
                className="absolute inset-0 w-full h-full object-cover opacity-70 group-hover:opacity-40 group-hover:scale-110 transition-all duration-700"
                src={getImageUrl(featured)}
              />

              <div
                className={`absolute top-6 left-6 px-4 py-1.5 text-[10px] font-black rounded-full flex items-center gap-2 ${
                  featured.verification_status === "unedited"
                    ? "bg-[#00a572]/90 text-[#00311f]"
                    : "bg-[#eb4141]/90 text-white"
                }`}
              >
                <BadgeCheck size={14} />
                {featured.verification_status === "unedited"
                  ? "AUTHENTIC"
                  : "MODIFIED"}
              </div>

              <div className="absolute inset-0 flex flex-col justify-end p-8 opacity-0 group-hover:opacity-100 transition-all duration-500 bg-linear-to-t from-[#0b1326] to-transparent">
                <div className="bg-[#2d3449]/60 backdrop-blur-xl p-6 rounded-2xl">
                  <div className="flex justify-between">
                    <div>
                      <h3 className="text-white font-bold text-xl">
                        {featured.title || featured.original_filename}
                      </h3>
                      <p className="text-slate-400 text-[10px] flex items-center gap-2">
                        <Clock size={12} />
                        {featured.uploaded_at
                          ? new Date(featured.uploaded_at).toLocaleString()
                          : "—"}
                      </p>
                    </div>

                    {featured.ai_confidence_score != null && (
                      <div className="text-right">
                        <p className="text-[9px] text-[#adc6ff] uppercase">
                          Confidence
                        </p>
                        <p
                          className={`text-4xl font-black ${
                            featured.verification_status === "unedited"
                              ? "text-[#4edea3]"
                              : "text-[#eb4141]"
                          }`}
                        >
                          {Number(featured.ai_confidence_score).toFixed(1)}%
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Gallery Cards */}
          {paginated.map((item) => (
            <GalleryCard key={item.id} item={item} imageUrl={getImageUrl(item)} />
          ))}

          {/* STATS */}
          <div className="lg:col-span-2 p-10 rounded-[2.5rem] bg-[#131b2e] border border-white/5 relative overflow-hidden">
            <div className="absolute -right-10 -bottom-10 opacity-10">
              <ShieldCheck size={200} />
            </div>

            <div className="grid grid-cols-2 gap-10 relative z-10">
              <div>
                <p className="text-[10px] text-[#adc6ff] uppercase tracking-widest">
                  Vault Integrity
                </p>
                <p className="text-5xl font-black text-white">
                  {stats.total > 0
                    ? Math.round(
                        ((stats.unedited + stats.edited) / stats.total) * 100
                      )
                    : 0}
                  %
                </p>
              </div>

              <div>
                <p className="text-[10px] text-[#adc6ff] uppercase tracking-widest">
                  Verified Files
                </p>
                <p className="text-5xl font-black text-white">
                  {verifiedCount}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* FOOTER */}
      {filtered.length > 0 && (
        <footer className="mt-16 flex items-center justify-between py-8 border-t border-white/5">
          <p className="text-[10px] text-slate-600 uppercase">
            Displaying {(page - 1) * perPage + 1}–
            {Math.min(page * perPage, filtered.length)} of {filtered.length}{" "}
            assets
          </p>

          <div className="flex items-center gap-2">
            <PaginationButton
              icon={<ChevronLeft size={16} />}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
            />

            {[...Array(totalPages)].map((_, i) => (
              <PaginationButton
                key={i}
                label={i + 1}
                active={page === i + 1}
                onClick={() => setPage(i + 1)}
              />
            ))}

            <PaginationButton
              icon={<ChevronRight size={16} />}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
            />
          </div>
        </footer>
      )}
    </div>
  );
}

/* Sub Components */

function FilterButton({ icon, label }) {
  return (
    <div className="flex items-center gap-2 px-4 py-2.5 bg-[#222a3d] rounded-xl text-[11px] font-bold text-[#c6c6cd] border border-white/5">
      {icon}
      <span>{label}</span>
    </div>
  );
}

function GalleryCard({ item, imageUrl }) {
  const isFake = item.verification_status === "edited";
  const isReal = item.verification_status === "unedited";

  return (
    <div className="bg-[#131b2e] rounded-3xl overflow-hidden border border-white/5 relative h-64 group hover:border-[#adc6ff]/20 hover:-translate-y-1 transition-all duration-300 cursor-pointer">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        alt={item.title || "Image"}
        className="absolute inset-0 w-full h-full object-cover opacity-50 group-hover:opacity-70 transition-opacity"
        src={imageUrl}
      />

      <div
        className={`absolute top-3 left-3 px-2 py-1 text-[8px] font-black rounded-full uppercase ${
          isFake
            ? "bg-red-500/20 text-red-400"
            : isReal
            ? "bg-[#00a572]/20 text-[#4edea3]"
            : "bg-[#fbbf24]/20 text-[#fbbf24]"
        }`}
      >
        {isReal ? "REAL" : isFake ? "FAKE" : "PENDING"}
      </div>

      {item.ai_confidence_score != null && (
        <div className="absolute top-3 right-3 px-2 py-1 bg-[#2d3449]/80 backdrop-blur-md text-[9px] font-bold text-[#adc6ff] rounded-lg">
          {Number(item.ai_confidence_score).toFixed(0)}%
        </div>
      )}

      <div className="absolute bottom-0 p-4 w-full bg-[#2d3449]/80">
        <p className="text-xs text-white font-bold truncate">
          {item.title || item.original_filename}
        </p>
        <p className="text-[9px] text-slate-400">
          {item.uploaded_at
            ? new Date(item.uploaded_at).toLocaleDateString()
            : "—"}
        </p>
      </div>
    </div>
  );
}

function PaginationButton({ icon, label, active, onClick, disabled }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${
        active
          ? "bg-[#adc6ff]/10 text-[#adc6ff]"
          : "text-slate-500 hover:text-white"
      } ${disabled ? "opacity-30 cursor-not-allowed" : "cursor-pointer"}`}
    >
      {icon || <span className="text-xs">{label}</span>}
    </button>
  );
}
