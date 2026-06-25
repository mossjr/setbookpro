import { useState } from "react";
import {
  useListTags,
  getListTagsQueryKey,
  useCreateTag,
  useUpdateTag,
  useDeleteTag,
  getGetSongStatsQueryKey,
  getListSongsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Check, Trash2, Pencil } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const PALETTE = [
  "#ef4444",
  "#f59e0b",
  "#10b981",
  "#3b82f6",
  "#8b5cf6",
  "#ec4899",
  "#14b8a6",
  "#64748b",
];

export default function TagsManager() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: tags = [] } = useListTags({
    query: { queryKey: getListTagsQueryKey() },
  });
  const createTag = useCreateTag();
  const updateTag = useUpdateTag();
  const deleteTag = useDeleteTag();

  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState("#ef4444");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: getListTagsQueryKey() });
    qc.invalidateQueries({ queryKey: getGetSongStatsQueryKey() });
    qc.invalidateQueries({ queryKey: getListSongsQueryKey() });
  };

  const create = () => {
    if (!newName.trim()) return;
    createTag.mutate(
      { data: { name: newName.trim(), color: newColor } },
      {
        onSuccess: () => {
          setNewName("");
          invalidate();
        },
        onError: () =>
          toast({ title: "Could not create tag", variant: "destructive" }),
      },
    );
  };

  const saveEdit = (id: string) => {
    if (!editName.trim()) return;
    updateTag.mutate(
      { id, data: { name: editName.trim() } },
      {
        onSuccess: () => {
          setEditingId(null);
          invalidate();
        },
      },
    );
  };

  const remove = (id: string) => {
    deleteTag.mutate({ id }, { onSuccess: invalidate });
  };

  return (
    <div className="p-4 space-y-4">
      <div className="space-y-2">
        <div className="flex gap-2">
          <Input
            placeholder="New tag name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && create()}
          />
          <Button size="icon" onClick={create} disabled={!newName.trim()}>
            <Plus className="w-4 h-4" />
          </Button>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {PALETTE.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setNewColor(c)}
              className={`w-6 h-6 rounded-full border-2 ${
                newColor === c ? "border-foreground" : "border-transparent"
              }`}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
      </div>

      <div className="space-y-1">
        {tags.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No tags yet.
          </p>
        ) : (
          tags.map((t) => (
            <div
              key={t.id}
              className="flex items-center gap-2 p-2 rounded-md hover:bg-sidebar-accent"
            >
              <span
                className="w-3 h-3 rounded-full shrink-0"
                style={{ backgroundColor: t.color }}
              />
              {editingId === t.id ? (
                <>
                  <Input
                    className="h-8"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && saveEdit(t.id)}
                    autoFocus
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8"
                    onClick={() => saveEdit(t.id)}
                  >
                    <Check className="w-4 h-4" />
                  </Button>
                </>
              ) : (
                <>
                  <span className="flex-1 text-sm truncate">{t.name}</span>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8"
                    onClick={() => {
                      setEditingId(t.id);
                      setEditName(t.name);
                    }}
                  >
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8"
                    onClick={() => remove(t.id)}
                  >
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
