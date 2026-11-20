export type PresetSlug = 'all' | 'research' | 'cs' | '837';

export interface WaveColors {
  horizon: string;
  wave: string;
  crest: string;
}

export interface ChannelToken {
  light: string;
  lightHi: string;
  lightRgb: string;
  dark: string;
  darkHi: string;
  darkRgb: string;
  presetName: string;
  wave: WaveColors;
}

export const PALETTE = {
  neutral: {
    light: {
      bg: '#f7f6f2',
      elev: '#ffffff',
      accent: '#18181b',
      accentStrong: '#09090b',
      accentSoft: 'rgba(24, 24, 27, 0.08)',
      buttonText: '#ffffff',
    },
    dark: {
      bg: '#050505',
      elev: '#0e0e10',
      accent: '#e4e4e7',
      accentStrong: '#fafafa',
      accentSoft: 'rgba(228, 228, 231, 0.12)',
      buttonText: '#09090b',
    },
  },
  channels: {
    all: {
      light: '#7c68b8',
      lightHi: '#9480cf',
      lightRgb: '124 104 184',
      dark: '#9c88d8',
      darkHi: '#b8a6eb',
      darkRgb: '156 136 216',
      presetName: 'Dusk',
      wave: {
        horizon: '#5227ff',
        wave: '#c084fc',
        crest: '#f3e8ff',
      },
    },
    research: {
      light: '#3b5fd0',
      lightHi: '#5b7ef0',
      lightRgb: '59 95 208',
      dark: '#7aa2ff',
      darkHi: '#93b4ff',
      darkRgb: '122 162 255',
      presetName: 'Indigo',
      wave: {
        horizon: '#2748b3',
        wave: '#5b7ef0',
        crest: '#dbeafe',
      },
    },
    cs: {
      light: '#c2416b',
      lightHi: '#e05582',
      lightRgb: '194 65 107',
      dark: '#f26b94',
      darkHi: '#ff8aa8',
      darkRgb: '242 107 148',
      presetName: 'Dune',
      wave: {
        horizon: '#9f2c53',
        wave: '#e05582',
        crest: '#ffe4e6',
      },
    },
    '837': {
      light: '#c2410c',
      lightHi: '#ea580c',
      lightRgb: '194 65 12',
      dark: '#f08050',
      darkHi: '#fb923c',
      darkRgb: '240 128 80',
      presetName: 'Ember',
      wave: {
        horizon: '#9a3412',
        wave: '#ea580c',
        crest: '#ffedd5',
      },
    },
  } satisfies Record<PresetSlug, ChannelToken>,
  study: {
    light: '#b84214',
    lightStrong: '#9a3412',
    lightSoft: 'rgba(184, 66, 20, 0.14)',
    dark: '#f08050',
    darkStrong: '#fb923c',
    darkSoft: 'rgba(240, 128, 80, 0.18)',
    articleDarkMuted: '#d97348',
  },
  gold: {
    light: '#b87c0c',
    dark: '#e6b450',
  },
  syntaxFunction: {
    light: '#0550ae',
    dark: '#7dd3fc',
  },
  heatmap: {
    light: {
      site: '#222428',
      paper: '#19399a',
      tech: '#b92758',
      study: '#d95a26',
      revision: '#d6b818',
    },
    dark: {
      site: '#414450',
      paper: '#2958d9',
      tech: '#e24d7f',
      study: '#f58b5b',
      revision: '#f0d024',
    },
  },
} as const;
