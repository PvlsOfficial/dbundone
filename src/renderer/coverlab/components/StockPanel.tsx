import React, { useCallback, useState } from "react"
import { Search, Loader2, Shuffle, Plus, ImageOff } from "lucide-react"
import {
  Button,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui"
import { cn } from "@/lib/utils"
import type { StockResult } from "@/lib/tauriApi"

const isElectron = () => typeof window !== "undefined" && typeof window.electron !== "undefined"

interface StockPanelProps {
  /** Add a chosen image/GIF (as a data URL) to the document as a new layer. */
  onAdd: (src: string, name: string) => void
  onError?: (message: string) => void
}

type Provider = "wikimedia" | "flickr" | "picsum"

const PROVIDERS: { value: Provider; label: string; hint: string; searchable: boolean; gifs: boolean }[] = [
  { value: "wikimedia", label: "Wikimedia Commons", hint: "Search free photos & GIFs", searchable: true, gifs: true },
  { value: "flickr", label: "Flickr (Creative Commons)", hint: "Keyword photos", searchable: true, gifs: false },
  { value: "picsum", label: "Lorem Picsum", hint: "Random photos", searchable: false, gifs: false },
]

export const StockPanel: React.FC<StockPanelProps> = ({ onAdd, onError }) => {
  const [provider, setProvider] = useState<Provider>("wikimedia")
  const [kind, setKind] = useState<"photo" | "gif">("photo")
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<StockResult[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [adding, setAdding] = useState<string | null>(null)

  const meta = PROVIDERS.find((p) => p.value === provider)!

  const run = useCallback(
    async (p: number) => {
      if (!isElectron()) {
        setError("Stock search is only available in the desktop app")
        return
      }
      setLoading(true)
      setError(null)
      try {
        const effectiveKind = meta.gifs ? kind : "photo"
        const res = await window.electron!.stockSearch(query.trim(), effectiveKind, provider, p)
        setResults(res)
        setPage(p)
        if (res.length === 0) setError("No results.")
      } catch (e) {
        setError(String(e instanceof Error ? e.message : e))
        setResults([])
      } finally {
        setLoading(false)
      }
    },
    [query, kind, provider, meta.gifs]
  )

  const handleAdd = useCallback(
    async (item: StockResult) => {
      if (!isElectron()) return
      setAdding(item.id)
      try {
        const dataUrl = await window.electron!.stockFetchDataUrl(item.url)
        onAdd(dataUrl, item.title?.slice(0, 32) || item.source)
      } catch (e) {
        const msg = String(e instanceof Error ? e.message : e)
        setError(msg)
        onError?.(msg)
      } finally {
        setAdding(null)
      }
    },
    [onAdd, onError]
  )

  const onProviderChange = (value: string) => {
    const next = value as Provider
    setProvider(next)
    setResults([])
    setError(null)
    if (!PROVIDERS.find((p) => p.value === next)!.gifs) setKind("photo")
  }

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 space-y-2 border-b border-border/30">
        <Select value={provider} onValueChange={onProviderChange}>
          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            {PROVIDERS.map((p) => (
              <SelectItem key={p.value} value={p.value}>
                {p.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {meta.searchable ? (
          <div className="flex gap-1.5">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") run(1) }}
                placeholder={kind === "gif" ? "Search GIFs…" : "Search photos…"}
                className="h-8 pl-7 text-sm"
              />
            </div>
            <Button size="sm" className="h-8" onClick={() => run(1)} disabled={loading}>
              {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Go"}
            </Button>
          </div>
        ) : (
          <Button size="sm" className="h-8 w-full gap-2" onClick={() => run(1)} disabled={loading}>
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Shuffle className="w-3.5 h-3.5" />}
            Shuffle photos
          </Button>
        )}

        {meta.gifs && (
          <div className="flex items-center bg-muted/40 rounded-md p-0.5">
            {(["photo", "gif"] as const).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setKind(k)}
                className={cn(
                  "flex-1 text-xs py-1 rounded transition-colors",
                  kind === k ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {k === "photo" ? "Photos" : "GIFs"}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {error && (
          <div className="flex flex-col items-center gap-1 text-center text-muted-foreground py-6">
            <ImageOff className="w-6 h-6 opacity-50" />
            <p className="text-xs">{error}</p>
          </div>
        )}
        <div className="grid grid-cols-2 gap-2">
          {results.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => handleAdd(item)}
              title={`${item.title} · ${item.source}`}
              className="relative group rounded-md overflow-hidden border border-border/40 aspect-square"
            >
              <img src={item.thumbnail} alt={item.title} loading="lazy" className="w-full h-full object-cover" />
              <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity">
                {adding === item.id ? (
                  <Loader2 className="w-5 h-5 text-white animate-spin" />
                ) : (
                  <span className="flex items-center gap-1 text-xs text-white font-medium">
                    <Plus className="w-3.5 h-3.5" /> Add
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>

        {results.length > 0 && (
          <Button variant="ghost" size="sm" className="w-full mt-3 text-xs" onClick={() => run(page + 1)} disabled={loading}>
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : meta.searchable ? "More results" : "Shuffle more"}
          </Button>
        )}
      </div>
    </div>
  )
}
