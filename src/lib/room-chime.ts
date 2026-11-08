/**
 * 联机房间提示音
 *
 * 用 Web Audio 现场合成，不依赖任何音频文件。
 * 音高取自简谱：1 = do、2 = re、3 = mi（此处用 C5 / D5 / E5）。
 * - 有人加入：1 0 2 3 —— do、空 0.5 秒、re、mi（上行）
 * - 有人退出：3 2 1 —— mi、re、do（下行）
 */

export interface ChimeStep {
  /** 频率（Hz）；null 表示休止符 */
  freq: number | null;
  /** 本步时长（秒），休止符即静默时长 */
  duration: number;
}

const DO = 523.25;
const RE = 587.33;
const MI = 659.25;

/** 有人加入房间：do —（空 0.5s）— re — mi */
export const JOIN_CHIME: readonly ChimeStep[] = [
  { freq: DO, duration: 0.16 },
  { freq: null, duration: 0.5 },
  { freq: RE, duration: 0.14 },
  { freq: MI, duration: 0.28 },
];

/** 有人退出房间：mi — re — do */
export const LEAVE_CHIME: readonly ChimeStep[] = [
  { freq: MI, duration: 0.15 },
  { freq: RE, duration: 0.14 },
  { freq: DO, duration: 0.3 },
];

const MASTER_VOLUME = 0.14;
const ATTACK_SECONDS = 0.012;
const START_DELAY_SECONDS = 0.02;

let audioContext: AudioContext | null = null;
/** 当前正在播放的一段音效，用于新音效覆盖旧音效 */
let activeVoices: { oscillators: OscillatorNode[]; master: GainNode } | null = null;

function getAudioContext(): AudioContext | null {
  try {
    if (!audioContext) {
      const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      audioContext = new Ctor();
    }
    // 浏览器/Electron 可能因为自动播放策略处于 suspended 状态
    if (audioContext.state === "suspended") void audioContext.resume().catch(() => undefined);
    return audioContext;
  } catch {
    return null;
  }
}

function stopActive(): void {
  const voices = activeVoices;
  if (!voices) return;
  activeVoices = null;
  try {
    const now = audioContext?.currentTime ?? 0;
    voices.master.gain.cancelScheduledValues(now);
    voices.master.gain.setValueAtTime(voices.master.gain.value, now);
    voices.master.gain.linearRampToValueAtTime(0, now + 0.05);
    for (const oscillator of voices.oscillators) {
      try {
        oscillator.stop(now + 0.06);
      } catch {
        // 已经停止的振荡器再 stop 会抛错，忽略
      }
    }
  } catch {
    // 忽略停止失败
  }
}

function playSequence(steps: readonly ChimeStep[]): void {
  const ctx = getAudioContext();
  if (!ctx) return;
  stopActive();

  const master = ctx.createGain();
  master.gain.setValueAtTime(MASTER_VOLUME, ctx.currentTime);
  master.connect(ctx.destination);

  const oscillators: OscillatorNode[] = [];
  let cursor = ctx.currentTime + START_DELAY_SECONDS;

  for (const step of steps) {
    if (step.freq !== null) {
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.type = "triangle";
      oscillator.frequency.setValueAtTime(step.freq, cursor);
      // 起音、保持、收尾的简单包络，避免爆音
      gain.gain.setValueAtTime(0, cursor);
      gain.gain.linearRampToValueAtTime(1, cursor + ATTACK_SECONDS);
      gain.gain.setValueAtTime(1, cursor + step.duration * 0.6);
      gain.gain.linearRampToValueAtTime(0, cursor + step.duration);
      oscillator.connect(gain);
      gain.connect(master);
      oscillator.start(cursor);
      oscillator.stop(cursor + step.duration + 0.02);
      oscillators.push(oscillator);
    }
    cursor += step.duration;
  }

  activeVoices = { oscillators, master };
}

/** 有人加入房间的提示音：do — 空 0.5s — re — mi */
export function playJoinChime(): void {
  playSequence(JOIN_CHIME);
}

/** 有人退出房间的提示音：mi — re — do */
export function playLeaveChime(): void {
  playSequence(LEAVE_CHIME);
}
