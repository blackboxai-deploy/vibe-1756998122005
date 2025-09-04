'use client'

import { DemoCard, GalleryItemData, PublishedApp } from "@/lib/types";
import { useEffect, useState, useRef, useCallback } from "react";
import GalleryCard from "./gallery-card";
import { useSession } from "next-auth/react";
import { useIsMobile } from "@/hooks/useIsomorphicMediaQuery";
import { usePublishedApps } from "@/hooks/usePublishedApps";
import { Loader2 } from "lucide-react";

const vibe_demo_cards = [
  {
    title: "Character AI Chat",
    description: "Interactive AI character chat platform where users can create and converse with personalized AI personalities",
    category: "ai",
    image: "/vibe-demos/character-ai.jpg",
    appUrl: "https://vibe-1755470931236.vercel.app/",
    urlClone: "https://vibe-1755470931236.vercel.app/"
  },
  {
    title: "AI Image Generator",
    description: "Sophisticated AI-powered image creation platform for creating artwork, illustrations, and creative visuals",
    category: "ai",
    image: "/vibe-demos/imagen.jpg",
    appUrl: "https://vibe-1755301912515.vercel.app/",
    urlClone: "https://vibe-1755301912515.vercel.app/"
  },
  {
    title: "Uber-like Website",
    description: "All-in-one workspace for notes, tasks, and project management with collaborative features",
    category: "productivity",
    image: "/vibe-demos/uber.jpg",
    appUrl: "https://vibe-1755301912515.vercel.app/",
    urlClone: "https://vibe-1755301912515.vercel.app/"
  },
  {
    title: "AI Rap Music Video",
    description: "All-in-one workspace for notes, tasks, and project management with collaborative features",
    category: "productivity",
    image: "/vibe-demos/ai-rap.jpg",
    appUrl: "https://vibe-1755558384196.vercel.app/",
    urlClone: "https://vibe-1755558384196.vercel.app/"
  },
  {
    title: "Notion-like Workspace",
    description: "All-in-one workspace for notes, tasks, and project management with collaborative features",
    category: "productivity",
    image: "/vibe-demos/notion-like.jpg",
    appUrl: "https://vibe-1755450442921.vercel.app/",
    urlClone: "https://vibe-1755450442921.vercel.app/"
  },
  {
    title: "Youtube-like Web App",
    description: "All-in-one workspace for notes, tasks, and project management with collaborative features",
    category: "productivity",
    image: "/vibe-demos/youtube.jpg",
    appUrl: "https://vibe-1755537245894.vercel.app/",
    urlClone: "https://vibe-1755537245894.vercel.app/"
  },
  {
    title: "Social Media Image Generator",
    description: "AI-powered tool for creating stunning social media graphics and promotional content",
    category: "design",
    image: "/vibe-demos/social-imagen.jpg",
    appUrl: "https://vibe-1755465923980.vercel.app/",
    urlClone: "https://vibe-1755465923980.vercel.app/"
  },
  {
    title: "AI Images from Websites URLs",
    description: "All-in-one workspace for notes, tasks, and project management with collaborative features",
    category: "productivity",
    image: "/vibe-demos/website-image.jpg",
    appUrl: "https://vibe-1755536518744.vercel.app",
    urlClone: "https://vibe-1755536518744.vercel.app"
  },
  {
    title: "Spacex-like Website",
    description: "All-in-one workspace for notes, tasks, and project management with collaborative features",
    category: "productivity",
    image: "/vibe-demos/spacex.jpg",
    appUrl: "https://vibe-1755535691119.vercel.app/",
    urlClone: "https://vibe-1755535691119.vercel.app/"
  },
  {
    title: "Tetris-like Website",
    description: "All-in-one workspace for notes, tasks, and project management with collaborative features",
    category: "productivity",
    image: "/vibe-demos/tetris.jpg",
    appUrl: "https://vibe-1755551368531.vercel.app/",
    urlClone: "https://vibe-1755551368531.vercel.app/"
  },
  {
    title: "Chess with AI Models",
    description: "All-in-one workspace for notes, tasks, and project management with collaborative features",
    category: "productivity",
    image: "/vibe-demos/chess.jpg",
    appUrl: "https://vibe-1755553239912.vercel.app/",
    urlClone: "https://vibe-1755553239912.vercel.app/"
  },
  {
    title: "Currency Exchange Monitor | Real-time Rates & Analytics",
    description: "Real-time exchange rate monitoring for popular currencies with interactive graphs and analytics",
    category: "finance",
    image: "/vibe-demos/currency-monitor.jpg",
    appUrl: "https://vibe-1755481768650.vercel.app/",
    urlClone: "https://vibe-1755481768650.vercel.app/"
  }
]

const vibe_demos_gallery: GalleryItemData[] = vibe_demo_cards.map((card: DemoCard, index: number) => {
  const date = new Date();
  date.setDate(date.getDate() - index);

  return {
    id: index,
    createdAt: date.getTime(),
    isPrivate: false,
    name: card.title,
    prompt: card.description,
    url: card.appUrl || `http://agent.blackbox.ai/?sandbox=vibe_demo_${index}`,
    screenshotUrl: card.image || undefined,
    gallery: {
      type: "demo",
      cloneUrl: card.urlClone,
      appUrl: card.appUrl,
      published: true,
      title: card.title,
      description: card.description,
      thumbnailUrl: card.image || card.video || undefined,
      videoUrl: card.video || undefined,
      creatorEmail: "vibe.ai@blackbox.ai"
    }
  };
});

