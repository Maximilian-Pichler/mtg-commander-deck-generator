import { useState, useMemo, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUserLists } from '@/hooks/useUserLists';
import { getCardsByNames } from '@/services/scryfall/client';
import { ListCard } from '@/components/lists/ListCard';
import { ListDetailView } from '@/components/lists/ListDetailView';
import { ListCreateEditForm } from '@/components/lists/ListCreateEditForm';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { ArrowLeft, Plus, Search, X, Grid3X3, List, BookOpen } from 'lucide-react';
import { trackEvent } from '@/services/analytics';

const TYPES = ['Battle', 'Creature', 'Instant', 'Sorcery', 'Artifact', 'Enchantment', 'Planeswalker', 'Land'];

type ViewState =
  | { view: 'browse' }
  | { view: 'detail'; listId: string }
  | { view: 'create' }
  | { view: 'edit'; listId: string };

type SortKey = 'updatedAt' | 'name' | 'size';
type SortDir = 'asc' | 'desc';

export function ListsPage() {
  const navigate = useNavigate();
  const { lists, createList, updateList, deleteList, duplicateList, exportList } = useUserLists();

  const [viewState, setViewState] = useState<ViewState>({ view: 'browse' });
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [sortKey, setSortKey] = useState<SortKey>('updatedAt');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedCount, setCopiedCount] = useState<number | null>(null);

  // Fetch card types + color identity for all cards across all lists (single bulk fetch, cached)
  const [cardTypeMap, setCardTypeMap] = useState<Record<string, string>>({});
  const [cardColorMap, setCardColorMap] = useState<Record<string, string[]>>({});
  const fetchedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const allNames = [...new Set(lists.flatMap(l => l.cards))];
    const missing = allNames.filter(n => !fetchedRef.current.has(n));
    if (missing.length === 0) return;

    missing.forEach(n => fetchedRef.current.add(n));
    getCardsByNames(missing).then(cardMap => {
      const typeUpdates: Record<string, string> = {};
      const colorUpdates: Record<string, string[]> = {};
      for (const [name, card] of cardMap) {
        const typeLine = card.type_line?.toLowerCase() ?? '';
        typeUpdates[name] = TYPES.find(t => typeLine.includes(t.toLowerCase())) ?? 'Other';
        colorUpdates[name] = card.color_identity ?? [];
      }
      for (const name of missing) {
        if (!typeUpdates[name]) typeUpdates[name] = 'Other';
        if (!colorUpdates[name]) colorUpdates[name] = [];
      }
      setCardTypeMap(prev => ({ ...prev, ...typeUpdates }));
      setCardColorMap(prev => ({ ...prev, ...colorUpdates }));
    }).catch(() => {});
  }, [lists]);

  // Compute type breakdown + color identity per list
  const WUBRG = ['W', 'U', 'B', 'R', 'G'];

  const typeBreakdowns = useMemo(() => {
    const map: Record<string, Record<string, number>> = {};
    for (const list of lists) {
      const breakdown: Record<string, number> = {};
      for (const card of list.cards) {
        const type = cardTypeMap[card];
        if (type) {
          breakdown[type] = (breakdown[type] ?? 0) + 1;
        }
      }
      map[list.id] = breakdown;
    }
    return map;
  }, [lists, cardTypeMap]);

  const listColorIdentities = useMemo(() => {
    const map: Record<string, string[]> = {};
    for (const list of lists) {
      const colors = new Set<string>();
      for (const card of list.cards) {
        const ci = cardColorMap[card];
        if (ci) ci.forEach(c => colors.add(c));
      }
      map[list.id] = WUBRG.filter(c => colors.has(c));
    }
    return map;
  }, [lists, cardColorMap]);

  const filteredAndSortedLists = useMemo(() => {
    let filtered = lists;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = lists.filter(l =>
        l.name.toLowerCase().includes(q) ||
        l.description.toLowerCase().includes(q) ||
        l.cards.some(c => c.toLowerCase().includes(q))
      );
    }
    return [...filtered].sort((a, b) => {
      let cmp = 0;
      if (sortKey === 'name') cmp = a.name.localeCompare(b.name);
      else if (sortKey === 'size') cmp = a.cards.length - b.cards.length;
      else cmp = a.updatedAt - b.updatedAt;
      return sortDir === 'desc' ? -cmp : cmp;
    });
  }, [lists, searchQuery, sortKey, sortDir]);

  const handleExport = (listId: string) => {
    const list = lists.find(l => l.id === listId);
    const text = exportList(listId);
    if (text) {
      const count = text.split('\n').filter(l => l.trim()).length;
      navigator.clipboard.writeText(text).then(() => {
        setCopiedCount(count);
        setTimeout(() => setCopiedCount(null), 2000);
      });
      if (list) trackEvent('list_exported', { listName: list.name, cardCount: count });
    }
  };

  const handleDelete = (listId: string) => {
    const list = lists.find(l => l.id === listId);
    if (list) trackEvent('list_deleted', { listName: list.name, cardCount: list.cards.length });
    deleteList(listId);
    if (viewState.view === 'detail' && viewState.listId === listId) {
      setViewState({ view: 'browse' });
    }
  };

  const handleRemoveCard = (listId: string, cardName: string) => {
    const list = lists.find(l => l.id === listId);
    if (list) {
      updateList(listId, { cards: list.cards.filter(c => c !== cardName) });
    }
  };

  // Global toasts (rendered in all views)
  const toasts = (
    <>
      {copiedCount !== null && (
        <div className="fixed bottom-6 right-6 z-50 px-4 py-2 bg-emerald-500/90 text-white text-sm rounded-lg shadow-lg animate-fade-in">
          Copied {copiedCount} cards to clipboard!
        </div>
      )}
    </>
  );

  // Detail view
  if (viewState.view === 'detail') {
    const list = lists.find(l => l.id === viewState.listId);
    if (!list) {
      setViewState({ view: 'browse' });
      return null;
    }
    return (
      <main className="flex-1 container mx-auto px-4 py-8 max-w-5xl">
        <div className="aurora-bg" />
        {toasts}
        <ListDetailView
          list={list}
          onBack={() => setViewState({ view: 'browse' })}
          onEdit={() => setViewState({ view: 'edit', listId: list.id })}
          onDuplicate={() => { duplicateList(list.id); setViewState({ view: 'browse' }); }}
          onExport={() => handleExport(list.id)}
          onDelete={() => handleDelete(list.id)}
          onRemoveCard={(name) => handleRemoveCard(list.id, name)}
        />
      </main>
    );
  }

  // Create view
  if (viewState.view === 'create') {
    return (
      <main className="flex-1 container mx-auto px-4 py-8 max-w-3xl">
        <div className="aurora-bg" />
        <ListCreateEditForm
          onSave={(name, cards, description) => {
            const newList = createList(name, cards, description);
            trackEvent('list_created', { listName: name, cardCount: cards.length });
            setViewState({ view: 'detail', listId: newList.id });
          }}
          onCancel={() => setViewState({ view: 'browse' })}
        />
      </main>
    );
  }

  // Edit view
  if (viewState.view === 'edit') {
    const list = lists.find(l => l.id === viewState.listId);
    if (!list) {
      setViewState({ view: 'browse' });
      return null;
    }
    return (
      <main className="flex-1 container mx-auto px-4 py-8 max-w-3xl">
        <div className="aurora-bg" />
        <ListCreateEditForm
          existingList={list}
          onSave={(name, cards, description) => {
            updateList(list.id, { name, cards, description });
            setViewState({ view: 'detail', listId: list.id });
          }}
          onCancel={() => setViewState({ view: 'detail', listId: list.id })}
        />
      </main>
    );
  }

  // Browse view
  return (
    <main className="flex-1 container mx-auto px-4 py-8 max-w-5xl">
      <div className="aurora-bg" />
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Back
      </button>

      <div className="flex items-start justify-between mb-8">
        <div className="space-y-2">
          <h2 className="text-2xl font-bold">My Lists</h2>
          <p className="text-sm text-muted-foreground">
            Save reusable card lists to quickly apply as exclusions or must-includes when building decks.
          </p>
        </div>
        <button
          onClick={() => setViewState({ view: 'create' })}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-sm rounded-lg hover:bg-primary/90 transition-colors shrink-0"
        >
          <Plus className="w-4 h-4" />
          New List
        </button>
      </div>

      {/* Toolbar */}
      {lists.length > 0 && (
        <div className="flex items-center gap-3 mb-6">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search lists or cards..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-8 h-9 text-sm"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <Select
            value={`${sortKey}-${sortDir}`}
            onChange={(e) => {
              const [key, dir] = e.target.value.split('-') as [SortKey, SortDir];
              setSortKey(key);
              setSortDir(dir);
            }}
            className="h-9 text-sm w-44"
            options={[
              { value: 'updatedAt-desc', label: 'Newest first' },
              { value: 'updatedAt-asc', label: 'Oldest first' },
              { value: 'name-asc', label: 'Name A-Z' },
              { value: 'name-desc', label: 'Name Z-A' },
              { value: 'size-desc', label: 'Most cards' },
              { value: 'size-asc', label: 'Fewest cards' },
            ]}
          />
          <div className="flex items-center gap-1 border border-border/50 rounded-lg p-0.5">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded transition-colors ${viewMode === 'grid' ? 'bg-accent text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
              title="Grid view"
            >
              <Grid3X3 className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded transition-colors ${viewMode === 'list' ? 'bg-accent text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
              title="List view"
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {toasts}

      {/* Lists grid/list */}
      {filteredAndSortedLists.length > 0 ? (
        viewMode === 'grid' ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredAndSortedLists.map(list => (
              <ListCard
                key={list.id}
                list={list}
                viewMode="grid"
                typeBreakdown={typeBreakdowns[list.id]}
                colorIdentity={listColorIdentities[list.id]}
                onClick={() => setViewState({ view: 'detail', listId: list.id })}
                onEdit={() => setViewState({ view: 'edit', listId: list.id })}
                onDuplicate={() => duplicateList(list.id)}
                onExport={() => handleExport(list.id)}
                onDelete={() => handleDelete(list.id)}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-border/50 bg-card/50 backdrop-blur-sm divide-y divide-border/30">
            {filteredAndSortedLists.map(list => (
              <ListCard
                key={list.id}
                list={list}
                viewMode="list"
                typeBreakdown={typeBreakdowns[list.id]}
                colorIdentity={listColorIdentities[list.id]}
                onClick={() => setViewState({ view: 'detail', listId: list.id })}
                onEdit={() => setViewState({ view: 'edit', listId: list.id })}
                onDuplicate={() => duplicateList(list.id)}
                onExport={() => handleExport(list.id)}
                onDelete={() => handleDelete(list.id)}
              />
            ))}
          </div>
        )
      ) : lists.length > 0 ? (
        <div className="text-center py-12">
          <p className="text-sm text-muted-foreground">No lists match your search</p>
        </div>
      ) : (
        <div className="text-center py-16 space-y-4">
          <BookOpen className="w-12 h-12 text-muted-foreground/30 mx-auto" />
          <div className="space-y-2">
            <p className="text-lg font-medium text-muted-foreground">No lists yet</p>
            <p className="text-sm text-muted-foreground/80">
              Create your first list to save cards you want to quickly exclude or include in decks.
            </p>
          </div>
          <button
            onClick={() => setViewState({ view: 'create' })}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-sm rounded-lg hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Create your first list
          </button>
        </div>
      )}
    </main>
  );
}
