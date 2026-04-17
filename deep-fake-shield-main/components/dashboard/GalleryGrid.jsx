"use client";

import { useState } from "react";
import Link from "next/link";
import { Download, Maximize2, MoreVertical, Plus, Trash2, Heart } from "lucide-react";
import ImagePreview from "./ImagePreview";
import { deleteImage, toggleFavorite } from "@/lib/api";

const GALLERY_URL = process.env.NEXT_PUBLIC_GALLERY_URL || "http://localhost:8001";

export default function GalleryGrid({ images, onImageDeleted }) {
  const [activeImage, setActiveImage] = useState(null);
  const [favStates, setFavStates] = useState({});

  // Track local favorite overrides
  const isFav = (img) => favStates[img.id] !== undefined ? favStates[img.id] : img.is_favorite;

  const handleToggleFav = async (img) => {
    const newState = !isFav(img);
    setFavStates((prev) => ({ ...prev, [img.id]: newState }));
    try {
      await toggleFavorite(img.id);
    } catch {
      setFavStates((prev) => ({ ...prev, [img.id]: !newState }));
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this image permanently?")) return;
    try {
      await deleteImage(id);
      setActiveImage(null);
      onImageDeleted?.(id);
    } catch (e) {
      alert("Failed to delete image.");
    }
  };

  // Build full image URL from backend path
  const getImageUrl = (img) => {
    if (!img) return "";
    const url = img.thumbnail_url || img.image_url || "";
    if (url.startsWith("http")) return url;
    return `${GALLERY_URL}${url}`;
  };

  const getFullUrl = (img) => {
    if (!img) return "";
    const url = img.image_url || "";
    if (url.startsWith("http")) return url;
    return `${GALLERY_URL}${url}`;
  };

  return (
    <>
      {images.length === 0 ? (
        <div className="text-center py-24 space-y-4">
          <div className="text-5xl mb-4">🖼️</div>
          <h3 className="text-xl font-bold text-white">Your vault is empty</h3>
          <p className="text-sm text-slate-400 max-w-md mx-auto">
            Upload your first image to get started with AI verification.
          </p>
          <Link
            href="/dashboard/analyze"
            className="inline-flex items-center gap-2 mt-4 px-6 py-3 bg-linear-to-br from-[#adc6ff] to-[#357df1] text-[#002e6a] font-bold rounded-xl text-sm hover:opacity-90 transition-all active:scale-95"
          >
            <Plus size={18} />
            Upload Image
          </Link>
        </div>
      ) : (
        <div className="columns-2 md:columns-3 lg:columns-4 xl:columns-5 gap-4 space-y-4">
          {/* Upload New Placeholder */}
          <Link
            href={"/dashboard/analyze"}
            className="break-inside-avoid mb-4 flex aspect-square rounded-lg border-2 border-dashed border-white/5 bg-[#131b2e]/30 flex-col items-center justify-center gap-3 group hover:border-[#adc6ff]/40 hover:bg-[#131b2e]/50 transition-all duration-500"
          >
            <div className="p-4 rounded-full bg-[#adc6ff]/5 group-hover:scale-110 transition-transform">
              <Plus className="text-[#adc6ff]" size={24} />
            </div>
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 group-hover:text-white transition-colors">
              Add Image
            </span>
          </Link>

          {images.map((image) => (
            <MediaCard
              key={image.id}
              image={image}
              imageUrl={getImageUrl(image)}
              isFavorite={isFav(image)}
              onToggleFav={() => handleToggleFav(image)}
              onExpand={() =>
                setActiveImage({ ...image, fullUrl: getFullUrl(image) })
              }
              onDelete={() => handleDelete(image.id)}
            />
          ))}
        </div>
      )}

      <ImagePreview
        activeImage={activeImage}
        onClose={() => setActiveImage(null)}
        onDelete={(id) => handleDelete(id)}
      />
    </>
  );
}

const STATUS_CONFIG = {
  unedited: { label: "REAL", color: "bg-[#4edea3]/20 text-[#4edea3]" },
  edited: { label: "FAKE", color: "bg-[#eb4141]/20 text-[#eb4141]" },
  pending: { label: "PENDING", color: "bg-[#fbbf24]/20 text-[#fbbf24]" },
  error: { label: "ERROR", color: "bg-[#eb4141]/20 text-[#eb4141]" },
  rejected: { label: "REJECTED", color: "bg-slate-500/20 text-slate-400" },
};

function MediaCard({ image, imageUrl, isFavorite, onToggleFav, onExpand, onDelete }) {
  const status = STATUS_CONFIG[image.verification_status] || STATUS_CONFIG.pending;

  return (
    <div
      onClick={onExpand}
      className="break-inside-avoid mb-4 group relative rounded-lg overflow-hidden bg-[#131b2e] border border-white/5 transition-all duration-500 hover:shadow-2xl hover:shadow-[#adc6ff]/10 hover:-translate-y-1 cursor-zoom-in"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={imageUrl}
        alt={image.title || "Image"}
        className="w-full h-auto object-cover transition-transform duration-700 group-hover:scale-110 opacity-80 group-hover:opacity-100"
        loading="lazy"
      />

      {/* Status Badge */}
      <div className="absolute top-3 left-3">
        <span
          className={`text-[8px] font-black px-2 py-0.5 rounded tracking-widest ${status.color}`}
        >
          {status.label}
        </span>
      </div>

      {/* Favorite Button */}
      <button
        onClick={(e) => { e.stopPropagation(); onToggleFav(); }}
        className={`absolute top-3 right-3 p-1.5 rounded-full backdrop-blur-md transition-all z-10 ${
          isFavorite
            ? "bg-red-500/20 text-red-400"
            : "bg-[#0b1326]/60 text-slate-500 opacity-0 group-hover:opacity-100 hover:text-red-400"
        }`}
      >
        <Heart size={14} fill={isFavorite ? "currentColor" : "none"} />
      </button>

      {/* Selection Overlay */}
      <div className="absolute inset-0 bg-linear-to-t from-[#0b1326] via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500">
        <div className="absolute top-3 right-12">
          <button
            onClick={(e) => {
              e.stopPropagation();
            }}
            className="p-1.5 bg-[#0b1326]/60 backdrop-blur-md rounded-lg text-white hover:text-[#adc6ff] transition-colors"
          >
            <MoreVertical size={14} />
          </button>
        </div>

        <div className="absolute bottom-0 left-0 right-0 p-4 translate-y-2 group-hover:translate-y-0 transition-transform duration-500">
          <p className="text-[10px] font-black text-white truncate uppercase tracking-tighter mb-1">
            {image.title || image.original_filename}
          </p>
          <div className="flex justify-between items-center">
            <span className="text-[9px] text-slate-400 font-bold">
              {image.file_size_display || ""}
            </span>
            <div className="flex gap-2">
              <button
                className="text-slate-400 hover:text-white transition-colors"
                onClick={(e) => e.stopPropagation()}
              >
                <Download size={14} />
              </button>
              <button
                className="text-slate-400 hover:text-[#eb4141] transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete();
                }}
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Center Icon Overlay */}
      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
        <div className="w-10 h-10 bg-white/10 backdrop-blur-md border border-white/20 rounded-full flex items-center justify-center scale-75 group-hover:scale-100 transition-transform duration-500">
          <Maximize2 className="text-white" size={18} />
        </div>
      </div>
    </div>
  );
}
