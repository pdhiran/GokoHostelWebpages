"use client";

import Image from "next/image";
import { useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import type { HeroLoopVideo } from "@/lib/site";

type HeroBackdropProps = {
  /** Shown when video is off (`prefers-reduced-motion`) or as Next/Image optimization target for static export. Omit for solid gradient fallback. */
  image?: string;
  imageAlt?: string;
  video?: HeroLoopVideo | null;
  priority?: boolean;
};

export function HeroBackdrop({
  image,
  imageAlt,
  video,
  priority = true,
}: HeroBackdropProps) {
  const reduceMotion = useReducedMotion();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [videoReady, setVideoReady] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(
      "(max-width: 768px) and (orientation: portrait)",
    );
    setIsMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  useEffect(() => {
    if (!video || reduceMotion) return;
    const win = window as Window & {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
      cancelIdleCallback?: (id: number) => void;
    };
    if (win.requestIdleCallback) {
      const id = win.requestIdleCallback(() => setVideoReady(true), { timeout: 2000 });
      return () => win.cancelIdleCallback?.(id);
    }
    const t = window.setTimeout(() => setVideoReady(true), 800);
    return () => window.clearTimeout(t);
  }, [video, reduceMotion]);

  const showVideo = Boolean(video) && !reduceMotion && videoReady;

  useEffect(() => {
    if (!showVideo || !videoRef.current) return;
    const v = videoRef.current;
    v.muted = true;
    const play = () => {
      v.play().catch(() => {});
    };
    if (v.readyState >= 2) play();
    else v.addEventListener("canplay", play, { once: true });
    return () => v.removeEventListener("canplay", play);
  }, [showVideo, video, isMobile]);

  return (
    <div className="relative h-full min-h-full w-full">
      {!showVideo && (image || video?.poster) ? (
        <Image
          src={image || video!.poster}
          alt={imageAlt ?? ""}
          fill
          className="object-cover"
          sizes="100vw"
          priority={priority}
        />
      ) : !showVideo ? (
        <div
          className="absolute inset-0 bg-gradient-to-br from-brand-green-dark via-brand-green to-brand-green-dark"
          aria-hidden
        />
      ) : (
        <video
          key={isMobile ? "mobile" : "desktop"}
          ref={videoRef}
          className="absolute inset-0 z-0 h-full w-full object-cover"
          poster={video!.poster}
          muted
          playsInline
          loop
          autoPlay
          preload="metadata"
          aria-hidden
        >
          <source
            src={isMobile ? video!.mobileWebm : video!.webm}
            type="video/webm"
          />
          <source
            src={isMobile ? video!.mobileMp4 : video!.mp4}
            type="video/mp4"
          />
        </video>
      )}
    </div>
  );
}
