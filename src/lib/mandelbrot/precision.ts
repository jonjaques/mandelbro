import {
  add,
  div,
  make,
  mul,
  scientific,
  string,
  sub,
  type IBigFloat,
} from "bigfloat-esnext";
import type { ViewState } from "./types";

const DEFAULT_PRECISE_DIGITS = 48;
const PRECISION_SAFETY_DIGITS = 16;
const DEFAULT_ZOOM = 3.5;

export const ARTIFACT_MAGNIFICATION_THRESHOLD = 6.79e12;
export const AUTO_PRECISION_MAGNIFICATION_THRESHOLD = 5e12;

type PreciseValue = IBigFloat | string | number;

export function canonicalizeNumber(value: number): string {
  return Number.isFinite(value) ? value.toString() : "0";
}

export function approximateNumber(value: string): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function toPrecise(value: PreciseValue): IBigFloat {
  if (typeof value === "number") {
    return make(canonicalizeNumber(value));
  }

  return make(value);
}

export function preciseToString(value: IBigFloat): string {
  return string(value) ?? scientific(value);
}

export function addPrecise(a: PreciseValue, b: PreciseValue): string {
  return preciseToString(add(toPrecise(a), toPrecise(b)));
}

export function subPrecise(a: PreciseValue, b: PreciseValue): string {
  return preciseToString(sub(toPrecise(a), toPrecise(b)));
}

export function mulPrecise(a: PreciseValue, b: PreciseValue): string {
  return preciseToString(mul(toPrecise(a), toPrecise(b)));
}

export function divPrecise(
  a: PreciseValue,
  b: PreciseValue,
  precision: number,
): string {
  return preciseToString(div(toPrecise(a), toPrecise(b), precision));
}

export function getScientificExponent(value: string): number {
  const trimmed = value.trim().toLowerCase();
  if (!trimmed || trimmed === "0") return 0;

  const scientificMatch = /^([+-]?\d+(?:\.\d+)?)[e]([+-]?\d+)$/.exec(trimmed);
  if (scientificMatch) {
    const mantissa = scientificMatch[1] ?? "0";
    const exponent = Number(scientificMatch[2] ?? "0");
    const plainExponent = getScientificExponent(mantissa);
    return plainExponent + exponent;
  }

  const signless = trimmed.replace(/^[+-]/, "");
  const [intPartRaw, fracPartRaw = ""] = signless.split(".");
  const intPart = intPartRaw?.replace(/^0+/, "") ?? "";
  const fracPart = fracPartRaw;

  if (intPart.length > 0) {
    return intPart.length - 1;
  }

  const firstFracDigit = fracPart.search(/[1-9]/);
  if (firstFracDigit === -1) return 0;
  return -(firstFracDigit + 1);
}

export function getDivisionPrecisionForZoom(
  zoom: string,
  pixelSpan: number,
): number {
  const zoomExponent = getScientificExponent(zoom);
  const pixelScaleDigits = Math.ceil(Math.log10(Math.max(pixelSpan, 1)));
  const requiredDigits =
    Math.max(DEFAULT_PRECISE_DIGITS, -zoomExponent + pixelScaleDigits) +
    PRECISION_SAFETY_DIGITS;
  return -requiredDigits;
}

export function getMagnificationFromZoom(zoom: number | string): number {
  const numericZoom = typeof zoom === "number" ? zoom : approximateNumber(zoom);
  if (numericZoom <= 0) return Number.POSITIVE_INFINITY;
  return DEFAULT_ZOOM / numericZoom;
}

export function getMagnification(view: Pick<ViewState, "zoomPrecise">): number {
  return getMagnificationFromZoom(view.zoomPrecise);
}

export function resolvePrecisionMode(
  view: Pick<ViewState, "zoomPrecise" | "precisionMode">,
  mode = view.precisionMode,
): "native" | "precise" {
  if (mode === "native") return "native";
  if (mode === "precise") return "precise";
  return getMagnification(view) >= AUTO_PRECISION_MAGNIFICATION_THRESHOLD
    ? "precise"
    : "native";
}

export function shouldUseHighPrecision(
  view: Pick<ViewState, "zoomPrecise" | "precisionMode">,
  mode = view.precisionMode,
): boolean {
  return resolvePrecisionMode(view, mode) === "precise";
}

