import React, { useState } from "react"
import { Boxes } from "lucide-react"
import { Badge } from "@/components/ui"
import type { AppSettings, SavedKit } from "@shared/types"
import { useKitConfig } from "../stashkit/useKitConfig"
import { KitLibrary } from "../stashkit/KitLibrary"
import { KitDetail } from "../stashkit/KitDetail"

interface StashKitProps {
  settings: AppSettings
}

type View =
  | { mode: "library" }
  | { mode: "detail"; existing: SavedKit | null; initialName: string }

export const StashKit: React.FC<StashKitProps> = ({ settings: _settings }) => {
  const { config, setConfig, update, loaded } = useKitConfig()
  const [view, setView] = useState<View>({ mode: "library" })

  if (view.mode === "detail") {
    return (
      <KitDetail
        config={config}
        setConfig={setConfig}
        update={update}
        existing={view.existing}
        initialName={view.initialName}
        onClose={() => setView({ mode: "library" })}
      />
    )
  }

  const deleteKit = (id: string) =>
    setConfig((c) => ({ ...c, savedKits: c.savedKits.filter((k) => k.id !== id) }))

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center gap-3 px-6 py-4 border-b border-border/30 flex-shrink-0">
        <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
          <Boxes className="w-5 h-5 text-primary" />
        </div>
        <div className="flex-1">
          <h1 className="text-lg font-semibold flex items-center gap-2">
            Stash Kit Creator
            <Badge variant="secondary" className="text-[10px]">FL Studio</Badge>
          </h1>
          <p className="text-xs text-muted-foreground">Your drum kits — built from your FL projects, perfectly sorted</p>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        {loaded && (
          <KitLibrary
            kits={config.savedKits}
            onNew={() =>
              setView({ mode: "detail", existing: null, initialName: `My Kit ${config.savedKits.length + 1}` })
            }
            onOpen={(kit) => setView({ mode: "detail", existing: kit, initialName: kit.name })}
            onDelete={deleteKit}
          />
        )}
      </div>
    </div>
  )
}

export default StashKit
