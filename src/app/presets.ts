import type { Frame, Page } from "./types";

export const INNER_LOCKED_FRAME_ID = -999999;
export const INNER_LOCKED_FRAME_MARGIN = 5;

export function createInnerLockedFrame(): Frame {
  const m = INNER_LOCKED_FRAME_MARGIN;

  return {
    id: INNER_LOCKED_FRAME_ID,
    x: m,
    y: m,
    w: 100 - m * 2,
    h: 100 - m * 2,
    borderEnabled: false,
    image: null,
    imageOffsetX: 0,
    imageOffsetY: 0,
    imageScale: 1,
    imageNaturalWidth: 0,
    imageNaturalHeight: 0,
    topTilt: 0,
    rightTilt: 0,
    bottomTilt: 0,
    leftTilt: 0,
  };
}

export function createDefaultFrame(id: number): Frame {
  return {
    id,
    x: 5,
    y: 5,
    w: 90,
    h: 90,
    borderEnabled: true,
    image: null,
    imageOffsetX: 0,
    imageOffsetY: 0,
    imageScale: 1,
    imageNaturalWidth: 0,
    imageNaturalHeight: 0,
    topTilt: 0,
    rightTilt: 0,
    bottomTilt: 0,
    leftTilt: 0,
  };
}

export function createNewPage(id: number): Page {
  return {
    id,
    visible: true,
    frames: [
      createInnerLockedFrame(),
      createDefaultFrame(id + 1),
    ],
    bubbles: [],
    sounds: [],
  };
}