import type { TranscriptMotion } from "./motion.ts";

export interface TranscriptScroller {
  scrollBy(lines: number): void;
  scrollToTop(): void;
  scrollToBottom(): void;
}

export interface ChunkNavigator {
  previous(count: number): void;
  next(count: number): void;
}

export interface BlockNavigator {
  previous(count: number): void;
  next(count: number): void;
}

export interface TranscriptMotionOptions {
  halfPageLines?: number;
  blockLines?: number;
  chunkLines?: number;
  chunkNavigator?: ChunkNavigator;
  blockNavigator?: BlockNavigator;
}

export function applyTranscriptMotion(
  transcript: TranscriptScroller,
  motion: TranscriptMotion,
  options: TranscriptMotionOptions = {},
): void {
  const halfPageLines = options.halfPageLines ?? 10;
  const blockLines = options.blockLines ?? 6;
  const chunkLines = options.chunkLines ?? halfPageLines;

  switch (motion.kind) {
    case "line":
      transcript.scrollBy(motion.delta);
      return;
    case "halfPage":
      transcript.scrollBy(motion.delta * halfPageLines);
      return;
    case "top":
      transcript.scrollToTop();
      return;
    case "bottom":
      transcript.scrollToBottom();
      return;
    case "chunk": {
      const count = Math.abs(motion.delta);
      if (options.chunkNavigator) {
        if (motion.delta < 0) options.chunkNavigator.previous(count);
        else options.chunkNavigator.next(count);
        return;
      }
      transcript.scrollBy(Math.sign(motion.delta) * chunkLines * count);
      return;
    }
    case "block": {
      const count = Math.abs(motion.delta);
      if (options.blockNavigator) {
        if (motion.delta < 0) options.blockNavigator.previous(count);
        else options.blockNavigator.next(count);
        return;
      }
      transcript.scrollBy(Math.sign(motion.delta) * blockLines * count);
      return;
    }
  }
}
