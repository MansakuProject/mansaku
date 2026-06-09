export type FrameTiltValue = -10 | -5 | 0 | 5 | 10;
export type SoundTiltValue = -30 | -20 | -10 | 0 | 10 | 20 | 30;

export type PercentPoint = {
  x: number;
  y: number;
};

export type FramePolygonPoints = [
  PercentPoint,
  PercentPoint,
  PercentPoint,
  PercentPoint
];

export type FrameBase = {
  id: number;
  x: number;
  y: number;
  w: number;
  h: number;
};

export type Frame = FrameBase & {
  borderEnabled: boolean;
  frameBorderVisible?: boolean;

  image: string | null;
  imageId?: string;
  imageOffsetX: number;
  imageOffsetY: number;
  imageScale: number;
  imageNaturalWidth: number;
  imageNaturalHeight: number;

  topTilt: FrameTiltValue;
  rightTilt: FrameTiltValue;
  bottomTilt: FrameTiltValue;
  leftTilt: FrameTiltValue;

  points?: FramePolygonPoints;
};

export type BubbleType =
  | "ellipse"
  | "heptagon"
  | "explosion"
  | "cloud"
  | "wave"
  | "rect"
  | "thought"
  | "electronic"
  | "flash"
  | "uniFlash";

export type BubbleShape =
  | "ellipse"
  | "heptagon"
  | "rect"
  | "cornerSpiky"
  | "cloud"
  | "wave"
  | "electronic"
  | "flash"
  | "uniFlash";

export type TailMode = "outside" | "inside";
export type TailStyle = "triangle" | "thought" | "electronic" | "none";
export type BubbleBackgroundColor = "white" | "black" | "transparent";

export type BubbleRuby = {
  start: number;
  end: number;
  text: string;
};

export type Bubble = {
  id: number;
  x: number;
  y: number;
  w: number;
  h: number;
  text: string;
  rubies?: BubbleRuby[];
  type: BubbleType;
  shape: BubbleShape;
  fontSize: number;
  fontFamily?: string;
  writingMode?: "vertical" | "horizontal";
  tailEnabled: boolean;
  tailStyle: TailStyle;
  tailAngle: number;
  tailLength: number;
  tailWidth: number;
  tailMode: TailMode;
  layer: number;
  clipToFrame?: boolean;
  textColor?: "black" | "white";
  whiteTone?: number;
  blackTone?: number;
  backgroundColor?: BubbleBackgroundColor;
  opacity?: number;
  tone?: "none" | "white" | "black";
};

export type ClipboardItem =
  | {
      mode: "copy" | "cut";
      bubbles?: Bubble[];
      sounds?: SoundText[];
      frames?: Frame[];
    }
  | null;

export type SoundText = {
  id: number;
  x: number;
  y: number;
  text: string;
  fontSize: number;
  fontFamily?: string;
  rotate: number;
  writingMode?: "vertical" | "horizontal";
  color: string;
  outlineColor: string;
  outlineWidth: number;
  topTilt: SoundTiltValue;
  rightTilt: SoundTiltValue;
  bottomTilt: SoundTiltValue;
  leftTilt: SoundTiltValue;
  curveX: number;
  curveY: number;
  layer: number;
  clipToFrame?: boolean;
};

export type Page = {
  id: number;
  visible?: boolean;
  frames: Frame[];
  bubbles: Bubble[];
  sounds: SoundText[];
};

export type ProjectData = {
  version: number;
  pages: Page[];
  imageAssets?: Record<string, string>;
  hasCovers?: boolean;
  showPageNumbers?: boolean;
};

export type SelectedTarget =
  | { kind: "bubble"; id: number }
  | { kind: "sound"; id: number }
  | null;

