"use client";

import { useState, useEffect } from "react";

import { BarChart3, FileDown, Dna, Zap, ShieldCheck, Loader2 } from "lucide-react";
import UploadZone from "@/components/dashboard/Analyze/UploadZone";
import { getImages, verifyImage } from "@/lib/api";

const GALLERY_URL = process.env.NEXT_PUBLIC_GALLERY_URL || "http://localhost:8001";

export default function AnalyzePage() {
  const [latestResult, setLatestResult] = useState(null);
  const [recentImages, setRecentImages] = useState([]);
  const [verifying, setVerifying] = useState(null); // ID of image currently being verified

  useEffect(() => {
    loadRecentImages();
  }, []);

  const loadRecentImages = async () => {
    try {
      const data = await getImages();
      // Sort by most recent — take last 4
      const sorted = [...data].sort(
        (a, b) => new Date(b.uploaded_at) - new Date(a.uploaded_at)
      );
      setRecentImages(sorted.slice(0, 4));

      // If the most recent image has been verified, show it as the latest result
      const lastVerified = sorted.find(
        (img) => img.verification_status !== "pending"
      );
      if (lastVerified) {
        setLatestResult(lastVerified);
      }
    } catch {
      console.error("Failed to load recent images");
    }
  };

  const handleUploadComplete = (result) => {
    setRecentImages((prev) => [result, ...prev.slice(0, 3)]);
  };

  const handleVerifyFromCard = async (image) => {
    setVerifying(image.id);
    try {
      const updated = await verifyImage(image.id);
      setLatestResult(updated);
      setRecentImages((prev) =>
        prev.map((img) => (img.id === image.id ? updated : img))
      );
    } catch {
      alert("AI service unavailable. Please try again later.");
    }
    setVerifying(null);
  };

  const getImageUrl = (img) => {
    const url = img?.image_url || img?.thumbnail_url || "";
    return url.startsWith("http") ? url : `${GALLERY_URL}${url}`;
  };

  const status = latestResult?.verification_status;
  const isAuthentic = status === "unedited";
  const isFake = status === "edited";
  const confidence = latestResult?.ai_confidence_score;

  return (
    <div className="max-w-7xl mx-auto space-y-12 animate-in fade-in duration-700">
      {/* Hero */}
      <section className="grid grid-cols-12 gap-8 items-end">
        <div className="col-span-12 md:col-span-7">
          <span className="text-[10px] uppercase tracking-[0.3em] text-[#adc6ff] font-bold mb-2 block">
            AI Image Analysis
          </span>

          <h2 className="text-5xl font-black font-headline text-white leading-tight">
            ANALYZE <br />
            <span className="bg-linear-to-r from-[#adc6ff] to-[#357df1] bg-clip-text text-transparent italic">
              YOUR IMAGE
            </span>
          </h2>
        </div>

        <div className="col-span-12 md:col-span-5 text-[#c6c6cd] font-body text-sm leading-relaxed pb-2 border-l border-[#222a3d] pl-6">
          Upload an image and let the AI detect whether it is real or
          manipulated. AI verification is{" "}
          <strong className="text-[#adc6ff]">optional</strong> — you can upload
          first and verify later.
        </div>
      </section>

      {/* Upload */}
      <UploadZone onUploadComplete={handleUploadComplete} />

      {/* Latest Result Section */}
      {latestResult && (
        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-black uppercase tracking-[0.2em] text-slate-500 flex items-center gap-2">
              <BarChart3 size={16} />
              Most Recent Analysis
            </h4>

            <span className="text-[10px] text-slate-700 font-bold uppercase tracking-widest">
              Image ID: #{latestResult.id}
            </span>
          </div>

          <div className="grid grid-cols-12 gap-6">
            {/* Image Result */}
            <div className="col-span-12 lg:col-span-8 group relative overflow-hidden rounded-3xl shadow-2xl border border-white/5 min-h-[300px]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                alt="Analyzed Image"
                className="absolute inset-0 w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105"
                src={getImageUrl(latestResult)}
              />
              {/* Scanning Line Effect */}
              <div className="absolute top-0 left-0 w-full h-0.5 bg-[#adc6ff]/50 shadow-[0_0_15px_#adc6ff] animate-scan"></div>

              {/* Verdict */}
              <div className="absolute top-6 left-6 flex items-center gap-4">
                <div
                  className={`bg-[#2d3449]/60 backdrop-blur-md px-4 py-2 flex items-center gap-3 rounded-xl border ${
                    isAuthentic
                      ? "border-[#4edea3]/30"
                      : isFake
                      ? "border-[#eb4141]/30"
                      : "border-[#fbbf24]/30"
                  }`}
                >
                  <span
                    className={`flex h-2.5 w-2.5 rounded-full ${
                      isAuthentic
                        ? "bg-[#4edea3]"
                        : isFake
                        ? "bg-[#eb4141]"
                        : "bg-[#fbbf24]"
                    }`}
                  ></span>
                  <span
                    className={`font-black font-headline tracking-[0.2em] text-xs ${
                      isAuthentic
                        ? "text-[#4edea3]"
                        : isFake
                        ? "text-[#eb4141]"
                        : "text-[#fbbf24]"
                    }`}
                  >
                    {isAuthentic ? "REAL" : isFake ? "FAKE" : "PENDING"}
                  </span>
                </div>

                {confidence != null && (
                  <div className="bg-[#2d3449]/60 backdrop-blur-md px-4 py-2 rounded-xl border border-white/10">
                    <span className="text-white text-[10px] font-bold uppercase">
                      Confidence:{" "}
                    </span>
                    <span className="text-[#adc6ff] font-black font-headline text-xs">
                      {Number(confidence).toFixed(1)}%
                    </span>
                  </div>
                )}
              </div>

              {/* Info boxes */}
              <div className="absolute bottom-8 right-8 flex flex-col gap-2 items-end">
                <div className="bg-[#2d3449]/80 backdrop-blur-md p-3 rounded-lg border-l-2 border-[#adc6ff]">
                  <p className="text-[9px] text-[#adc6ff] font-black uppercase mb-1">
                    Image Info
                  </p>
                  <p className="text-[10px] font-mono text-slate-300">
                    {latestResult.title || latestResult.original_filename}
                  </p>
                </div>

                <div
                  className={`bg-[#2d3449]/80 backdrop-blur-md p-3 rounded-lg border-l-2 ${
                    isAuthentic ? "border-[#4edea3]" : isFake ? "border-[#eb4141]" : "border-[#fbbf24]"
                  }`}
                >
                  <p
                    className={`text-[9px] font-black uppercase mb-1 ${
                      isAuthentic ? "text-[#4edea3]" : isFake ? "text-[#eb4141]" : "text-[#fbbf24]"
                    }`}
                  >
                    Analysis Result
                  </p>
                  <p className="text-[10px] font-mono text-slate-300">
                    {isAuthentic
                      ? "No strong manipulation detected"
                      : isFake
                      ? "Manipulation artifacts detected"
                      : "Awaiting verification"}
                  </p>
                </div>
              </div>
            </div>

            {/* Side Panel */}
            <div className="col-span-12 lg:col-span-4 flex flex-col gap-6">
              <div className="bg-[#222a3d] rounded-2xl p-6 flex-1 relative overflow-hidden border border-white/5">
                <div className="absolute top-4 right-4 opacity-5">
                  <Dna size={80} />
                </div>

                <h5 className="text-xs font-black uppercase tracking-widest text-slate-500 mb-6 flex items-center gap-2">
                  <Zap size={14} className="text-[#adc6ff]" />
                  Analysis Details
                </h5>

                <div className="space-y-5">
                  {latestResult.ai_report ? (
                    <>
                      <ProgressItem
                        label="Editing Artifacts"
                        value={`${latestResult.ai_report.editing_artifacts || 10}%`}
                        status={
                          (latestResult.ai_report.editing_artifacts || 10) < 30
                            ? "Low"
                            : "High"
                        }
                      />
                      <ProgressItem
                        label="Compression Artifacts"
                        value={`${latestResult.ai_report.compression_artifacts || 30}%`}
                        status="Normal"
                      />
                      <ProgressItem
                        label="Image Consistency"
                        value={`${confidence ? Math.round(confidence) : 50}%`}
                        status={
                          confidence > 80 ? "High" : confidence > 50 ? "Medium" : "Low"
                        }
                      />
                    </>
                  ) : (
                    <>
                      <ProgressItem label="Editing Artifacts" value="—" status="N/A" />
                      <ProgressItem label="Compression Artifacts" value="—" status="N/A" />
                      <ProgressItem label="Image Consistency" value="—" status="N/A" />
                    </>
                  )}
                </div>

                <div className="mt-10 pt-6 border-t border-slate-700/50">
                  <h5 className="text-xs font-black uppercase tracking-widest text-slate-500 mb-4">
                    Image Information
                  </h5>

                  <div className="grid grid-cols-2 gap-y-4 gap-x-2">
                    <ExifItem label="File" value={latestResult.original_filename || "—"} />
                    <ExifItem label="Size" value={latestResult.file_size_display || "—"} />
                    <ExifItem label="Dimensions" value={latestResult.dimensions_display || "—"} />
                    <ExifItem label="Format" value={latestResult.mime_type || "—"} />
                  </div>
                </div>
              </div>

              <button className="bg-[#2d3449] hover:bg-[#31394d] transition-all py-4 rounded-2xl flex items-center justify-center gap-3 group active:scale-95 shadow-xl">
                <FileDown size={18} />
                <span className="text-[11px] font-black uppercase tracking-widest text-white">
                  Download Result
                </span>
              </button>
            </div>
          </div>
        </section>
      )}

      {/* Recent Images */}
      {recentImages.length > 0 && (
        <section className="space-y-6">
          <h4 className="text-sm font-black uppercase tracking-[0.2em] text-slate-500">
            Recent Images
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {recentImages.map((img) => (
              <ArchiveCard
                key={img.id}
                image={img}
                imageUrl={getImageUrl(img)}
                verifying={verifying === img.id}
                onVerify={() => handleVerifyFromCard(img)}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

/* Sub Components */

function ProgressItem({ label, value, status }) {
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-[10px] uppercase font-bold text-slate-400">
        <span>{label}</span>
        <span className="text-white">{status}</span>
      </div>

      <div className="h-1 bg-[#0b1326] rounded-full overflow-hidden">
        <div
          className="h-full bg-[#adc6ff] transition-all duration-700"
          style={{ width: value === "—" ? "0%" : value }}
        ></div>
      </div>
    </div>
  );
}

function ExifItem({ label, value }) {
  return (
    <div>
      <p className="text-[9px] text-slate-600 font-bold uppercase tracking-wider">
        {label}
      </p>
      <p className="text-[11px] text-white font-medium truncate">{value}</p>
    </div>
  );
}

function ArchiveCard({ image, imageUrl, verifying, onVerify }) {
  const status = image.verification_status;
  const isFake = status === "edited";
  const isReal = status === "unedited";
  const isPending = status === "pending";

  return (
    <div className="bg-[#131b2e] rounded-2xl overflow-hidden border border-white/5 hover:border-[#adc6ff]/20 hover:-translate-y-1 transition-all duration-300 cursor-pointer group">
      <div className="h-32 relative overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          alt={image.title || "Image"}
          className="absolute inset-0 w-full h-full object-cover opacity-40 group-hover:opacity-60 transition-opacity"
          src={imageUrl}
        />
      </div>

      <div className="p-4">
        <div className="flex justify-between items-center mb-2">
          <span
            className={`text-[8px] font-black px-2 py-0.5 rounded tracking-widest ${
              isFake
                ? "bg-[#eb4141]/20 text-[#eb4141]"
                : isReal
                ? "bg-[#4edea3]/20 text-[#4edea3]"
                : "bg-[#fbbf24]/20 text-[#fbbf24]"
            }`}
          >
            {isReal ? "REAL" : isFake ? "FAKE" : "PENDING"}
          </span>

          <span className="text-[10px] text-slate-600 font-mono">
            #{image.id}
          </span>
        </div>

        <p className="text-xs font-bold text-white truncate">
          {image.title || image.original_filename}
        </p>
        <p className="text-[9px] text-slate-500 uppercase font-bold mb-2">
          {image.uploaded_at
            ? new Date(image.uploaded_at).toLocaleDateString()
            : "Recently"}
        </p>

        {/* Verify button for pending images */}
        {isPending && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onVerify();
            }}
            disabled={verifying}
            className="w-full mt-2 py-2 bg-[#adc6ff]/10 text-[#adc6ff] rounded-lg text-[9px] font-bold uppercase tracking-widest hover:bg-[#adc6ff]/20 transition-all disabled:opacity-50"
          >
            {verifying ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 size={10} className="animate-spin" />
                Analyzing…
              </span>
            ) : (
              <>🤖 Verify with AI</>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
