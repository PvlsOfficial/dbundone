declare module 'react-virtual-grid' {
  interface VirtualGridItem {
    index: number;
  }

  interface VirtualGridOptions {
    itemCount: number;
    overscan?: number;
    gap?: number;
    containerRef?: React.RefObject<HTMLElement>;
  }

  export function useVirtualGrid<T extends HTMLElement>(
    options: VirtualGridOptions
  ): {
    gridRef: React.RefObject<T>;
    visibleItems: VirtualGridItem[];
  };
}