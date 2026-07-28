import React from "react"
import { motion } from "framer-motion"
import { Plus, Boxes, Trash2, FolderOpen, Music2, Calendar } from "lucide-react"
import { cn } from "@/lib/utils"
import { getAssetUrl, openFolder } from "../lib/tauriApi"
import type { SavedKit } from "@shared/types"

interface Props {
  kits: SavedKit[]
  onNew: () => void
  onOpen: (kit: SavedKit) => void
  onDelete: (id: string) => void
}

export const KitLibrary: React.FC<Props> = ({ kits, onNew, onOpen, onDelete }) => {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
      {/* New kit card */}
      <motion.button
        type="button"
        onClick={onNew}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        className="aspect-square rounded-2xl border-2 border-dashed border-border/50 hover:border-primary/60 hover:bg-primary/5 flex flex-col items-center justify-center gap-3 text-muted-foreground hover:text-primary transition-colors group"
      >
        <div className="w-14 h-14 rounded-2xl bg-muted/50 group-hover:bg-primary/10 flex items-center justify-center transition-colors">
          <Plus className="w-7 h-7" />
        </div>
        <span className="text-sm font-medium">New Drum Kit</span>
      </motion.button>

      {kits.map((kit) => (
        <motion.div
          key={kit.id}
          layout
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="group relative aspect-square rounded-2xl overflow-hidden border border-border/40 bg-card cursor-pointer"
          onClick={() => onOpen(kit)}
        >
          {kit.coverPath ? (
            <img src={getAssetUrl(kit.coverPath)} alt={kit.name} className="absolute inset-0 w-full h-full object-cover" />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-primary/30 to-primary/5 flex items-center justify-center">
              <Boxes className="w-10 h-10 text-primary/60" />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

          <div className="absolute bottom-0 left-0 right-0 p-3">
            <h3 className="text-sm font-semibold text-white truncate">{kit.name}</h3>
            <div className="flex items-center gap-2 text-[10px] text-white/70 mt-0.5">
              <span className="flex items-center gap-0.5"><Music2 className="w-3 h-3" /> {kit.sampleCount}</span>
              <span className="flex items-center gap-0.5"><Calendar className="w-3 h-3" /> {new Date(kit.createdAt).toLocaleDateString()}</span>
            </div>
          </div>

          <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              type="button"
              aria-label="Open kit folder"
              onClick={(e) => { e.stopPropagation(); openFolder(kit.outputDir).catch(() => {}) }}
              className="w-7 h-7 rounded-lg bg-black/50 backdrop-blur flex items-center justify-center text-white/80 hover:text-white hover:bg-black/70"
            >
              <FolderOpen className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              aria-label="Delete kit"
              onClick={(e) => { e.stopPropagation(); onDelete(kit.id) }}
              className="w-7 h-7 rounded-lg bg-black/50 backdrop-blur flex items-center justify-center text-white/80 hover:text-rose-400 hover:bg-black/70"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </motion.div>
      ))}
    </div>
  )
}
