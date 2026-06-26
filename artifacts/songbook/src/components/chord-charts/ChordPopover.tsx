import { useState, type CSSProperties, type ReactNode } from "react";
import {
  Popover,
  PopoverContent,
  PopoverAnchor,
} from "@/components/ui/popover";
import type { Instrument } from "@/store";
import ChordDiagram from "./ChordDiagram";

interface Props {
  symbol: string;
  instrument: Instrument;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}

export default function ChordPopover({
  symbol,
  instrument,
  className,
  style,
  children,
}: Props) {
  // Controlled open state: the trigger span drives it directly so the tap can
  // also stop propagation to the song frame (which would otherwise collapse the
  // sidebar). Outside-click and Escape close it via onOpenChange. We anchor
  // rather than use PopoverTrigger so our own onClick fully owns the toggle.
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverAnchor asChild>
        <span
          role="button"
          tabIndex={0}
          className={className}
          style={style}
          onClick={(e) => {
            e.stopPropagation();
            setOpen(true);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setOpen((o) => !o);
            }
          }}
        >
          {children}
        </span>
      </PopoverAnchor>
      <PopoverContent
        side="bottom"
        align="center"
        sideOffset={6}
        collisionPadding={12}
        className="w-auto p-3"
        // Keep the page from scrolling/jumping to the portaled content on open.
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <div className="flex flex-col items-center gap-2">
          <span className="text-sm font-bold text-primary">{symbol}</span>
          <ChordDiagram symbol={symbol} instrument={instrument} width={132} />
        </div>
      </PopoverContent>
    </Popover>
  );
}
