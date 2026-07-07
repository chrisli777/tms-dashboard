"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Trash2, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

interface DeleteContainerButtonProps {
  container: string
  /** "icon" for compact table rows, "button" for the detail page. */
  variant?: "icon" | "button"
  /** Where to go after a successful delete. Defaults to a plain refresh. */
  redirectTo?: string
}

export function DeleteContainerButton({
  container,
  variant = "icon",
  redirectTo,
}: DeleteContainerButtonProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  async function handleDelete() {
    setDeleting(true)
    try {
      const res = await fetch("/api/dispatch/containers", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ container }),
      })
      if (!res.ok) {
        setDeleting(false)
        return
      }
      setOpen(false)
      if (redirectTo) {
        router.push(redirectTo)
      }
      router.refresh()
    } catch {
      setDeleting(false)
    }
  }

  return (
    <div onClick={(e) => e.stopPropagation()}>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogTrigger asChild>
          {variant === "icon" ? (
            <Button
              variant="ghost"
              size="icon"
              className="size-8 text-muted-foreground hover:text-destructive"
              aria-label={`Delete container ${container}`}
            >
              <Trash2 className="size-4" />
            </Button>
          ) : (
            <Button variant="outline" size="sm" className="gap-1.5 text-destructive hover:text-destructive">
              <Trash2 className="size-4" />
              Delete
            </Button>
          )}
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete container {container}?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the manually-added container from the Dispatcher. This action
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                handleDelete()
              }}
              disabled={deleting}
              className="gap-1.5 bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting && <Loader2 className="size-4 animate-spin" />}
              {deleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
