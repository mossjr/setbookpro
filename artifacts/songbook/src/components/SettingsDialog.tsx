import { useAppStore, useSettingsStore } from "@/store";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Settings, Moon, Sun, Monitor } from "lucide-react";
import { Label } from "@/components/ui/label";

export default function SettingsDialog() {
  const { 
    theme, setTheme,
    titleFontSize, setTitleFontSize,
    lyricsFontSize, setLyricsFontSize,
    chordsFontSize, setChordsFontSize
  } = useSettingsStore();

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" title="Settings">
          <Settings className="w-5 h-5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          <div className="space-y-3">
            <Label>Theme</Label>
            <div className="flex gap-2">
              <Button variant={theme === 'light' ? 'default' : 'outline'} onClick={() => setTheme('light')} className="flex-1">
                <Sun className="w-4 h-4 mr-2" /> Light
              </Button>
              <Button variant={theme === 'dark' ? 'default' : 'outline'} onClick={() => setTheme('dark')} className="flex-1">
                <Moon className="w-4 h-4 mr-2" /> Dark
              </Button>
              <Button variant={theme === 'system' ? 'default' : 'outline'} onClick={() => setTheme('system')} className="flex-1">
                <Monitor className="w-4 h-4 mr-2" /> System
              </Button>
            </div>
          </div>

          <div className="space-y-3">
            <Label>Title Font Size ({titleFontSize}px)</Label>
            <Slider 
              value={[titleFontSize]} 
              min={16} max={48} step={1}
              onValueChange={([val]) => setTitleFontSize(val)} 
            />
          </div>

          <div className="space-y-3">
            <Label>Lyrics Font Size ({lyricsFontSize}px)</Label>
            <Slider 
              value={[lyricsFontSize]} 
              min={12} max={36} step={1}
              onValueChange={([val]) => setLyricsFontSize(val)} 
            />
          </div>

          <div className="space-y-3">
            <Label>Chords Font Size ({chordsFontSize}px)</Label>
            <Slider 
              value={[chordsFontSize]} 
              min={10} max={32} step={1}
              onValueChange={([val]) => setChordsFontSize(val)} 
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}