export interface UseDemoDataResult {
  items: GalleryItemData[];
  isLoading: boolean;
  error: string | null;
  hasMore: boolean;
  loadMore: () => void;
  totalItems: number;
}

function useDemoData(itemsPerPage: number = 20): UseDemoDataResult {
  const [items, setItems] = useState<GalleryItemData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(0);

  const totalItems = vibe_demos_gallery.length;
  const hasMore = (currentPage + 1) * itemsPerPage < totalItems;

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Simulate API delay for consistency with other data sources
      await new Promise(resolve => setTimeout(resolve, 200));
      
      const initialItems = vibe_demos_gallery
        .slice(0, itemsPerPage)
        .map((item, index) => ({
          ...item,
          id: index + 1,
        }));
      
      setItems(initialItems);
      setCurrentPage(0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load demo data');
    } finally {
      setIsLoading(false);
    }
  };

  const loadMore = async () => {
    if (!hasMore || isLoading) return;

    setIsLoading(true);
    setError(null);

    try {
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 200));
      
      const nextPage = currentPage + 1;
      const startIndex = nextPage * itemsPerPage;
      const endIndex = startIndex + itemsPerPage;
      
      const newItems = vibe_demos_gallery
        .slice(startIndex, endIndex)
        .map((item, index) => ({
          ...item,
          id: startIndex + index + 1,
        }));

      setItems(prev => [...prev, ...newItems]);
      setCurrentPage(nextPage);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load more demo data');
    } finally {
      setIsLoading(false);
    }
  };

  return {
    items,
    isLoading,
    error,
    hasMore,
    loadMore,
    totalItems,
  };
}

interface Props {
  isMobile?: boolean
}

const convertPublishedAppToGalleryItem = (app: PublishedApp, index: number): GalleryItemData => {
  return {
    id: index + 1000, // Offset to avoid conflicts with demo data
    createdAt: new Date(app.createdAt).getTime(),
    isPrivate: false,
    name: app.title,
    url: app.appUrl,
    screenshotUrl: app.screenshotUrl,
    creatorName: app.creatorName,
    creatorAvatar: app.creatorAvatar,
    gallery: {
      type: "published",
      appUrl: app.appUrl,
      cloneUrl: app.appUrl,
      published: true,
      title: app.title,
      thumbnailUrl: app.screenshotUrl,
      creatorEmail: app.creatorEmail,
      creatorName: app.creatorName,
      creatorAvatar: app.creatorAvatar,
      likes: app.likes || 0,
      forks: 0
    }
  }
}

export function CommunityApps({isMobile = false}: Props) {
  const demoData = useDemoData(20);
  const publishedApps = usePublishedApps(20);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Combine demo data with published apps
  const allItems = [
    ...(demoData?.items || []),
    // ...publishedApps.apps.map((app, index) => convertPublishedAppToGalleryItem(app, index))
  ];

  // Auto-load more apps using intersection observer
  const handleAutoLoadMore = useCallback(() => {
    if (publishedApps.hasMore && !publishedApps.isLoading) {
      publishedApps.loadMore();
    }
  }, [publishedApps.hasMore, publishedApps.isLoading, publishedApps.loadMore]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting) {
          handleAutoLoadMore();
        }
      },
      {
        root: null,
        rootMargin: '40px', // Start loading 100px before the sentinel comes into view
        threshold: 0.1,
      }
    );

    observer.observe(sentinel);

    return () => {
      observer.unobserve(sentinel);
      observer.disconnect();
    };
  }, [handleAutoLoadMore]);

  return (
    <div className="w-full">
        <h3 className={`${isMobile ? 'text-center text-base' : 'text-left text-xl'} font-semibold mb-4`}>
          Apps From The Community
        </h3>
        <div className={`${isMobile ? '' : 'pt-4 border-t border-border'} grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4`}>
          {allItems.map((item, index) => (
            <GalleryCard
              isMobile={isMobile}
              key={`${item.gallery?.type || 'demo'}-${item.id}`}
              id={item.id}
              entry={item}
              priority={index < 3} // Prioritize first 3 images for faster loading
              onClick={() => {
                if (item.gallery?.appUrl) {
                  window.open(item.gallery.appUrl, '_blank');
                }
              }}
            />
          ))}
        </div>

        {/* Auto-loading sentinel and loading indicator */}
        {publishedApps.hasMore && (
          <>
            {/* Invisible sentinel element for intersection observer */}
            <div ref={sentinelRef} className="h-1 w-full" />
            
            {/* Loading indicator */}
            {/* {publishedApps.isLoading && (
              <div className="flex justify-center my-4">
                <div className="flex items-center text-muted-foreground">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Loading more apps...
                </div>
              </div>
            )} */}
          </>
        )}
    </div>
  )
}
