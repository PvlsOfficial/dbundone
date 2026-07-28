import React, { useMemo, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Button,
  Input,
  Label,
  Switch,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui"
import { applyRename, DEFAULT_RENAME, RenameOptions } from "./rename"

interface RenameDialogProps {
  open: boolean
  names: string[]
  onClose: () => void
  onApply: (newNames: string[]) => void
}

export const RenameDialog: React.FC<RenameDialogProps> = ({ open, names, onClose, onApply }) => {
  const [opts, setOpts] = useState<RenameOptions>(DEFAULT_RENAME)
  const set = (patch: Partial<RenameOptions>) => setOpts((p) => ({ ...p, ...patch }))

  const preview = useMemo(() => applyRename(names, opts), [names, opts])

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Advanced rename — {names.length} files</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Find &amp; replace</Label>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-muted-foreground">Regex</span>
                <Switch checked={opts.useRegex} onCheckedChange={(v) => set({ useRegex: v })} />
              </div>
            </div>
            <Input placeholder="Find" value={opts.find} onChange={(e) => set({ find: e.target.value })} className="h-8 text-xs" />
            <Input placeholder="Replace with" value={opts.replace} onChange={(e) => set({ replace: e.target.value })} className="h-8 text-xs" />

            <div className="grid grid-cols-2 gap-2">
              <Input placeholder="Prefix" value={opts.prefix} onChange={(e) => set({ prefix: e.target.value })} className="h-8 text-xs" />
              <Input placeholder="Suffix" value={opts.suffix} onChange={(e) => set({ suffix: e.target.value })} className="h-8 text-xs" />
            </div>

            <div>
              <Label className="text-xs">Case</Label>
              <Select value={opts.caseMode} onValueChange={(v) => set({ caseMode: v as RenameOptions["caseMode"] })}>
                <SelectTrigger className="h-8 text-xs mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Keep as-is</SelectItem>
                  <SelectItem value="lower">lowercase</SelectItem>
                  <SelectItem value="upper">UPPERCASE</SelectItem>
                  <SelectItem value="title">Title Case</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between pt-1">
              <Label className="text-xs">Sequential numbering</Label>
              <Switch checked={opts.numbering} onCheckedChange={(v) => set({ numbering: v })} />
            </div>
            {opts.numbering && (
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <Label className="text-[10px] text-muted-foreground">Start</Label>
                  <Input type="number" value={opts.numberStart} onChange={(e) => set({ numberStart: parseInt(e.target.value) || 0 })} className="h-8 text-xs" />
                </div>
                <div>
                  <Label className="text-[10px] text-muted-foreground">Pad</Label>
                  <Input type="number" value={opts.numberPadding} onChange={(e) => set({ numberPadding: parseInt(e.target.value) || 0 })} className="h-8 text-xs" />
                </div>
                <div>
                  <Label className="text-[10px] text-muted-foreground">Position</Label>
                  <Select value={opts.numberPosition} onValueChange={(v) => set({ numberPosition: v as RenameOptions["numberPosition"] })}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="prefix">Front</SelectItem>
                      <SelectItem value="suffix">End</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-col">
            <Label className="text-xs mb-1">Preview</Label>
            <div className="flex-1 max-h-72 overflow-auto rounded-lg border border-border/40 bg-muted/20 text-[11px] font-mono">
              {names.map((n, i) => (
                <div key={i} className="px-2 py-1 border-b border-border/20 last:border-0">
                  <div className="text-muted-foreground/60 truncate">{n}</div>
                  <div className="text-foreground truncate">→ {preview[i]}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={() => { onApply(preview); onClose() }}>Apply to {names.length}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
