import { createAudioPlayer, type AudioPlayer } from 'expo-audio';

// A soft bell played when a piece of content finishes — a gentle close before
// autoplay carries on. Lazily created once and reused.
let chime: AudioPlayer | null = null;

export function playChime() {
  try {
    if (!chime) {
      chime = createAudioPlayer(require('../../assets/sounds/chime.wav'));
      chime.volume = 0.5;
    }
    chime.seekTo(0);
    chime.play();
  } catch {
    /* web / unsupported — silence is fine */
  }
}
