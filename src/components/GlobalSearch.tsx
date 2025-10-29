import { useState, useEffect } from 'react';
import { Search, X, Clock, Loader2, ChevronRight } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useDebounce } from '@/hooks/useDebounce';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';

interface GlobalSearchProps {
  searchInArchived?: boolean;
}

interface SearchResult {
  id: string;
  name: string;
  status: string;
  current_enfoque: string;
  last_accessed_at: string;
  similarity: number;
}

/**
 * Componente de busca global
 * Busca em títulos e todas as conversas das demandas
 * Suporta busca separada em ativas e arquivadas
 */
export function GlobalSearch({ searchInArchived = false }: GlobalSearchProps) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  
  // Debounce de 300ms para evitar buscas excessivas
  const debouncedQuery = useDebounce(query, 300);
  
  // Executar busca quando query debounced muda
  useEffect(() => {
    if (debouncedQuery.trim().length >= 2) {
      performSearch(debouncedQuery);
    } else {
      setResults([]);
      setIsOpen(false);
    }
  }, [debouncedQuery, searchInArchived]);
  
  const performSearch = async (searchQuery: string) => {
    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');
      
      console.log(`[Search] Buscando "${searchQuery}" em ${searchInArchived ? 'arquivadas' : 'ativas'}`);
      
      const { data, error } = await supabase.rpc('search_projects', {
        search_query: searchQuery,
        user_id_param: user.id,
        search_archived: searchInArchived
      });
      
      if (error) throw error;
      
      console.log(`[Search] ${data?.length || 0} resultados encontrados`);
      
      setResults(data || []);
      setIsOpen(true);
      
    } catch (error) {
      console.error('[Search] Erro ao buscar:', error);
      setResults([]);
      setIsOpen(false);
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleSelect = async (id: string) => {
    console.log(`[Search] Abrindo projeto ${id}`);
    
    // Atualizar last_accessed_at antes de navegar
    await supabase
      .from('projects')
      .update({ last_accessed_at: new Date().toISOString() })
      .eq('id', id);
    
    navigate(`/agente-cenario/${id}`);
    
    // Limpar busca
    setQuery('');
    setResults([]);
    setIsOpen(false);
  };
  
  const handleClear = () => {
    setQuery('');
    setResults([]);
    setIsOpen(false);
  };
  
  // Fechar dropdown ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('[data-search-container]')) {
        setIsOpen(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  
  return (
    <div className="relative w-full" data-search-container>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground pointer-events-none" />
        <Input
          type="text"
          placeholder={
            searchInArchived 
              ? "Buscar em arquivadas... (ex: notebooks, SEMTI)" 
              : "Buscar demandas ativas... (ex: climatização, computadores)"
          }
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => query.length >= 2 && results.length > 0 && setIsOpen(true)}
          className="pl-10 pr-10 h-12 text-base shadow-sm"
        />
        {query && (
          <Button
            variant="ghost"
            size="sm"
            className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 p-0"
            onClick={handleClear}
            title="Limpar busca"
          >
            <X className="w-4 h-4" />
          </Button>
        )}
      </div>
      
      {/* Dropdown de resultados */}
      {isOpen && (
        <div className="absolute top-full mt-2 w-full bg-card rounded-lg shadow-xl border border-border max-h-96 overflow-y-auto z-50">
          {/* Loading */}
          {isLoading && (
            <div className="flex items-center justify-center gap-2 p-4 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              Buscando...
            </div>
          )}
          
          {/* Resultados encontrados */}
          {!isLoading && results.length > 0 && (
            <>
              <div className="p-2 border-b border-border text-xs text-muted-foreground font-medium">
                {results.length} resultado{results.length !== 1 ? 's' : ''} encontrado{results.length !== 1 ? 's' : ''}
              </div>
              
              {results.map((result) => (
                <button
                  key={result.id}
                  onClick={() => handleSelect(result.id)}
                  className="w-full p-3 hover:bg-muted transition-colors text-left border-b border-border last:border-0 group"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0 space-y-2">
                      <p className="text-sm font-medium text-foreground line-clamp-2 group-hover:text-primary transition-colors">
                        {result.name}
                      </p>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <Badge variant="secondary" className="text-xs">
                          {result.current_enfoque}
                        </Badge>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatDistanceToNow(new Date(result.last_accessed_at), { 
                            locale: ptBR, 
                            addSuffix: true 
                          })}
                        </span>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-all group-hover:translate-x-1 shrink-0" />
                  </div>
                </button>
              ))}
            </>
          )}
          
          {/* Nenhum resultado */}
          {!isLoading && query.length >= 2 && results.length === 0 && (
            <div className="p-6 text-center space-y-1">
              <p className="text-foreground text-sm font-medium">
                Nenhuma demanda encontrada
              </p>
              <p className="text-muted-foreground text-xs">
                Tente outras palavras-chave ou verifique a ortografia
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