export type DragState =
  | {
      kind: "frame-move";
      id: number;
      startMouseX: number;
      startMouseY: number;
      startX: number;
      startY: number;
      hasMoved: boolean;
      historyPushed: boolean;
    }
  | {
      kind: "frame-resize";
      id: number;
      resizeMode:
        | "left"
        | "right"
        | "top"
        | "bottom"
        | "top-left"
        | "top-right"
        | "bottom-left"
        | "bottom-right";
      startMouseX: number;
      startMouseY: number;
      startW: number;
      startH: number;
      startX: number;
      startY: number;
      startLeftEdgeX: number;
      startRightEdgeX: number;
      startTopEdgeY: number;
      startBottomEdgeY: number;
      linkedBuddies: Array<{
        id: number;
        edge: "left" | "right" | "top" | "bottom";
      }>;
      snapLock:
        | {
            edge: "left" | "right" | "top" | "bottom";
            normal: PercentPoint;
            lockMouseProjection: number;
            releaseDistance: number;
            lockedEdgeProjection: number;
          }
        | null;
      hasMoved: boolean;
      historyPushed: boolean;
    }
  | {
      kind: "frame-pan";
      id: number;
      startMouseX: number;
      startMouseY: number;
      startOffsetX: number;
      startOffsetY: number;
      hasMoved: boolean;
      historyPushed: boolean;
    }
  | {
      kind: "frame-tilt";
      id: number;
      edge: "top" | "right" | "bottom" | "left";
      startMouseX: number;
      startMouseY: number;
      startTilt: FrameTiltValue;
      startFrame: Frame;
      linkedFrameIds: number[];
      hasMoved: boolean;
      historyPushed: boolean;
    }
  | {
      kind: "multi-move";
      items: Array<{
        kind: "frame" | "bubble" | "sound";
        id: number;
        startX: number;
        startY: number;
      }>;
      anchorKind: "frame" | "bubble" | "sound";
      anchorId: number;
      offsetX: number;
      offsetY: number;
      copyGhost?: {
        frames: Frame[];
        bubbles: Bubble[];
        sounds: SoundText[];
      };
      hasMoved: boolean;
      historyPushed: boolean;
    }
  | {
      kind: "bubble-move";
      items: Array<{
        kind: "bubble" | "sound";
        id: number;
        startX: number;
        startY: number;
      }>;
      anchorKind: "bubble" | "sound";
      anchorId: number;
      offsetX: number;
      offsetY: number;
      copyGhost?: {
        frames: Frame[];
        bubbles: Bubble[];
        sounds: SoundText[];
      };
      hasMoved: boolean;
      historyPushed: boolean;
    }
  | {
      kind: "bubble-resize";
      id: number;
      resizeMode:
        | "left"
        | "right"
        | "top"
        | "bottom"
        | "top-left"
        | "top-right"
        | "bottom-left"
        | "bottom-right";
      startMouseX: number;
      startMouseY: number;
      startX: number;
      startY: number;
      startW: number;
      startH: number;
      hasMoved: boolean;
      historyPushed: boolean;
    }
  | {
      kind: "bubble-tail";
      id: number;
      hasMoved: boolean;
      historyPushed: boolean;
    }
  | {
      kind: "bubble-tail-width";
      id: number;
      hasMoved: boolean;
      historyPushed: boolean;
    }
  | {
      kind: "sound-move";
      items: Array<{
        kind: "bubble" | "sound";
        id: number;
        startX: number;
        startY: number;
      }>;
      anchorKind: "bubble" | "sound";
      anchorId: number;
      offsetX: number;
      offsetY: number;
      copyGhost?: {
        frames: Frame[];
        bubbles: Bubble[];
        sounds: SoundText[];
      };
      hasMoved: boolean;
      historyPushed: boolean;
    }
  | {
      kind: "sound-resize";
      id: number;
      startMouseDistance: number;
      startFontSize: number;
      hasMoved: boolean;
      historyPushed: boolean;
    }
  | {
      kind: "sound-rotate";
      id: number;
      rotateOffset: number;
      hasMoved: boolean;
      historyPushed: boolean;
    }
  | {
      kind: "sound-tilt";
      id: number;
      edge: "top" | "right" | "bottom" | "left";
      startMouseX: number;
      startMouseY: number;
      startTilt: SoundTiltValue;
      hasMoved: boolean;
      historyPushed: boolean;
    }
  | {
      kind: "sound-curve";
      id: number;
      axis: "x" | "y";
      startMouseX: number;
      startMouseY: number;
      startCurveX: number;
      startCurveY: number;
      hasMoved: boolean;
      historyPushed: boolean;
    }
  | null;

export type ContextMenuTarget =
  | { kind: "canvas" }
  | { kind: "bubble"; id: number }
  | { kind: "sound"; id: number }
  | { kind: "frame"; id: number };

export type ContextMenuState =
  | {
      visible: true;
      x: number;
      y: number;
      pageXPercent: number | null;
      pageYPercent: number | null;
      target: ContextMenuTarget;
    }
  | {
      visible: false;
      x: 0;
      y: 0;
      pageXPercent: null;
      pageYPercent: null;
      target: null;
    };

    