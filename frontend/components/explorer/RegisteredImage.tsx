"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { imageFit, type Hit, type Overlay } from "@/lib/catalogues";

export default function RegisteredImage({
  width,
  height,
  zoom,
  pan,
  frameId,
  overlays,
  onSelect,
  children,
}: {
  width: number;
  height: number;
  zoom: number;
  pan: { x: number; y: number };
  frameId: string;
  overlays: Overlay[];
  onSelect: (hit: Hit) => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const resize = new ResizeObserver(([entry]) =>
      setSize(
        imageFit(
          entry.contentRect.width,
          entry.contentRect.height,
          width,
          height,
        ),
      ),
    );
    resize.observe(el);
    return () => resize.disconnect();
  }, [width, height]);
  return (
    <div className="registered-port" ref={ref}>
      <div
        className="registered-image"
        style={{
          width: size.width,
          height: size.height,
          transform: `translate(${pan.x}px,${pan.y}px) scale(${zoom})`,
        }}
      >
        {children}
        <div
          className="catalogue-markers"
          aria-label="Catalogue reference positions"
        >
          {overlays.flatMap((overlay) =>
            overlay.sources.map((source) => {
              const p = source.positions[frameId];
              if (!p) return null;
              return (
                <button
                  key={`${overlay.catalogue}-${source.source_id}`}
                  type="button"
                  className={`catalogue-marker ${overlay.catalogue}`}
                  aria-label={`${overlay.release} source ${source.source_id}`}
                  style={{
                    left: `${((p.x + 0.5) / width) * 100}%`,
                    top: `${((p.y + 0.5) / height) * 100}%`,
                    transform: `translate(-50%,-50%) scale(${1 / zoom})`,
                  }}
                  onKeyDown={(e) => e.stopPropagation()}
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelect({ overlay, source, frameId });
                  }}
                >
                  <span />
                </button>
              );
            }),
          )}
        </div>
      </div>
    </div>
  );
}
