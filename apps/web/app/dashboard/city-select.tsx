"use client";

import { useEffect, useRef, useState } from "react";
import { MapPin, X, Check, Loader2 } from "lucide-react";

export type LocationOption = {
  id: string;
  name: string;
  province: string;
  displayLabel: string;
  laarCode: string | null;
  laarCityName: string | null;
  laarZone: string;
};

type CitySelectProps = {
  label: string;
  value: string;
  onChange: (cityName: string, location?: LocationOption) => void;
  required?: boolean;
  placeholder?: string;
  showBadges?: boolean;
  name?: string;
};

const ZONE_BADGE_CLASSES: Record<string, string> = {
  local: "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/60",
  principal: "bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800/60",
  secundario: "bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-800/60",
  especial: "bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800/60",
  oriente: "bg-pink-50 dark:bg-pink-950/60 text-pink-600 dark:text-pink-400 border-pink-200 dark:border-pink-800/60",
};

export function CitySelect({
  label,
  value,
  onChange,
  required = true,
  placeholder = "Escribe una ciudad (ej. Quito, Ambato, Guayaquil)...",
  showBadges = true,
  name,
}: CitySelectProps) {
  const [locations, setLocations] = useState<LocationOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState(value || "");
  const [selectedCity, setSelectedCity] = useState(value || "");
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync internal query with prop value
  useEffect(() => {
    setQuery(value || "");
    setSelectedCity(value || "");
  }, [value]);

  // Fetch 729 canonical locations from API
  useEffect(() => {
    let isMounted = true;
    async function fetchLocations() {
      try {
        const res = await fetch("/api/locations");
        if (res.ok) {
          const data = (await res.json()) as { locations: LocationOption[] };
          if (isMounted) {
            setLocations(data.locations || []);
          }
        }
      } catch (err) {
        console.error("Error al cargar catálogo de localidades:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    fetchLocations();
    return () => {
      isMounted = false;
    };
  }, []);

  // Close suggestions menu on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Filter suggestions
  const cleanQuery = query.trim().toLowerCase();
  const suggestions = locations
    .filter((loc) => {
      if (!cleanQuery) return true;
      return (
        loc.name.toLowerCase().includes(cleanQuery) ||
        loc.province.toLowerCase().includes(cleanQuery) ||
        loc.displayLabel.toLowerCase().includes(cleanQuery)
      );
    })
    .slice(0, 15);

  const handleSelect = (loc: LocationOption) => {
    setQuery(loc.name);
    setSelectedCity(loc.name);
    setIsOpen(false);
    onChange(loc.name, loc);
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    if (!containerRef.current?.contains(e.relatedTarget as Node)) {
      setIsOpen(false);

      const clean = query.trim().toLowerCase();
      if (!clean) {
        setSelectedCity("");
        onChange("", undefined);
        return;
      }

      // Check if typed text matches an official location in catalog
      const exactMatch = locations.find(
        (loc) =>
          loc.name.toLowerCase() === clean ||
          loc.displayLabel.toLowerCase() === clean
      );

      if (exactMatch) {
        handleSelect(exactMatch);
      } else if (suggestions.length > 0 && suggestions[0] && clean.length >= 2) {
        // Auto-select top suggestion if user typed a partial valid name
        handleSelect(suggestions[0]);
      } else {
        // Clear raw invalid input if not in coverage catalog
        setQuery("");
        setSelectedCity("");
        onChange("", undefined);
      }
    }
  };

  const handleClear = () => {
    setQuery("");
    setSelectedCity("");
    onChange("", undefined);
    setIsOpen(true);
    if (inputRef.current) inputRef.current.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        setIsOpen(true);
      }
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % Math.max(1, suggestions.length));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + suggestions.length) % Math.max(1, suggestions.length));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (suggestions[selectedIndex]) {
        handleSelect(suggestions[selectedIndex]);
      }
    } else if (e.key === "Escape") {
      setIsOpen(false);
    }
  };

  const isValidCitySelected = Boolean(selectedCity && locations.some((l) => l.name === selectedCity));

  return (
    <div className="relative w-full mb-3" ref={containerRef}>
      <label className="text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1.5 flex items-center gap-1.5">
        <span>{label}</span>
        {required && <span className="text-red-500">*</span>}
      </label>

      <div className="relative flex items-center w-full">
        <MapPin className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none ${isValidCitySelected ? "text-emerald-500" : "text-slate-400 dark:text-slate-500"}`} />
        
        <input
          ref={inputRef}
          type="text"
          value={query}
          placeholder={loading ? "Cargando 729 ciudades..." : placeholder}
          onFocus={() => setIsOpen(true)}
          onBlur={handleBlur}
          onChange={(e) => {
            const val = e.target.value;
            setQuery(val);
            setIsOpen(true);
            setSelectedIndex(0);

            const clean = val.trim().toLowerCase();
            const exact = locations.find(
              (loc) => loc.name.toLowerCase() === clean || loc.displayLabel.toLowerCase() === clean
            );
            if (exact) {
              setSelectedCity(exact.name);
              onChange(exact.name, exact);
            } else if (!val) {
              setSelectedCity("");
              onChange("", undefined);
            }
          }}
          onKeyDown={handleKeyDown}
          autoComplete="off"
          style={{ paddingLeft: "2.75rem" }}
          className={`w-full pl-11 pr-9 py-2 text-sm bg-slate-50 dark:bg-slate-900/80 border rounded-lg text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 transition-all duration-150 shadow-sm ${
            isValidCitySelected
              ? "border-emerald-500/60 focus:ring-emerald-500/20 focus:border-emerald-500"
              : query && !isOpen
              ? "border-amber-500/60 focus:ring-amber-500/20 focus:border-amber-500"
              : "border-slate-200 dark:border-slate-800 focus:ring-red-500/20 focus:border-red-500"
          }`}
        />

        {loading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 animate-spin" />
        )}

        {!loading && query && (
          <button
            type="button"
            className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors"
            onClick={handleClear}
            title="Limpiar búsqueda"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Verified / Warning Indicators */}
      {isValidCitySelected ? (
        <div className="mt-1 flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">
          <Check className="w-3.5 h-3.5" />
          <span>Ciudad de cobertura oficial seleccionada ({selectedCity})</span>
        </div>
      ) : query.trim().length >= 2 && !isOpen ? (
        <div className="mt-1 flex items-center gap-1 text-[11px] text-amber-600 dark:text-amber-400 font-medium">
          <span>⚠️ Selecciona una opción del listado para validar la cobertura.</span>
        </div>
      ) : null}

      {/* Dropdown Suggestions List (shadcn style) */}
      {isOpen && (
        <div className="absolute top-[calc(100%+6px)] left-0 right-0 max-h-64 overflow-y-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl z-50 p-1.5 space-y-1 scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-slate-700">
          {loading ? (
            <div className="flex items-center justify-center gap-2 p-4 text-xs text-slate-500 dark:text-slate-400">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>Cargando catálogo de 729 ciudades LAAR...</span>
            </div>
          ) : suggestions.length === 0 ? (
            <div className="p-3 text-center text-xs text-slate-500 dark:text-slate-400">
              No se encontraron ciudades para &quot;{query}&quot;
            </div>
          ) : (
            suggestions.map((loc, idx) => {
              const isSelected = query.trim().toLowerCase() === loc.name.toLowerCase();
              const isHighlighted = idx === selectedIndex;
              const badgeClass = ZONE_BADGE_CLASSES[loc.laarZone?.toLowerCase()] || ZONE_BADGE_CLASSES.principal;

              return (
                <div
                  key={loc.id}
                  role="option"
                  aria-selected={isHighlighted}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-left text-sm cursor-pointer transition-colors duration-150 ${
                    isHighlighted || isSelected
                      ? "bg-slate-100 dark:bg-slate-800/90 text-slate-900 dark:text-white"
                      : "text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                  }`}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    handleSelect(loc);
                  }}
                  onMouseEnter={() => setSelectedIndex(idx)}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <MapPin className={`w-3.5 h-3.5 flex-shrink-0 ${isSelected ? "text-red-500" : "text-slate-400 dark:text-slate-500"}`} />
                    <div className="min-w-0">
                      <div className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                        {loc.name}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                        Provincia de {loc.province}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                    {showBadges && loc.laarZone && (
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold tracking-wide uppercase border ${badgeClass}`}>
                        {loc.laarZone}
                      </span>
                    )}
                    {isSelected && <Check className="w-4 h-4 text-red-500" />}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {name && <input type="hidden" name={name} value={query} />}
    </div>
  );
}
