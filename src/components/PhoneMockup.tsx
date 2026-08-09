import type { ReactNode } from "react";
import { useCallback, useLayoutEffect, useRef, useState } from "react";

// 固定使用 375 CSS px 的 iPhone layout viewport，外层仅做视觉缩放。
export const PHONE_SCREEN_WIDTH = 375;
const BORDER = 20;
export const PHONE_FRAME_WIDTH = PHONE_SCREEN_WIDTH + BORDER * 2; // 415
export const PHONE_FRAME_HEIGHT = 850;

// 外壳
const OUTER_RADIUS = 70;
const OUTER_LEFT = 2;
const OUTER_RIGHT = PHONE_FRAME_WIDTH - 3;

// 屏幕位置与圆角
const SCREEN_X = BORDER;
const SCREEN_Y = BORDER;
const SCREEN_RADIUS = OUTER_RADIUS - BORDER;
const SCREEN_HEIGHT = PHONE_FRAME_HEIGHT - BORDER * 2;

// 内壳
const INNER_OFFSET = 4;
const INNER_RADIUS = 67;
const INNER_LEFT = OUTER_LEFT + INNER_OFFSET;
const INNER_RIGHT = OUTER_RIGHT - INNER_OFFSET;
const INNER_TOP = INNER_OFFSET;

// 按键
const POWER_BUTTON_LEFT = PHONE_FRAME_WIDTH - 3;

// 灵动岛
const NOTCH_WIDTH = 100;
const NOTCH_HEIGHT = 30;
const NOTCH_Y = 28;
const NOTCH_RADIUS = NOTCH_HEIGHT / 2;
const NOTCH_X = (PHONE_FRAME_WIDTH - NOTCH_WIDTH) / 2;

// 摄像头
const CAMERA_RADIUS_OUTER = 8;
const CAMERA_RADIUS_INNER = 4;
const CAMERA_Y = NOTCH_Y + NOTCH_HEIGHT / 2;
const CAMERA_X = NOTCH_X + NOTCH_WIDTH - 24;

// 顶部装饰条
const TOP_BAR_WIDTH = 80;
const TOP_BAR_X = (PHONE_FRAME_WIDTH - TOP_BAR_WIDTH) / 2;

const BEZIER = 0.552;

const LEFT_PCT = (SCREEN_X / PHONE_FRAME_WIDTH) * 100;
const TOP_PCT = (SCREEN_Y / PHONE_FRAME_HEIGHT) * 100;
const WIDTH_PCT = (PHONE_SCREEN_WIDTH / PHONE_FRAME_WIDTH) * 100;
const HEIGHT_PCT = (SCREEN_HEIGHT / PHONE_FRAME_HEIGHT) * 100;
const RADIUS_H = (SCREEN_RADIUS / PHONE_SCREEN_WIDTH) * 100;
const RADIUS_V = (SCREEN_RADIUS / SCREEN_HEIGHT) * 100;

export interface PhonePreviewLayout {
  scale: number;
  stageWidth: number;
  stageHeight: number;
  frameWidth: number;
  frameHeight: number;
  screenWidth: number;
  transform: string;
}

export function calculatePhonePreviewLayout(
  containerWidth: number,
  containerHeight: number,
): PhonePreviewLayout {
  const scale = Math.min(
    containerWidth / PHONE_FRAME_WIDTH,
    containerHeight / PHONE_FRAME_HEIGHT,
    1,
  );
  return {
    scale,
    stageWidth: PHONE_FRAME_WIDTH * scale,
    stageHeight: PHONE_FRAME_HEIGHT * scale,
    frameWidth: PHONE_FRAME_WIDTH,
    frameHeight: PHONE_FRAME_HEIGHT,
    screenWidth: PHONE_SCREEN_WIDTH,
    transform: `scale(${scale})`,
  };
}

