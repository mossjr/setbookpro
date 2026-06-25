import { useAppStore, useSettingsStore } from "@/store";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Settings,
  Moon,
  Sun,
  Monitor,
  AlignLeft,
  Columns,
  Wand2,
} from "lucide-react";

const ACCENT_PRESETS: { name: string; value: string }[] = [
  { name: "Amber", value: "38 92% 50%" },
  { name: "Red", value: "0 84% 60%" },
  { name: "Green", value: "142 71% 45%" },
  { name: "Blue", value: "217 91% 60%" },
  { name: "Purple", value: "271 81% 56%" },
  { name: "Pink", value: "330 81% 60%" },
  { name: "Teal", value: "173 80% 40%" },
];

export default function SettingsDialog() {
  const {
    theme,
    setTheme,
    accentColor,
    setAccentColor,
    titleFontSize,
    setTitleFontSize,
    lyricsFontSize,
    setLyricsFontSize,
    chordsFontSize,
    setChordsFontSize,
    autoScrollSpeed,
    setAutoScrollSpeed,
    autoScrollMinSpeed,
    setAutoScrollMinSpeed,
    autoScrollMaxSpeed,
    setAutoScrollMaxSpeed,
    autoScrollStartDelay,
    setAutoScrollStartDelay,
    metronomeFlash,
    setMetronomeFlash,
    metronomeSound,
    setMetronomeSound,
  } = useSettingsStore();

  const { displayMode, setDisplayMode } = useAppStore();

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" title="Settings">
          <Settings className="w-5 h-5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-2">
          {/* Theme */}
          <div className="space-y-3">
            <Label>Theme</Label>
            <div className="flex gap-2">
              <Button
                variant={theme === "light" ? "default" : "outline"}
                onClick={() => setTheme("light")}
                className="flex-1"
              >
                <Sun className="w-4 h-4 mr-2" /> Light
              </Button>
              <Button
                variant={theme === "dark" ? "default" : "outline"}
                onClick={() => setTheme("dark")}
                className="flex-1"
              >
                <Moon className="w-4 h-4 mr-2" /> Dark
              </Button>
              <Button
                variant={theme === "system" ? "default" : "outline"}
                onClick={() => setTheme("system")}
                className="flex-1"
              >
                <Monitor className="w-4 h-4 mr-2" /> Auto
              </Button>
            </div>
          </div>

          {/* Accent color */}
          <div className="space-y-3">
            <Label className="flex items-center gap-2">
              <Wand2 className="w-4 h-4" /> Accent color
            </Label>
            <div className="flex flex-wrap gap-2">
              {ACCENT_PRESETS.map((c) => (
                <button
                  key={c.value}
                  title={c.name}
                  onClick={() => setAccentColor(c.value)}
                  className={`w-8 h-8 rounded-full border-2 transition-transform ${
                    accentColor === c.value
                      ? "border-foreground scale-110"
                      : "border-transparent"
                  }`}
                  style={{ backgroundColor: `hsl(${c.value})` }}
                />
              ))}
            </div>
          </div>

          {/* Display mode */}
          <div className="space-y-3">
            <Label>Default layout</Label>
            <div className="flex gap-2">
              <Button
                variant={displayMode === "scroll" ? "default" : "outline"}
                onClick={() => setDisplayMode("scroll")}
                className="flex-1"
              >
                <AlignLeft className="w-4 h-4 mr-2" /> Scroll
              </Button>
              <Button
                variant={displayMode === "split" ? "default" : "outline"}
                onClick={() => setDisplayMode("split")}
                className="flex-1"
              >
                <Columns className="w-4 h-4 mr-2" /> Split
              </Button>
              <Button
                variant={displayMode === "auto" ? "default" : "outline"}
                onClick={() => setDisplayMode("auto")}
                className="flex-1"
              >
                <Wand2 className="w-4 h-4 mr-2" /> Auto
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Scroll glides down one column. Split paginates into columns (tap
              sides to turn pages). Auto picks based on screen width.
            </p>
          </div>

          {/* Font sizes */}
          <div className="space-y-3">
            <Label>Title font size ({titleFontSize}px)</Label>
            <Slider
              value={[titleFontSize]}
              min={16}
              max={48}
              step={1}
              onValueChange={([val]) => setTitleFontSize(val)}
            />
          </div>
          <div className="space-y-3">
            <Label>Lyrics font size ({lyricsFontSize}px)</Label>
            <Slider
              value={[lyricsFontSize]}
              min={12}
              max={36}
              step={1}
              onValueChange={([val]) => setLyricsFontSize(val)}
            />
          </div>
          <div className="space-y-3">
            <Label>Chords font size ({chordsFontSize}px)</Label>
            <Slider
              value={[chordsFontSize]}
              min={10}
              max={32}
              step={1}
              onValueChange={([val]) => setChordsFontSize(val)}
            />
          </div>

          <div className="h-px bg-border" />

          {/* Auto-scroll */}
          <div className="space-y-3">
            <Label>Auto-scroll base speed — 1× ({autoScrollSpeed} px/s)</Label>
            <Slider
              value={[autoScrollSpeed]}
              min={autoScrollMinSpeed}
              max={autoScrollMaxSpeed}
              step={1}
              onValueChange={([val]) => setAutoScrollSpeed(val)}
            />
            <p className="text-xs text-muted-foreground">
              The scrubber's dead-center (1×) maps to this speed; drag toward the
              ends to reach min/max.
            </p>
          </div>
          <div className="space-y-3">
            <Label>Auto-scroll min speed ({autoScrollMinSpeed} px/s)</Label>
            <Slider
              value={[autoScrollMinSpeed]}
              min={2}
              max={Math.max(2, autoScrollMaxSpeed - 5)}
              step={1}
              onValueChange={([val]) => setAutoScrollMinSpeed(val)}
            />
          </div>
          <div className="space-y-3">
            <Label>Auto-scroll max speed ({autoScrollMaxSpeed} px/s)</Label>
            <Slider
              value={[autoScrollMaxSpeed]}
              min={autoScrollMinSpeed + 5}
              max={500}
              step={5}
              onValueChange={([val]) => setAutoScrollMaxSpeed(val)}
            />
          </div>
          <div className="space-y-3">
            <Label>Start delay ({autoScrollStartDelay}s)</Label>
            <Slider
              value={[autoScrollStartDelay]}
              min={0}
              max={10}
              step={1}
              onValueChange={([val]) => setAutoScrollStartDelay(val)}
            />
          </div>

          <div className="h-px bg-border" />

          {/* Metronome */}
          <div className="flex items-center justify-between">
            <Label htmlFor="metro-sound">Metronome sound</Label>
            <Switch
              id="metro-sound"
              checked={metronomeSound}
              onCheckedChange={setMetronomeSound}
            />
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="metro-flash">Metronome screen flash</Label>
            <Switch
              id="metro-flash"
              checked={metronomeFlash}
              onCheckedChange={setMetronomeFlash}
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
