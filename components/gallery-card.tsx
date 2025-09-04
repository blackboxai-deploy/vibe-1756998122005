"use client";

import { HistoryEntry } from "@/lib/types";
import { Code, User } from "lucide-react";
import { useState } from "react";
import Image from "next/image";

interface GalleryCardProps {
  id: number;
  entry: HistoryEntry;
  onClick: () => void;
  isMobile?: boolean;
  priority?: boolean;
}

export default function GalleryCard({
  id, 
  entry,
  onClick,
  isMobile = false,
  priority = false,
}: GalleryCardProps) {
  const [imageError, setImageError] = useState(false);
  const [imageLoading, setImageLoading] = useState(true);

  const thumbnailUrl = entry.screenshotUrl || entry.gallery?.thumbnailUrl;
  const title = entry.gallery?.title || entry.name;
  
  // Get creator information with backward compatibility
  const creatorName = entry.creatorName || entry.gallery?.creatorName || "BLACKBOXAI";
  const creatorAvatar = entry.creatorAvatar || entry.gallery?.creatorAvatar;
  
  // Generate initials for fallback avatar
  const getInitials = (name: string) => {
    if (name === "User") return " ";
    return name
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div>
      <div 
        className="group relative rounded-lg overflow-hidden transition-all duration-200 cursor-pointer border border-border"
        onClick={onClick}
      >
        <div className="relative aspect-[16/10] w-full bg-gray-900/50">
          {thumbnailUrl && !imageError ? (
            <>            
              <Image
                src={thumbnailUrl}
                alt={title}
                fill
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 33vw, 25vw"
                className={`object-cover transition-opacity duration-300 ${
                  imageLoading ? 'opacity-0' : 'opacity-100'
                }`}
                priority={priority}
                placeholder="blur"
                blurDataURL="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMSIgaGVpZ2h0PSIxIiB2aWV3Qm94PSIwIDAgMSAxIiBmaWxsPSJub25lIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxyZWN0IHdpZHRoPSIxIiBoZWlnaHQ9IjEiIGZpbGw9IiNmZmZmZmYiLz48L3N2Zz4="
                onLoad={() => setImageLoading(false)}
                onError={() => {
                  setImageError(true);
                  setImageLoading(false);
                }}
              />
            </>
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gray-900/50">
              <Code className="w-6 h-6 text-gray-500 text-center" />
            </div>
          )}
          
          {/* Title overlay - shows on hover at top center */}
          <div className="absolute top-4 left-1/2 transform -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-10">
            <div className="text-sm text-white font-semibold">
              {title}
            </div>
          </div>
          
          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center">
            <button
              className="inline-flex gap-1.5 items-center justify-center whitespace-nowrap text-sm font-semibold ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 data-[disabled=true]:pointer-events-none data-[disabled=true]:cursor-default data-[disabled=true]:opacity-50 group/button relative hover:bg-token-bg-active hover:backdrop-blur-[6px] px-4 py-2 bg-black/80 hover:bg-black/90 text-white rounded-lg font-medium pointer-events-auto transition-colors duration-200 shadow-lg"
              onClick={(e) => {
                e.stopPropagation();
                onClick();
              }}
            >
              View App
            </button>
          </div>
        </div>
      </div>
      {/* Creator info at bottom of screenshot */}
      <div className="px-3 py-2">
        <div className="flex items-center gap-2">
          {/* Creator Avatar */}
          <div className="flex-shrink-0">
            {creatorAvatar ? (
              <Image
                src={creatorAvatar}
                alt={`${creatorName}'s avatar`}
                width={24}
                height={24}
                className="rounded-full border border-border"
              />
            ) : (
              <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-xs text-white font-medium">
                {getInitials(creatorName)}
              </div>
            )}
          </div>
          
          {/* Creator Name and App Title */}
          <div className="flex-1 min-w-0">
            <div className="text-sm text-black font-medium truncate">
              {title}
            </div>
            <div className="text-xs text-black truncate">
              by {creatorName}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