function generateOuterPath(): string {
  const r = OUTER_RADIUS,
    c = r * BEZIER,
    l = OUTER_LEFT,
    right = OUTER_RIGHT,
    bottom = PHONE_FRAME_HEIGHT;
  return `M${l} ${r}C${l} ${r - c} ${l + r - c} 0 ${l + r} 0H${right - r}C${right - r + c} 0 ${right} ${r - c} ${right} ${r}V${bottom - r}C${right} ${bottom - r + c} ${right - r + c} ${bottom} ${right - r} ${bottom}H${l + r}C${l + r - c} ${bottom} ${l} ${bottom - r + c} ${l} ${bottom - r}V${r}Z`;
}

function generateInnerPath(): string {
  const r = INNER_RADIUS,
    c = r * BEZIER,
    l = INNER_LEFT,
    right = INNER_RIGHT,
    t = INNER_TOP,
    bottom = PHONE_FRAME_HEIGHT - INNER_OFFSET;
  return `M${l} ${t + r}C${l} ${t + r - c} ${l + r - c} ${t} ${l + r} ${t}H${right - r}C${right - r + c} ${t} ${right} ${t + r - c} ${right} ${t + r}V${bottom - r}C${right} ${bottom - r + c} ${right - r + c} ${bottom} ${right - r} ${bottom}H${l + r}C${l + r - c} ${bottom} ${l} ${bottom - r + c} ${l} ${bottom - r}V${t + r}Z`;
}

function generateScreenPath(): string {
  const r = SCREEN_RADIUS,
    c = r * BEZIER,
    l = SCREEN_X,
    right = SCREEN_X + PHONE_SCREEN_WIDTH,
    t = SCREEN_Y,
    bottom = SCREEN_Y + SCREEN_HEIGHT;
  return `M${l} ${t + r}C${l} ${t + r - c} ${l + r - c} ${t} ${l + r} ${t}H${right - r}C${right - r + c} ${t} ${right} ${t + r - c} ${right} ${t + r}V${bottom - r}C${right} ${bottom - r + c} ${right - r + c} ${bottom} ${right - r} ${bottom}H${l + r}C${l + r - c} ${bottom} ${l} ${bottom - r + c} ${l} ${bottom - r}V${t + r}Z`;
}

function generateNotchPath(): string {
  const l = NOTCH_X,
    r = NOTCH_X + NOTCH_WIDTH,
    t = NOTCH_Y,
    b = NOTCH_Y + NOTCH_HEIGHT,
    radius = NOTCH_RADIUS,
    c = radius * BEZIER;
  return `M${l} ${t + radius}C${l} ${t + radius - c} ${l + radius - c} ${t} ${l + radius} ${t}H${r - radius}C${r - radius + c} ${t} ${r} ${t + radius - c} ${r} ${t + radius}V${b - radius}C${r} ${b - radius + c} ${r - radius + c} ${b} ${r - radius} ${b}H${l + radius}C${l + radius - c} ${b} ${l} ${b - radius + c} ${l} ${b - radius}V${t + radius}Z`;
}

const outerPath = generateOuterPath();
const innerPath = generateInnerPath();
const screenPath = generateScreenPath();
const notchPath = generateNotchPath();

interface Props {
  children: ReactNode;
}

