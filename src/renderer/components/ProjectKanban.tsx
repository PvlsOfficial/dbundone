import React, { useState, useMemo, useCallback, memo, useEffect, useRef } from "react"
import {
  Plus,
  Trash2,
  CheckCircle2,
  Circle,
  Loader2,
  ListTodo,
  Clock,
  Flag,
  AlertTriangle,
  MessageSquare,
  X,
  MoreHorizontal,
  Edit3,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu"
import { Task, Annotation, Project } from "@shared/types"

interface ProjectKanbanProps {
  project: Project
  tasks: Task[]
  taskAnnotations: Annotation[]
  onCreateTask: (task: Partial<Task>) => Promise<void>
  onUpdateTask: (id: string, updates: Partial<Task>) => Promise<void>
  onDeleteTask: (id: string) => Promise<void>
  onReorderTasks: (tasks: { id: string; order: number; status: string }[]) => Promise<void>
  onConvertAnnotation: (annotationId: string) => Promise<void>
  onUnconvertAnnotation: (annotationId: string) => Promise<void>
  onUpdateAnnotationTask: (annotationId: string, data: any) => Promise<void>
  onRefresh: () => void
}

type TaskStatus = "todo" | "in-progress" | "done"

interface KanbanColumn {
  id: TaskStatus
  title: string
  icon: React.ReactNode
  color: string
  bgColor: string
}

const COLUMNS: KanbanColumn[] = [
  { id: "todo", title: "To Do", icon: <Circle className="w-4 h-4" />, color: "text-blue-600 dark:text-blue-400", bgColor: "bg-blue-500/15 dark:bg-blue-500/10" },
  { id: "in-progress", title: "In Progress", icon: <Loader2 className="w-4 h-4" />, color: "text-orange-600 dark:text-orange-400", bgColor: "bg-orange-500/15 dark:bg-orange-500/10" },
  { id: "done", title: "Done", icon: <CheckCircle2 className="w-4 h-4" />, color: "text-green-600 dark:text-green-400", bgColor: "bg-green-500/15 dark:bg-green-500/10" },
]

const PRIORITY_CONFIG = {
  low: { label: "Low", color: "text-gray-500", bgColor: "bg-gray-500/15", icon: <Flag className="w-3 h-3" /> },
  medium: { label: "Medium", color: "text-yellow-500", bgColor: "bg-yellow-500/15", icon: <Flag className="w-3 h-3" /> },
  high: { label: "High", color: "text-orange-500", bgColor: "bg-orange-500/15", icon: <Flag className="w-3 h-3" /> },
  urgent: { label: "Urgent", color: "text-red-500", bgColor: "bg-red-500/15", icon: <AlertTriangle className="w-3 h-3" /> },
}

const DRAG_THRESHOLD = 5

// Task Card
const TaskCard = memo(({
  task,
  isDragging,
  onDragStart,
  onUpdate,
  onDelete,
  onEdit
}: {
  task: Task
  isDragging: boolean
  onDragStart: (e: React.MouseEvent) => void
  onUpdate: (id: string, updates: Partial<Task>) => Promise<void>
  onDelete: (id: string) => Promise<void>
  onEdit: (task: Task) => void
}) => {
  const priority = (task.priority || "medium") as keyof typeof PRIORITY_CONFIG
  const priorityConfig = PRIORITY_CONFIG[priority]

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          onMouseDown={onDragStart}
          className={cn(
            "group p-3 rounded-lg border bg-card hover:bg-accent/30 transition-all cursor-grab active:cursor-grabbing select-none",
            isDragging && "opacity-50 scale-95"
          )}
        >
          {/* Header: title + menu */}
          <div className="flex items-start justify-between gap-2 mb-1.5">
            <span className="text-sm font-medium leading-tight flex-1">{task.title}</span>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-5 w-5 p-0 opacity-0 group-hover:opacity-100 transition-opacity">
                  <MoreHorizontal className="w-3.5 h-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onEdit(task)}>
                  <Edit3 className="w-3.5 h-3.5 mr-2" /> Edit
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {task.status !== "todo" && (
                  <DropdownMenuItem onClick={() => onUpdate(task.id, { status: "todo" })}>
                    <Circle className="w-3.5 h-3.5 mr-2" /> Move to To Do
                  </DropdownMenuItem>
                )}
                {task.status !== "in-progress" && (
                  <DropdownMenuItem onClick={() => onUpdate(task.id, { status: "in-progress" })}>
                    <Loader2 className="w-3.5 h-3.5 mr-2" /> Move to In Progress
                  </DropdownMenuItem>
                )}
                {task.status !== "done" && (
                  <DropdownMenuItem onClick={() => onUpdate(task.id, { status: "done" })}>
                    <CheckCircle2 className="w-3.5 h-3.5 mr-2" /> Move to Done
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-destructive" onClick={() => onDelete(task.id)}>
                  <Trash2 className="w-3.5 h-3.5 mr-2" /> Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Description preview */}
          {task.description && (
            <p className="text-xs text-muted-foreground line-clamp-2 mb-2">{task.description}</p>
          )}

          {/* Footer: priority + date */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className={cn("flex items-center gap-1 text-[10px]", priorityConfig.color, priorityConfig.bgColor, "px-1.5 py-0.5 rounded-full")}>
              {priorityConfig.icon}
              {priorityConfig.label}
            </span>
            {task.dueDate && (
              <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                <Clock className="w-2.5 h-2.5" />
                {new Date(task.dueDate).toLocaleDateString()}
              </span>
            )}
            {(task.comments?.length ?? 0) > 0 && (
              <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                <MessageSquare className="w-2.5 h-2.5" />
                {task.comments!.length}
              </span>
            )}
          </div>
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onClick={() => onEdit(task)}>
          <Edit3 className="w-3.5 h-3.5 mr-2" /> Edit Task
        </ContextMenuItem>
        <ContextMenuSeparator />
        {task.status !== "todo" && (
          <ContextMenuItem onClick={() => onUpdate(task.id, { status: "todo" })}>
            <Circle className="w-3.5 h-3.5 mr-2" /> Move to To Do
          </ContextMenuItem>
        )}
        {task.status !== "in-progress" && (
          <ContextMenuItem onClick={() => onUpdate(task.id, { status: "in-progress" })}>
            <Loader2 className="w-3.5 h-3.5 mr-2" /> Move to In Progress
          </ContextMenuItem>
        )}
        {task.status !== "done" && (
          <ContextMenuItem onClick={() => onUpdate(task.id, { status: "done" })}>
            <CheckCircle2 className="w-3.5 h-3.5 mr-2" /> Move to Done
          </ContextMenuItem>
        )}
        <ContextMenuSeparator />
        <ContextMenuItem className="text-destructive" onClick={() => onDelete(task.id)}>
          <Trash2 className="w-3.5 h-3.5 mr-2" /> Delete
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
})
TaskCard.displayName = "TaskCard"

// Annotation Task Card
const AnnotationTaskCard = memo(({
  annotation,
  onUnconvert,
  onUpdateTask,
}: {
  annotation: Annotation
  onUnconvert: (id: string) => Promise<void>
  onUpdateTask: (id: string, data: any) => Promise<void>
}) => {
  const status = annotation.taskStatus || "todo"
  const priority = (annotation.taskPriority || "medium") as keyof typeof PRIORITY_CONFIG
  const priorityConfig = PRIORITY_CONFIG[priority]

  const formatTimestamp = (seconds: number) => {
    const m = Math.floor(seconds / 60)
    const s = Math.floor(seconds % 60)
    return `${m}:${s.toString().padStart(2, "0")}`
  }

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div className="p-3 rounded-lg border bg-card hover:bg-accent/30 transition-all border-dashed border-primary/30 select-none">
          <div className="flex items-start justify-between gap-2 mb-1.5">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <Badge variant="secondary" className="text-[10px] flex-shrink-0">
                @{formatTimestamp(annotation.timestamp)}
              </Badge>
              <span className="text-sm font-medium leading-tight truncate">{annotation.text}</span>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-5 w-5 p-0">
                  <MoreHorizontal className="w-3.5 h-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {status !== "todo" && (
                  <DropdownMenuItem onClick={() => onUpdateTask(annotation.id, { taskStatus: "todo" })}>
                    <Circle className="w-3.5 h-3.5 mr-2" /> To Do
                  </DropdownMenuItem>
                )}
                {status !== "in-progress" && (
                  <DropdownMenuItem onClick={() => onUpdateTask(annotation.id, { taskStatus: "in-progress" })}>
                    <Loader2 className="w-3.5 h-3.5 mr-2" /> In Progress
                  </DropdownMenuItem>
                )}
                {status !== "done" && (
                  <DropdownMenuItem onClick={() => onUpdateTask(annotation.id, { taskStatus: "done" })}>
                    <CheckCircle2 className="w-3.5 h-3.5 mr-2" /> Done
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => onUnconvert(annotation.id)}>
                  <X className="w-3.5 h-3.5 mr-2" /> Remove as Task
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className={cn("flex items-center gap-1 text-[10px]", priorityConfig.color, priorityConfig.bgColor, "px-1.5 py-0.5 rounded-full")}>
              {priorityConfig.icon}
              {priorityConfig.label}
            </span>
            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
              <MessageSquare className="w-2.5 h-2.5" /> From annotation
            </span>
          </div>
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onClick={() => onUnconvert(annotation.id)}>
          <X className="w-3.5 h-3.5 mr-2" /> Remove as Task
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
})
AnnotationTaskCard.displayName = "AnnotationTaskCard"

export const ProjectKanban: React.FC<ProjectKanbanProps> = ({
  project,
  tasks,
  taskAnnotations,
  onCreateTask,
  onUpdateTask,
  onDeleteTask,
  onUnconvertAnnotation,
  onUpdateAnnotationTask,
}) => {
  const [newTaskTitle, setNewTaskTitle] = useState("")
  const [newTaskColumn, setNewTaskColumn] = useState<TaskStatus | null>(null)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [editTitle, setEditTitle] = useState("")
  const [editDescription, setEditDescription] = useState("")
  const [editPriority, setEditPriority] = useState<string>("medium")
  const [editDueDate, setEditDueDate] = useState("")
  const [dragOverColumn, setDragOverColumn] = useState<TaskStatus | null>(null)
  const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null)

  // Refs for drag system
  const dragRef = useRef<{
    id: string
    type: "task" | "annotation"
    startX: number
    startY: number
    offsetX: number
    offsetY: number
    cardEl: HTMLElement
    ghost: HTMLElement | null
    activated: boolean
  } | null>(null)
  const columnRefs = useRef<Map<TaskStatus, HTMLElement>>(new Map())
  const onUpdateTaskRef = useRef(onUpdateTask)
  const onUpdateAnnotationTaskRef = useRef(onUpdateAnnotationTask)
  onUpdateTaskRef.current = onUpdateTask
  onUpdateAnnotationTaskRef.current = onUpdateAnnotationTask

  // Column ref callback
  const setColumnRef = useCallback((status: TaskStatus, el: HTMLDivElement | null) => {
    if (el) columnRefs.current.set(status, el)
    else columnRefs.current.delete(status)
  }, [])

  // Detect which column the cursor is over
  const getColumnAtPoint = useCallback((x: number, y: number): TaskStatus | null => {
    for (const [status, el] of columnRefs.current.entries()) {
      const rect = el.getBoundingClientRect()
      if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
        return status
      }
    }
    return null
  }, [])

  // Global mousemove + mouseup for drag
  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      const drag = dragRef.current
      if (!drag) return

      if (!drag.activated) {
        const dx = e.clientX - drag.startX
        const dy = e.clientY - drag.startY
        if (Math.sqrt(dx * dx + dy * dy) < DRAG_THRESHOLD) return

        // Activate drag: create ghost
        drag.activated = true
        const rect = drag.cardEl.getBoundingClientRect()
        const ghost = drag.cardEl.cloneNode(true) as HTMLElement
        ghost.style.position = "fixed"
        ghost.style.left = `${rect.left}px`
        ghost.style.top = `${rect.top}px`
        ghost.style.width = `${rect.width}px`
        ghost.style.zIndex = "9999"
        ghost.style.pointerEvents = "none"
        ghost.style.opacity = "0.92"
        ghost.style.transform = "rotate(2deg) scale(1.03)"
        ghost.style.boxShadow = "0 12px 28px rgba(0,0,0,0.2)"
        ghost.style.transition = "transform 0.15s ease, box-shadow 0.15s ease"
        ghost.style.borderRadius = "0.5rem"
        document.body.appendChild(ghost)
        drag.ghost = ghost

        document.body.style.userSelect = "none"
        document.body.style.cursor = "grabbing"
        setDraggingTaskId(drag.id)
      }

      // Move ghost
      if (drag.ghost) {
        drag.ghost.style.left = `${e.clientX - drag.offsetX}px`
        drag.ghost.style.top = `${e.clientY - drag.offsetY}px`
      }

      // Detect column hover
      setDragOverColumn(getColumnAtPoint(e.clientX, e.clientY))
    }

    const onMouseUp = async (e: MouseEvent) => {
      const drag = dragRef.current
      if (!drag) return
      dragRef.current = null

      // Clean up ghost and styles
      if (drag.ghost) {
        drag.ghost.remove()
      }
      document.body.style.userSelect = ""
      document.body.style.cursor = ""

      if (!drag.activated) {
        // Threshold not exceeded — it was a click, not a drag. Do nothing.
        setDraggingTaskId(null)
        setDragOverColumn(null)
        return
      }

      const targetColumn = getColumnAtPoint(e.clientX, e.clientY)
      setDraggingTaskId(null)
      setDragOverColumn(null)

      if (targetColumn) {
        if (drag.type === "task") {
          await onUpdateTaskRef.current(drag.id, { status: targetColumn })
        } else {
          await onUpdateAnnotationTaskRef.current(drag.id, { taskStatus: targetColumn })
        }
      }
    }

    document.addEventListener("mousemove", onMouseMove)
    document.addEventListener("mouseup", onMouseUp)
    return () => {
      document.removeEventListener("mousemove", onMouseMove)
      document.removeEventListener("mouseup", onMouseUp)
      // Clean up if unmounted mid-drag
      if (dragRef.current?.ghost) {
        dragRef.current.ghost.remove()
        document.body.style.userSelect = ""
        document.body.style.cursor = ""
      }
    }
  }, [getColumnAtPoint])

  // Start tracking a potential drag (mousedown on card)
  const handleCardMouseDown = useCallback((e: React.MouseEvent, id: string, type: "task" | "annotation") => {
    // Only left click
    if (e.button !== 0) return
    // Don't start drag on interactive elements (buttons, inputs, etc.)
    const target = e.target as HTMLElement
    if (target.closest("button, a, input, textarea, [role='menuitem']")) return

    const cardEl = e.currentTarget as HTMLElement
    const rect = cardEl.getBoundingClientRect()

    dragRef.current = {
      id,
      type,
      startX: e.clientX,
      startY: e.clientY,
      offsetX: e.clientX - rect.left,
      offsetY: e.clientY - rect.top,
      cardEl,
      ghost: null,
      activated: false,
    }
  }, [])

  // Project tasks only
  const projectTasks = useMemo(
    () => tasks.filter(t => t.projectId === project.id),
    [tasks, project.id]
  )

  // Group by column
  const columnTasks = useMemo(() => {
    const map: Record<TaskStatus, Task[]> = { "todo": [], "in-progress": [], "done": [] }
    for (const task of projectTasks) {
      const status = (task.status as TaskStatus) || "todo"
      if (map[status]) map[status].push(task)
      else map.todo.push(task)
    }
    // Sort by order
    Object.values(map).forEach(arr => arr.sort((a, b) => a.order - b.order))
    return map
  }, [projectTasks])

  // Group annotation tasks by status
  const annotationTasksByStatus = useMemo(() => {
    const map: Record<string, Annotation[]> = { "todo": [], "in-progress": [], "done": [] }
    for (const ann of taskAnnotations) {
      const status = ann.taskStatus || "todo"
      if (map[status]) map[status].push(ann)
      else map.todo.push(ann)
    }
    return map
  }, [taskAnnotations])

  const handleCreateTask = async (status: TaskStatus) => {
    if (!newTaskTitle.trim()) return
    await onCreateTask({
      title: newTaskTitle.trim(),
      status,
      projectId: project.id,
      priority: "medium",
    })
    setNewTaskTitle("")
    setNewTaskColumn(null)
  }

  const handleEditSave = async () => {
    if (!editingTask) return
    await onUpdateTask(editingTask.id, {
      title: editTitle,
      description: editDescription || null,
      priority: editPriority as any,
      dueDate: editDueDate || null,
    })
    setEditingTask(null)
  }

  const openEdit = (task: Task) => {
    setEditingTask(task)
    setEditTitle(task.title)
    setEditDescription(task.description || "")
    setEditPriority(task.priority || "medium")
    setEditDueDate(task.dueDate || "")
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <ListTodo className="w-5 h-5 text-primary" />
          Tasks
          <Badge variant="secondary" className="text-xs">
            {projectTasks.length + taskAnnotations.length}
          </Badge>
        </h2>
      </div>

      {/* Kanban columns */}
      <div className={cn("grid grid-cols-3 gap-3", draggingTaskId && "select-none")}>
        {COLUMNS.map(column => {
          const colTasks = columnTasks[column.id] || []
          const colAnnotations = annotationTasksByStatus[column.id] || []
          const totalItems = colTasks.length + colAnnotations.length

          return (
            <div
              key={column.id}
              ref={(el) => setColumnRef(column.id, el)}
              className={cn(
                "flex flex-col rounded-xl border min-h-[200px] transition-all",
                dragOverColumn === column.id && "ring-2 ring-primary/50 bg-primary/5"
              )}
            >
              {/* Column header */}
              <div className={cn("flex items-center gap-2 p-3 rounded-t-xl", column.bgColor)}>
                <span className={column.color}>{column.icon}</span>
                <span className="text-sm font-medium">{column.title}</span>
                <Badge variant="secondary" className="text-[10px] ml-auto">{totalItems}</Badge>
              </div>

              {/* Cards */}
              <ScrollArea className="flex-1 p-2">
                <div className="flex flex-col gap-2">
                  {colTasks.map(task => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      isDragging={draggingTaskId === task.id}
                      onDragStart={(e) => handleCardMouseDown(e, task.id, "task")}
                      onUpdate={onUpdateTask}
                      onDelete={onDeleteTask}
                      onEdit={openEdit}
                    />
                  ))}
                  {colAnnotations.map(ann => (
                    <AnnotationTaskCard
                      key={ann.id}
                      annotation={ann}
                      onUnconvert={onUnconvertAnnotation}
                      onUpdateTask={onUpdateAnnotationTask}
                    />
                  ))}
                </div>
              </ScrollArea>

              {/* Add task */}
              <div className="p-2 border-t">
                {newTaskColumn === column.id ? (
                  <div className="flex flex-col gap-2">
                    <Input
                      value={newTaskTitle}
                      onChange={(e) => setNewTaskTitle(e.target.value)}
                      placeholder="Task title..."
                      className="h-8 text-sm"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleCreateTask(column.id)
                        if (e.key === "Escape") { setNewTaskColumn(null); setNewTaskTitle("") }
                      }}
                    />
                    <div className="flex items-center gap-1">
                      <Button size="sm" className="h-7 text-xs" onClick={() => handleCreateTask(column.id)}>
                        Add
                      </Button>
                      <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => { setNewTaskColumn(null); setNewTaskTitle("") }}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full h-8 text-xs text-muted-foreground"
                    onClick={() => setNewTaskColumn(column.id)}
                  >
                    <Plus className="w-3.5 h-3.5 mr-1" /> Add Task
                  </Button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Edit Dialog */}
      <Dialog open={!!editingTask} onOpenChange={(open) => !open && setEditingTask(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Task</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 pt-2">
            <div>
              <label className="text-sm font-medium mb-1 block">Title</label>
              <Input
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                placeholder="Task title"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Description</label>
              <Textarea
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                placeholder="Optional description..."
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium mb-1 block">Priority</label>
                <Select value={editPriority} onValueChange={setEditPriority}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Due Date</label>
                <Input
                  type="date"
                  value={editDueDate}
                  onChange={(e) => setEditDueDate(e.target.value)}
                  className="h-9"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setEditingTask(null)}>Cancel</Button>
              <Button onClick={handleEditSave}>Save Changes</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