export function withPreciseFields(
  view: Omit<ViewState, "centerXPrecise" | "centerYPrecise" | "zoomPrecise"> &
    Partial<
      Pick<ViewState, "centerXPrecise" | "centerYPrecise" | "zoomPrecise">
    >,
): ViewState {
  return {
    ...view,
    centerXPrecise: view.centerXPrecise ?? canonicalizeNumber(view.centerX),
    centerYPrecise: view.centerYPrecise ?? canonicalizeNumber(view.centerY),
    zoomPrecise: view.zoomPrecise ?? canonicalizeNumber(view.zoom),
  };
}

export function preciseViewToApproximate(
  view: Pick<ViewState, "centerXPrecise" | "centerYPrecise" | "zoomPrecise">,
): Pick<ViewState, "centerX" | "centerY" | "zoom"> {
  return {
    centerX: approximateNumber(view.centerXPrecise),
    centerY: approximateNumber(view.centerYPrecise),
    zoom: approximateNumber(view.zoomPrecise),
  };
}

export function formatPreciseValue(value: string, fractionDigits = 8): string {
  const approx = approximateNumber(value);
  if (approx !== 0 && Number.isFinite(approx)) {
    if (Math.abs(approx) < 0.0001) return approx.toExponential(6);
    return approx.toFixed(fractionDigits);
  }

  if (value.includes("e") || value.includes("E")) return value;
  if (value.length <= 18) return value;

  return scientific(toPrecise(value));
}

export function applyPrecisePan(
  view: Pick<ViewState, "centerXPrecise" | "centerYPrecise" | "zoomPrecise">,
  dxCss: number,
  dyCss: number,
  rectHeight: number,
): Pick<ViewState, "centerXPrecise" | "centerYPrecise"> {
  const precision = getDivisionPrecisionForZoom(view.zoomPrecise, rectHeight);
  const scale = divPrecise(view.zoomPrecise, rectHeight, precision);

  return {
    centerXPrecise: subPrecise(view.centerXPrecise, mulPrecise(dxCss, scale)),
    centerYPrecise: subPrecise(view.centerYPrecise, mulPrecise(dyCss, scale)),
  };
}

export function applyPreciseZoomAroundPoint(
  view: Pick<ViewState, "centerXPrecise" | "centerYPrecise" | "zoomPrecise">,
  mouseX: number,
  mouseY: number,
  aspectRatio: number,
  zoomFactor: number,
): Pick<ViewState, "centerXPrecise" | "centerYPrecise" | "zoomPrecise"> {
  const aspect = canonicalizeNumber(aspectRatio);
  const mouseOffsetX = canonicalizeNumber(mouseX - 0.5);
  const mouseOffsetY = canonicalizeNumber(mouseY - 0.5);
  const newZoomPrecise = mulPrecise(view.zoomPrecise, zoomFactor);
  const worldX = addPrecise(
    view.centerXPrecise,
    mulPrecise(mulPrecise(mouseOffsetX, view.zoomPrecise), aspect),
  );
  const worldY = addPrecise(
    view.centerYPrecise,
    mulPrecise(mouseOffsetY, view.zoomPrecise),
  );

  return {
    centerXPrecise: subPrecise(
      worldX,
      mulPrecise(mulPrecise(mouseOffsetX, newZoomPrecise), aspect),
    ),
    centerYPrecise: subPrecise(
      worldY,
      mulPrecise(mouseOffsetY, newZoomPrecise),
    ),
    zoomPrecise: newZoomPrecise,
  };
}

export function applyPreciseRecenterZoom(
  view: Pick<ViewState, "centerXPrecise" | "centerYPrecise" | "zoomPrecise">,
  mouseX: number,
  mouseY: number,
  aspectRatio: number,
  zoomFactor: number,
): Pick<ViewState, "centerXPrecise" | "centerYPrecise" | "zoomPrecise"> {
  const aspect = canonicalizeNumber(aspectRatio);
  const mouseOffsetX = canonicalizeNumber(mouseX - 0.5);
  const mouseOffsetY = canonicalizeNumber(mouseY - 0.5);
  const newZoomPrecise = mulPrecise(view.zoomPrecise, zoomFactor);

  return {
    centerXPrecise: addPrecise(
      view.centerXPrecise,
      mulPrecise(mulPrecise(mouseOffsetX, view.zoomPrecise), aspect),
    ),
    centerYPrecise: addPrecise(
      view.centerYPrecise,
      mulPrecise(mouseOffsetY, view.zoomPrecise),
    ),
    zoomPrecise: newZoomPrecise,
  };
}
