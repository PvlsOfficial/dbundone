import React from 'react';
import { cn } from '@/lib/utils';

interface LogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

const sizeClasses = {
  sm: 'w-6 h-6',
  md: 'w-8 h-8',
  lg: 'w-12 h-12',
  xl: 'w-16 h-16',
};

export const Logo: React.FC<LogoProps> = ({ className, size = 'md' }) => {
  return (
    <svg
      viewBox="200 500 3600 3200"
      className={cn(sizeClasses[size], 'fill-current', className)}
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
  );
};

export default Logo;
