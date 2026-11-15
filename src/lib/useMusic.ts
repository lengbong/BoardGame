import { useEffect } from 'react';
import { startMusic, stopMusic, type Playable } from './music';

/** 화면에 있는 동안 배경음악을 튼다. enabled가 false거나 화면을 떠나면 끈다. */
export function useMusic(song: Playable, enabled: boolean): void {
  useEffect(() => {
    if (enabled) startMusic(song);
    else stopMusic();
  }, [song, enabled]);
  useEffect(() => () => stopMusic(), []);
}
