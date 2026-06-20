import type { Page } from "./types";
import { clamp } from "./pageUtils";

type LastAddedItem = {
  pageId: number;
  id: number;
  x: number;
  y: number;
} | null;

const ADD_OFFSET_PERCENT = 1;

export function getNextAddedBubblePosition(
  currentPage: Page | null,
  lastAddedBubble: LastAddedItem,
  bubbleW = 20,
  bubbleH = 26
) {
  const baseX = 10;
  const baseY = 10;

  if (!currentPage || !lastAddedBubble) {
    return { x: baseX, y: baseY };
  }

  if (lastAddedBubble.pageId !== currentPage.id) {
    return { x: baseX, y: baseY };
  }

  const existing = currentPage.bubbles.find((b) => b.id === lastAddedBubble.id);
  if (!existing) {
    return { x: baseX, y: baseY };
  }

  if (existing.x === lastAddedBubble.x && existing.y === lastAddedBubble.y) {
    return {
      x: clamp(existing.x + ADD_OFFSET_PERCENT, 0, 100 - bubbleW),
      y: clamp(existing.y + ADD_OFFSET_PERCENT, 0, 100 - bubbleH),
    };
  }

  return { x: baseX, y: baseY };
}

export function getNextAddedSoundPosition(
  currentPage: Page | null,
  lastAddedSound: LastAddedItem
) {
  const baseX = 40;
  const baseY = 10;

  if (!currentPage || !lastAddedSound) {
    return { x: baseX, y: baseY };
  }

  if (lastAddedSound.pageId !== currentPage.id) {
    return { x: baseX, y: baseY };
  }

  const existing = currentPage.sounds.find((s) => s.id === lastAddedSound.id);
  if (!existing) {
    return { x: baseX, y: baseY };
  }

  if (existing.x === lastAddedSound.x && existing.y === lastAddedSound.y) {
    return {
      x: clamp(existing.x + ADD_OFFSET_PERCENT, 0, 100),
      y: clamp(existing.y + ADD_OFFSET_PERCENT, 0, 100),
    };
  }

  return { x: baseX, y: baseY };
}
export function getNextAddedMosaicPosition(
  currentPage: Page | null,
  lastAddedMosaic: LastAddedItem,
  mosaicW = 20,
  mosaicH = 12
) {
  const baseX = 40;
  const baseY = 44;

  if (!currentPage || !lastAddedMosaic) {
    return { x: baseX, y: baseY };
  }

  if (lastAddedMosaic.pageId !== currentPage.id) {
    return { x: baseX, y: baseY };
  }

  const existing = currentPage.mosaics?.find((m) => m.id === lastAddedMosaic.id);
  if (!existing) {
    return { x: baseX, y: baseY };
  }

  if (existing.x === lastAddedMosaic.x && existing.y === lastAddedMosaic.y) {
    return {
      x: clamp(existing.x + ADD_OFFSET_PERCENT, 0, 100 - mosaicW),
      y: clamp(existing.y + ADD_OFFSET_PERCENT, 0, 100 - mosaicH),
    };
  }

  return { x: baseX, y: baseY };
}
