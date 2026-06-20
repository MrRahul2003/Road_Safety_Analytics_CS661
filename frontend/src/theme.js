// theme.js — Colorblind-safe palettes (the "Colorblind" theme pillar)
// All schemes below are deuteranopia / protanopia / tritanopia distinguishable.
// Sequential scales use cividis, which is perceptually uniform AND CVD-safe.

import { interpolateCividis } from "d3-scale-chromatic";
import { scaleSequential } from "d3-scale";

// Okabe–Ito (the reference 8-colour CVD-safe qualitative palette)
export const OKABE_ITO = {
  black: "#000000",
  orange: "#E69F00",
  skyblue: "#56B4E9",
  green: "#009E73",
  yellow: "#F0E442",
  blue: "#0072B2",
  vermillion: "#D55E00",
  purple: "#CC79A7",
};

// Paul Tol "bright" — second CVD-safe option offered in the UI
export const TOL_BRIGHT = {
  blue: "#4477AA",
  cyan: "#66CCEE",
  green: "#228833",
  yellow: "#CCBB44",
  red: "#EE6677",
  purple: "#AA3377",
  grey: "#BBBBBB",
};

// Severity is ordinal (Slight < Serious < Fatal). Each palette keeps the
// low→high mapping intuitive (cool → warm) while staying CVD-distinguishable.
export const PALETTES = {
  "okabe-ito": {
    label: "Okabe–Ito",
    severity: {
      "Slight Injury": OKABE_ITO.skyblue,
      "Serious Injury": OKABE_ITO.orange,
      "Fatal injury": OKABE_ITO.vermillion,
    },
    categorical: [
      OKABE_ITO.blue, OKABE_ITO.orange, OKABE_ITO.green, OKABE_ITO.purple,
      OKABE_ITO.vermillion, OKABE_ITO.skyblue, OKABE_ITO.yellow, "#999999",
    ],
  },
  "tol-bright": {
    label: "Tol Bright",
    severity: {
      "Slight Injury": TOL_BRIGHT.blue,
      "Serious Injury": TOL_BRIGHT.yellow,
      "Fatal injury": TOL_BRIGHT.red,
    },
    categorical: [
      TOL_BRIGHT.blue, TOL_BRIGHT.cyan, TOL_BRIGHT.green, TOL_BRIGHT.yellow,
      TOL_BRIGHT.red, TOL_BRIGHT.purple, TOL_BRIGHT.grey, "#000000",
    ],
  },
};

export const SEVERITY_ORDER = ["Slight Injury", "Serious Injury", "Fatal injury"];

// Sequential CVD-safe scale (cividis) for heatmaps / choropleth-style encodings.
export function cividis(domainMax = 1) {
  return scaleSequential(interpolateCividis).domain([0, domainMax]);
}

export const UI = {
  bg: "#0A0E14",
  panel: "#121821",
  panelAlt: "#0F151D",
  border: "#1F2935",
  borderBright: "#2C3A4A",
  text: "#E6EDF3",
  textDim: "#8B98A8",
  textFaint: "#5A6675",
  accent: "#E69F00", // amber accent — itself CVD-safe, ties into the theme
};
