import { cn } from "@/lib/utils";

/** The floating cloud illustration in the drop zone. */
export function CloudArt({ active }: { active: boolean }) {
  return (
    <div className={cn("transition-transform duration-300", active ? "scale-110" : "animate-floaty")}>
      <svg width="210" height="130" viewBox="0 0 210 130" fill="none" aria-hidden className="text-foreground">
        <defs>
          <linearGradient id="cg" x1="40" y1="120" x2="175" y2="20" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#4ade80" />
            <stop offset="0.5" stopColor="#5eead4" />
            <stop offset="1" stopColor="#bae6fd" />
          </linearGradient>
          <linearGradient id="cg2" x1="30" y1="120" x2="95" y2="60" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#22c55e" />
            <stop offset="1" stopColor="#4ade80" />
          </linearGradient>
          <clipPath id="cloud">
            <circle cx="62" cy="88" r="34" />
            <circle cx="114" cy="62" r="44" />
            <circle cx="166" cy="90" r="32" />
            <rect x="62" y="80" width="104" height="42" />
          </clipPath>
        </defs>
        {/* outline: stroked union, then fill over it */}
        <g stroke="currentColor" strokeOpacity=".75" strokeWidth="2.2">
          <circle cx="62" cy="88" r="34" />
          <circle cx="114" cy="62" r="44" />
          <circle cx="166" cy="90" r="32" />
          <rect x="62" y="80" width="104" height="42" />
        </g>
        <g fill="url(#cg)">
          <circle cx="62" cy="88" r="34" />
          <circle cx="114" cy="62" r="44" />
          <circle cx="166" cy="90" r="32" />
          <rect x="62" y="80" width="104" height="42" />
        </g>
        {/* front puff, clipped to the cloud */}
        <g clipPath="url(#cloud)">
          <path d="M20 88A42 42 0 0 1 96 82C99 104 92 122 70 124H20Z" fill="url(#cg2)" />
          <path d="M96 82C99 104 92 122 70 122" stroke="currentColor" strokeOpacity=".75" strokeWidth="1.2" />
        </g>
        {/* arrow */}
        <g className={cn(active && "animate-arrow-up")} stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M120 98V58" />
          <path d="M104 74l16-16 16 16" />
        </g>
      </svg>
    </div>
  );
}
