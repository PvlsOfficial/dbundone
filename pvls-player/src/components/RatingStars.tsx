"use client";

import { useState } from "react";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

interface RatingStarsProps {
  rating?: number;
  onChange?: (rating: number) => void;
  readonly?: boolean;
  size?: "sm" | "md" | "lg";
}

export function RatingStars({ rating = 0, onChange, readonly = false, size = "md" }: RatingStarsProps) {
  const [hovered, setHovered] = useState(0);

  const sizeClass = {
    sm: "w-3 h-3",
    md: "w-4 h-4",
    lg: "w-6 h-6",
  }[size];

  return (
    <div
      className={cn("flex items-center gap-0.5", !readonly && "cursor-pointer")}
      onMouseLeave={() => !readonly && setHovered(0)}
    >
      {[1, 2, 3, 4, 5].map((star) => {
        const active = star <= (hovered || rating);
        return (
          <Star
            key={star}
            className={cn(
              sizeClass,
              "transition-all duration-100",
              active
                ? "fill-[hsl(var(--accent-hsl))] text-[hsl(var(--accent-hsl))]"
                : "fill-transparent text-white/20",
              !readonly && "hover:scale-110"
            )}
            onMouseEnter={() => !readonly && setHovered(star)}
            onClick={() => {
              if (!readonly && onChange) {
                onChange(star === rating ? 0 : star);
              }
            }}
          />
        );
      })}
    </div>
  );
}
