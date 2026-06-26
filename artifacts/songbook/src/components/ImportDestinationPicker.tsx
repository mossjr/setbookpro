import { useListSets, getListSetsQueryKey } from "@workspace/api-client-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Library, ListPlus, ListMusic } from "lucide-react";

export type DestinationMode = "library" | "existing" | "new";

export interface DestinationState {
  mode: DestinationMode;
  existingSetId: string;
  newName: string;
}

export const emptyDestination = (newName = ""): DestinationState => ({
  mode: "library",
  existingSetId: "",
  newName,
});

/** Whether the current selection is complete enough to import. */
export function isDestinationReady(d: DestinationState): boolean {
  if (d.mode === "existing") return d.existingSetId.length > 0;
  if (d.mode === "new") return d.newName.trim().length > 0;
  return true;
}

/**
 * Resolve a destination into the fields the playlist-import endpoint expects.
 * library -> neither; existing -> setId; new -> setName.
 */
export function destinationPayload(d: DestinationState): {
  setId?: string;
  setName?: string;
} {
  if (d.mode === "existing") return { setId: d.existingSetId };
  if (d.mode === "new") return { setName: d.newName.trim() };
  return {};
}

export function ImportDestinationPicker({
  value,
  onChange,
}: {
  value: DestinationState;
  onChange: (next: DestinationState) => void;
}) {
  const { data: sets = [] } = useListSets({
    query: { queryKey: getListSetsQueryKey() },
  });

  const set = (patch: Partial<DestinationState>) =>
    onChange({ ...value, ...patch });

  const optionClass = (active: boolean) =>
    `flex items-center gap-2 rounded-md border px-3 py-2 text-sm cursor-pointer transition-colors ${
      active
        ? "border-primary bg-primary/10 text-foreground"
        : "border-border hover:bg-accent/50 text-muted-foreground"
    }`;

  return (
    <div className="space-y-3">
      <Label className="text-xs uppercase tracking-wider text-muted-foreground">
        Where should this go?
      </Label>
      <RadioGroup
        value={value.mode}
        onValueChange={(mode) => set({ mode: mode as DestinationMode })}
        className="grid gap-2"
      >
        <label className={optionClass(value.mode === "library")}>
          <RadioGroupItem value="library" className="sr-only" />
          <Library className="w-4 h-4 shrink-0" />
          <span className="font-medium">Just my library</span>
        </label>

        <label className={optionClass(value.mode === "existing")}>
          <RadioGroupItem value="existing" className="sr-only" />
          <ListMusic className="w-4 h-4 shrink-0" />
          <span className="font-medium">Add to an existing set</span>
        </label>
        {value.mode === "existing" && (
          <div className="pl-2">
            <Select
              value={value.existingSetId}
              onValueChange={(existingSetId) => set({ existingSetId })}
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={sets.length ? "Choose a set" : "No sets yet"}
                />
              </SelectTrigger>
              <SelectContent>
                {sets.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <label className={optionClass(value.mode === "new")}>
          <RadioGroupItem value="new" className="sr-only" />
          <ListPlus className="w-4 h-4 shrink-0" />
          <span className="font-medium">Create a new set</span>
        </label>
        {value.mode === "new" && (
          <div className="pl-2">
            <Input
              value={value.newName}
              onChange={(e) => set({ newName: e.target.value })}
              placeholder="Name the new set"
            />
          </div>
        )}
      </RadioGroup>
    </div>
  );
}