export function PhoneMockup({ children }: Props) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState(() => (
    calculatePhonePreviewLayout(PHONE_FRAME_WIDTH, PHONE_FRAME_HEIGHT)
  ));

  const updateScale = useCallback(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const { clientWidth, clientHeight } = el;
    setLayout(calculatePhonePreviewLayout(clientWidth, clientHeight));
  }, []);

  useLayoutEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    updateScale();
    const observer = new ResizeObserver(updateScale);
    observer.observe(el);
    return () => observer.disconnect();
  }, [updateScale]);

  return (
    <div ref={wrapperRef} className="windpost-phone-wrapper">
      <div
        className="windpost-phone-stage"
        style={{
          width: layout.stageWidth,
          height: layout.stageHeight,
        }}
      >
        <div
          className="windpost-phone-frame"
          style={{
            width: layout.frameWidth,
            height: layout.frameHeight,
            transform: layout.transform,
          }}
        >
          {/* 屏幕内容区 */}
          <div
            className="windpost-phone-screen"
            style={{
              left: `${LEFT_PCT}%`,
              top: `${TOP_PCT}%`,
              width: `${WIDTH_PCT}%`,
              height: `${HEIGHT_PCT}%`,
              borderRadius: `${RADIUS_H}% / ${RADIUS_V}%`,
            }}
          >
            {children}
          </div>

          {/* SVG 外壳 */}
          <svg
            viewBox={`0 0 ${PHONE_FRAME_WIDTH} ${PHONE_FRAME_HEIGHT}`}
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="windpost-phone-svg"
            style={{ transform: "translateZ(0)" }}
          >
          <g mask="url(#windpost-screen-punch)">
            <path d={outerPath} fill="#404040" />
            <path
              d="M0 171C0 170.448 0.447715 170 1 170H3V204H1C0.447715 204 0 203.552 0 203V171Z"
              fill="#404040"
            />
            <path
              d="M1 234C1 233.448 1.44772 233 2 233H3.5V300H2C1.44772 300 1 299.552 1 299V234Z"
              fill="#404040"
            />
            <path
              d="M1 319C1 318.448 1.44772 318 2 318H3.5V385H2C1.44772 385 1 384.552 1 384V319Z"
              fill="#404040"
            />
            <path
              d={`M${POWER_BUTTON_LEFT} 279H${POWER_BUTTON_LEFT + 2}C${POWER_BUTTON_LEFT + 2.552} 279 ${PHONE_FRAME_WIDTH} 279.448 ${PHONE_FRAME_WIDTH} 280V384C${PHONE_FRAME_WIDTH} 384.552 ${POWER_BUTTON_LEFT + 2.552} 385 ${POWER_BUTTON_LEFT + 2} 385H${POWER_BUTTON_LEFT}V279Z`}
              fill="#404040"
            />
            <path d={innerPath} fill="#262626" />
          </g>

          <path
            opacity="0.5"
            d={`M${TOP_BAR_X} 5H${TOP_BAR_X + TOP_BAR_WIDTH}V5.5C${TOP_BAR_X + TOP_BAR_WIDTH} 6.60457 ${TOP_BAR_X + TOP_BAR_WIDTH - 0.895} 7.5 ${TOP_BAR_X + TOP_BAR_WIDTH - 2} 7.5H${TOP_BAR_X + 2}C${TOP_BAR_X + 0.895} 7.5 ${TOP_BAR_X} 6.60457 ${TOP_BAR_X} 5.5V5Z`}
            fill="#404040"
          />
          <path
            d={screenPath}
            fill="#404040"
            stroke="#404040"
            strokeWidth="0.5"
            mask="url(#windpost-screen-punch)"
          />
          <path d={notchPath} fill="#262626" />
          <circle
            cx={CAMERA_X}
            cy={CAMERA_Y}
            r={CAMERA_RADIUS_OUTER}
            fill="#262626"
          />
          <circle
            cx={CAMERA_X}
            cy={CAMERA_Y}
            r={CAMERA_RADIUS_INNER}
            fill="#404040"
          />

          <defs>
            <mask id="windpost-screen-punch" maskUnits="userSpaceOnUse">
              <rect
                x="0"
                y="0"
                width={PHONE_FRAME_WIDTH}
                height={PHONE_FRAME_HEIGHT}
                fill="white"
              />
              <rect
                x={SCREEN_X}
                y={SCREEN_Y}
                width={PHONE_SCREEN_WIDTH}
                height={SCREEN_HEIGHT}
                rx={SCREEN_RADIUS}
                ry={SCREEN_RADIUS}
                fill="black"
              />
            </mask>
          </defs>
          </svg>
        </div>
      </div>
    </div>
  );
}
