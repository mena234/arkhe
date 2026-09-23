"use client";

import { useState } from "react";
import { Image as ImageIcon } from "lucide-react";
import NextImage from "next/image";

export function ProductImage({ src, alt, className = "" }: { src: string; alt: string; className?: string }) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  if (!src || failedSrc === src) return <span className={`image-fallback ${className}`} role="img" aria-label={`${alt} image placeholder`}><ImageIcon size={24} strokeWidth={1.3} /></span>;
  return <NextImage className={className} src={src} alt={alt} width={900} height={680} unoptimized onError={() => setFailedSrc(src)} />;
}
