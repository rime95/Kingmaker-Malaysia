"use client";

import { useEffect } from "react";
import { useGame } from "@/store/gameStore";
import { audio, type MusicMode } from "./audio";

/** Keeps the soundtrack in step with the screen: the title theme, the campaign, the counting night. */
export function useSoundtrack(mode: MusicMode) {
  const music = useGame((s) => s.music);
  const sound = useGame((s) => s.sound);
  const volume = useGame((s) => s.volume);
  useEffect(() => {
    if (!audio) return;
    audio.sfxOn = sound;
    audio.setVolume(volume);
    audio.play(music ? mode : null);
  }, [mode, music, sound, volume]);
}

/** Music and effects toggles, and a volume slider. */
export function SoundControls({ compact }: { compact?: boolean }) {
  const { music, setMusic, sound, setSound, volume, setVolume } = useGame();
  return (
    <div className={`flex items-center gap-1.5 ${compact ? "" : "px-3 py-2"}`}>
      <button className="chip !py-1 text-xs" aria-pressed={music} onClick={() => setMusic(!music)} title="Soundtrack">
        ♪ {music ? "Music" : "Music off"}
      </button>
      <button className="chip !py-1 text-xs" aria-pressed={sound} onClick={() => setSound(!sound)} title="Sound effects">
        {sound ? "🔊" : "🔈"} FX
      </button>
      <input
        type="range"
        min={0}
        max={1}
        step={0.05}
        value={volume}
        onChange={(e) => setVolume(Number(e.target.value))}
        aria-label="Volume"
        className="w-16 accent-[var(--accent)]"
      />
    </div>
  );
}
