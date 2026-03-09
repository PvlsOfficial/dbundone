import { cn } from "@/lib/utils";

interface AppLogoProps {
  size?: number;
  className?: string;
}

export function AppLogo({ size = 36, className }: AppLogoProps) {
  return (
    <div
      className={cn("relative flex-shrink-0", className)}
      style={{ width: size, height: size }}
    >
      <div
        className="w-full h-full rounded-xl bg-gradient-to-br from-primary via-primary/80 to-primary/60 flex items-center justify-center shadow-lg shadow-primary/30"
      >
        <svg
          viewBox="200 500 3600 3200"
          className="w-[100%] h-[100%] fill-white"
          xmlns="http://www.w3.org/2000/svg"
        >
          <g>
            <g transform="matrix(1.375418,0,-0,-0.692272,94.813608,4977.054673)">
              <path d="M1385.17,2762L1644,3199.689L1126.339,3199.689L1385.17,2762Z" />
            </g>
            <g transform="matrix(1.001672,-0,0,-1.045713,-20.80067,2635.592441)">
              <path d="M2616.612,1432.126L1411.491,1432.126L1470.437,1238L2558.473,1238L2616.612,1432.126Z" />
            </g>
            <g transform="matrix(1.449914,-0,0,-1.045713,-923.583631,3041.592441)">
              <path d="M2616.612,1432.126L1411.491,1432.126L1470.437,1238L2558.473,1238L2616.612,1432.126Z" />
            </g>
            <g transform="matrix(2.098742,0,-0,-1.045713,-2230.356453,3447.592441)">
              <path d="M2616.612,1432.126L1411.491,1432.126L1445.219,1238L2575.084,1238L2616.612,1432.126Z" />
            </g>
            <g transform="matrix(1.449914,-0,0,-1.045713,-923.583631,3853.592441)">
              <path d="M2616.612,1432.126L1411.491,1432.126L1470.437,1238L2558.473,1238L2616.612,1432.126Z" />
            </g>
          </g>
        </svg>
      </div>
      {/* Glow ring, same as app */}
      <div className="absolute -inset-0.5 rounded-xl bg-gradient-to-br from-primary/30 to-transparent blur-sm -z-10" />
    </div>
  );
}
