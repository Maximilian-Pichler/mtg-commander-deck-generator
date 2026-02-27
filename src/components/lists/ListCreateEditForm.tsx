import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { searchCards, getCardImageUrl } from '@/services/scryfall/client';
import { CollectionImporter } from '@/components/collection/CollectionImporter';
import type { ScryfallCard, UserCardList } from '@/types';
import { Search, Loader2, X, Plus, ArrowLeft, Trash2 } from 'lucide-react';

interface ListCreateEditFormProps {
  existingList?: UserCardList | null;
  onSave: (name: string, cards: string[], description: string) => void;
  onCancel: () => void;
}

export function ListCreateEditForm({ existingList, onSave, onCancel }: ListCreateEditFormProps) {
  const [name, setName] = useState(existingList?.name ?? '');
  const [description, setDescription] = useState(existingList?.description ?? '');
  const [cards, setCards] = useState<string[]>(existingList?.cards ?? []);

  // Search state
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ScryfallCard[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [searchedQuery, setSearchedQuery] = useState('');

  const nameInputRef = useRef<HTMLInputElement>(null);
  const searchWrapperRef = useRef<HTMLDivElement>(null);
  const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number; width: number } | null>(null);

  const isEditing = !!existingList;

  // Auto-focus name field on create
  useEffect(() => {
    if (!isEditing) {
      nameInputRef.current?.focus();
    }
  }, [isEditing]);

  const updateDropdownPos = useCallback(() => {
    if (searchWrapperRef.current) {
      const rect = searchWrapperRef.current.getBoundingClientRect();
      setDropdownPos({ top: rect.bottom + 4, left: rect.left, width: rect.width });
    }
  }, []);

  // Debounced search
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setSearchedQuery('');
      return;
    }
    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const searchResults = await searchCards(query, [], { order: 'edhrec' });
        const filtered = searchResults.data.filter(card => !cards.includes(card.name));
        setResults(filtered.slice(0, 8));
        setSearchedQuery(query);
        updateDropdownPos();
        setShowResults(true);
      } catch {
        setResults([]);
        setSearchedQuery(query);
      } finally {
        setIsSearching(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query, cards, updateDropdownPos]);

  const handleAddCard = (card: ScryfallCard) => {
    if (!cards.includes(card.name)) {
      setCards(prev => [...prev, card.name]);
    }
    setQuery('');
    setResults([]);
    setShowResults(false);
  };

  const handleRemoveCard = (cardName: string) => {
    setCards(prev => prev.filter(n => n !== cardName));
  };

  // Use a ref to always have the latest cards for the import callback
  const cardsRef = useRef(cards);
  cardsRef.current = cards;

  const handleImportCards = useCallback((validatedNames: string[]) => {
    const current = cardsRef.current;
    const newCards: string[] = [];
    let dupeCount = 0;

    for (const cardName of validatedNames) {
      if (current.includes(cardName) || newCards.includes(cardName)) {
        dupeCount++;
      } else {
        newCards.push(cardName);
      }
    }

    if (newCards.length > 0) {
      setCards(prev => [...prev, ...newCards]);
    }

    return { added: newCards.length, updated: dupeCount };
  }, []);

  const handleClearAll = () => {
    setCards([]);
  };

  const handleSave = () => {
    if (!name.trim() || cards.length === 0) return;
    onSave(name.trim(), cards, description.trim());
  };

  // No results: searched but got 0 results and not currently searching
  const showNoResults = showResults && results.length === 0 && searchedQuery.trim() && !isSearching;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <button
          onClick={onCancel}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          {isEditing ? 'Back to list' : 'Back to lists'}
        </button>
        <h2 className="text-xl font-bold">{isEditing ? 'Edit List' : 'Create New List'}</h2>
      </div>

      {/* Name & Description */}
      <div className="space-y-3">
        <div>
          <label className="text-sm font-medium mb-1.5 block">Name</label>
          <Input
            ref={nameInputRef}
            type="text"
            placeholder="e.g. My Salt List, Staples, Pet Cards..."
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="h-10"
          />
        </div>
        <div>
          <label className="text-sm font-medium mb-1.5 block">Description <span className="text-muted-foreground font-normal">(optional)</span></label>
          <Input
            type="text"
            placeholder="What is this list for?"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="h-10"
          />
        </div>
      </div>

      {/* Import Cards — shared component */}
      <CollectionImporter
        label="Import Cards"
        onImportCards={handleImportCards}
        updatedLabel="duplicates skipped"
      />

      {/* Cards */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium">Cards ({cards.length})</label>
          {cards.length > 0 && (
            <button
              onClick={handleClearAll}
              className="p-1 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
              title="Clear all cards"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Search input */}
        <div className="relative" ref={searchWrapperRef}>
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search cards to add..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => { updateDropdownPos(); (results.length > 0 || showNoResults) && setShowResults(true); }}
            className="pl-9 pr-9 h-9 text-sm"
          />
          {isSearching && (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-primary" />
          )}

          {/* Search Results Dropdown */}
          {showResults && results.length > 0 && dropdownPos && createPortal(
            <>
              <div className="fixed inset-0 z-[998]" onClick={() => setShowResults(false)} />
              <Card
                className="fixed z-[999] max-h-[250px] overflow-auto shadow-xl"
                style={{ top: dropdownPos.top, left: dropdownPos.left, width: dropdownPos.width }}
              >
                <CardContent className="p-1">
                  {results.map((card) => (
                    <button
                      key={card.id}
                      onClick={() => handleAddCard(card)}
                      className="w-full flex items-center gap-3 p-2 hover:bg-accent/50 rounded-md text-left transition-colors group"
                    >
                      <img
                        src={getCardImageUrl(card, 'small')}
                        alt={card.name}
                        className="w-8 h-auto rounded shadow"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">
                          {card.name}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {card.type_line}
                        </p>
                      </div>
                      <Plus className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                    </button>
                  ))}
                </CardContent>
              </Card>
            </>,
            document.body
          )}

          {/* No results state */}
          {showNoResults && dropdownPos && createPortal(
            <>
              <div className="fixed inset-0 z-[998]" onClick={() => setShowResults(false)} />
              <Card
                className="fixed z-[999] shadow-xl"
                style={{ top: dropdownPos.top, left: dropdownPos.left, width: dropdownPos.width }}
              >
                <CardContent className="p-4 text-center">
                  <p className="text-sm text-muted-foreground">No cards found for "{searchedQuery}"</p>
                </CardContent>
              </Card>
            </>,
            document.body
          )}
        </div>

        {/* Current cards as chips */}
        {cards.length > 0 && (
          <div className="flex flex-wrap gap-1.5 max-h-60 overflow-auto p-2 bg-accent/20 rounded-lg border border-border/30">
            {cards.map(name => (
              <span
                key={name}
                className="inline-flex items-center gap-1 px-2 py-1 bg-accent/50 text-foreground text-xs rounded-md border border-border/30"
              >
                <span className="truncate max-w-[180px]">{name}</span>
                <button
                  onClick={() => handleRemoveCard(name)}
                  className="hover:bg-destructive/20 rounded p-0.5 transition-colors text-muted-foreground hover:text-destructive"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        )}

        {cards.length === 0 && (
          <p className="text-xs text-muted-foreground py-4 text-center">
            Search for cards above or import a list to get started
          </p>
        )}
      </div>

      {/* Actions — sticky at bottom */}
      <div className="flex justify-end gap-3 pt-2 border-t border-border/50 sticky bottom-0 bg-background pb-4 -mb-4">
        <button
          onClick={onCancel}
          className="px-4 py-2 text-sm rounded-lg hover:bg-accent transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={!name.trim() || cards.length === 0}
          className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isEditing ? 'Save Changes' : 'Create List'}
        </button>
      </div>
    </div>
  );
}
