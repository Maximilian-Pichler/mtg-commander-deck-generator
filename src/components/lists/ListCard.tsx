import type { UserCardList } from '@/types';
import { CardTypeIcon } from '@/components/ui/mtg-icons';
import { MoreHorizontal, Copy, Download, Trash2, Pencil } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';

interface ListCardProps {
  list: UserCardList;
  viewMode: 'grid' | 'list';
  typeBreakdown?: Record<string, number>;
  colorIdentity?: string[];
  onClick: () => void;
  onEdit: () => void;
  onDuplicate: () => void;
  onExport: () => void;
  onDelete: () => void;
}

function formatRelativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

export function ListCard({ list, viewMode, typeBreakdown, colorIdentity, onClick, onEdit, onDuplicate, onExport, onDelete }: ListCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuOpen]);

  const previewCards = list.cards.slice(0, 4);
  const remainingCount = list.cards.length - previewCards.length;

  if (viewMode === 'list') {
    return (
      <button
        onClick={onClick}
        className="w-full flex items-center gap-4 px-4 py-3 hover:bg-accent/30 rounded-lg transition-colors text-left group"
      >
        <div className="flex-1 min-w-0 flex items-center gap-2">
          <span className="text-sm font-medium group-hover:text-primary transition-colors">{list.name}</span>
          {colorIdentity && (
            <span className="inline-flex items-center gap-0.5 shrink-0">
              {colorIdentity.length > 0
                ? colorIdentity.map(c => (
                    <i key={c} className={`ms ms-${c.toLowerCase()} ms-cost text-xs`} />
                  ))
                : <i className="ms ms-c ms-cost text-xs" />
              }
            </span>
          )}
          {list.description && (
            <span className="text-xs text-muted-foreground truncate">{list.description}</span>
          )}
        </div>
        {typeBreakdown && Object.keys(typeBreakdown).length > 0 ? (
          <div className="flex items-center gap-1 shrink-0">
            {Object.entries(typeBreakdown)
              .sort((a, b) => b[1] - a[1])
              .map(([type, count]) => (
                <span
                  key={type}
                  className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground/70"
                  title={type}
                >
                  <CardTypeIcon type={type} size="sm" className="opacity-50 text-[10px]" />
                  {count}
                </span>
              ))}
          </div>
        ) : (
          <span className="text-xs text-muted-foreground whitespace-nowrap">{list.cards.length} cards</span>
        )}
        <span className="text-xs text-muted-foreground/60 whitespace-nowrap w-16 text-right">{formatRelativeTime(list.updatedAt)}</span>
        <div className="relative" ref={menuRef}>
          <button
            onClick={(e) => { e.stopPropagation(); setMenuOpen(!menuOpen); }}
            className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
          >
            <MoreHorizontal className="w-4 h-4" />
          </button>
          {menuOpen && <DropdownMenu onEdit={onEdit} onDuplicate={onDuplicate} onExport={onExport} onDelete={onDelete} onClose={() => setMenuOpen(false)} />}
        </div>
      </button>
    );
  }

  return (
    <div
      className="rounded-xl border border-border/50 bg-card/50 backdrop-blur-sm p-4 hover:border-border transition-colors cursor-pointer group relative"
      onClick={onClick}
    >
      <div className="flex items-start justify-between mb-2">
        <h3 className="text-sm font-medium group-hover:text-primary transition-colors truncate pr-2">{list.name}</h3>
        <div className="relative" ref={menuRef}>
          <button
            onClick={(e) => { e.stopPropagation(); setMenuOpen(!menuOpen); }}
            className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors shrink-0"
          >
            <MoreHorizontal className="w-4 h-4" />
          </button>
          {menuOpen && <DropdownMenu onEdit={onEdit} onDuplicate={onDuplicate} onExport={onExport} onDelete={onDelete} onClose={() => setMenuOpen(false)} />}
        </div>
      </div>

      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
        <span>{list.cards.length} cards</span>
        <span className="text-border">·</span>
        <span>{formatRelativeTime(list.updatedAt)}</span>
        {colorIdentity && colorIdentity.length > 0 && (
          <>
            <span className="text-border">·</span>
            <span className="inline-flex items-center gap-0.5">
              {colorIdentity.map(c => (
                <i key={c} className={`ms ms-${c.toLowerCase()} ms-cost text-xs`} />
              ))}
            </span>
          </>
        )}
        {colorIdentity && colorIdentity.length === 0 && (
          <>
            <span className="text-border">·</span>
            <i className="ms ms-c ms-cost text-xs" />
          </>
        )}
      </div>

      {list.description && (
        <p className="text-xs text-muted-foreground/80 mb-3 line-clamp-2">{list.description}</p>
      )}

      {typeBreakdown && Object.keys(typeBreakdown).length > 0 ? (
        <div className="flex flex-wrap gap-1">
          {Object.entries(typeBreakdown)
            .sort((a, b) => b[1] - a[1])
            .map(([type, count]) => (
              <span
                key={type}
                className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] bg-accent/50 text-muted-foreground rounded border border-border/30"
              >
                <CardTypeIcon type={type} size="sm" className="opacity-60 text-[10px]" />
                {count}
              </span>
            ))}
        </div>
      ) : (
        <div className="flex flex-wrap gap-1">
          {previewCards.map(name => (
            <span key={name} className="px-1.5 py-0.5 text-[10px] bg-accent/50 text-muted-foreground rounded border border-border/30 truncate max-w-[120px]">
              {name}
            </span>
          ))}
          {remainingCount > 0 && (
            <span className="px-1.5 py-0.5 text-[10px] text-muted-foreground/60">
              +{remainingCount} more
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function DropdownMenu({ onEdit, onDuplicate, onExport, onDelete, onClose }: {
  onEdit: () => void;
  onDuplicate: () => void;
  onExport: () => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const handleAction = (action: () => void) => (e: React.MouseEvent) => {
    e.stopPropagation();
    action();
    onClose();
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirmingDelete) {
      onDelete();
      onClose();
    } else {
      setConfirmingDelete(true);
      setTimeout(() => setConfirmingDelete(false), 3000);
    }
  };

  return (
    <div className="absolute right-0 top-full mt-1 z-50 w-40 rounded-lg border border-border bg-card shadow-xl py-1 animate-fade-in">
      <button onClick={handleAction(onEdit)} className="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-accent transition-colors text-left">
        <Pencil className="w-3.5 h-3.5" /> Edit
      </button>
      <button onClick={handleAction(onDuplicate)} className="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-accent transition-colors text-left">
        <Copy className="w-3.5 h-3.5" /> Duplicate
      </button>
      <button onClick={handleAction(onExport)} className="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-accent transition-colors text-left">
        <Download className="w-3.5 h-3.5" /> Export to Clipboard
      </button>
      <div className="border-t border-border/50 my-1" />
      <button
        onClick={handleDeleteClick}
        className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs transition-colors text-left ${
          confirmingDelete
            ? 'bg-destructive/20 text-destructive font-medium'
            : 'hover:bg-destructive/10 text-destructive'
        }`}
      >
        <Trash2 className="w-3.5 h-3.5" /> {confirmingDelete ? 'Confirm Delete?' : 'Delete'}
      </button>
    </div>
  );
}
