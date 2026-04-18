/*
 * banner.ts -- the 3D-vibe welcome banner for the CLI / REPL.
 *
 * Layout: isometric 4-point starburst icon on the left + a gradient
 * "A W E S O M E" eyebrow line above the chunky ANSI Shadow wordmark
 * "MD-TO-PDF" on the right, all colored with a multi-stop 24-bit RGB
 * gradient (terracotta -> coral -> olive -> warm teal). The starburst
 * glyph (U+2726) is also re-used in the REPL prompt as the compact
 * brand mark for awesome-md-to-pdf.
 *
 * Everything is hand-assembled so there is no runtime dep on figlet.
 * Graceful fallbacks:
 *   - Narrow terminals (< 90 cols)     -> compact single-line wordmark
 *                                         with a gradient "AWESOME" tag.
 *   - Non-TTY / no-color / --no-banner -> plain text (chalk handles that).
 */

import chalk from 'chalk';

// ---------------------------------------------------------------------------
// Icon -- a 4-point isometric starburst, 6 rows tall to match the wordmark.
//
// Each row is rendered as four regions (outline / top face / left body /
// right body) that we paint with distinct RGB stops so the eye reads the
// shape as a crystalline 3D sparkle. The glyph is the visual anchor of
// the awesome-md-to-pdf rebrand and is mirrored in the REPL prompt as
// a compact single-char "✦" brand mark.
// ---------------------------------------------------------------------------

// Face palette (24-bit RGB).
const FACE = {
  T: [232, 165, 144] as RGB, // top face highlight (light coral)
  L: [201, 100, 66] as RGB,  // left face (terracotta, darkest)
  R: [232, 198, 160] as RGB, // right face (warm sand, mid)
  H: [169, 82, 54] as RGB,   // outline / bevel (deep terracotta)
};

// ---------------------------------------------------------------------------
// Wordmark -- pre-baked ANSI Shadow figlet for "md-to-pdf"
// ---------------------------------------------------------------------------

const WORDMARK: string[] = [
  '███╗   ███╗██████╗       ████████╗ ██████╗        ██████╗ ██████╗ ███████╗',
  '████╗ ████║██╔══██╗      ╚══██╔══╝██╔═══██╗       ██╔══██╗██╔══██╗██╔════╝',
  '██╔████╔██║██║  ██║ ────▶   ██║   ██║   ██║ ────▶ ██████╔╝██║  ██║█████╗  ',
  '██║╚██╔╝██║██║  ██║         ██║   ██║   ██║       ██╔═══╝ ██║  ██║██╔══╝  ',
  '██║ ╚═╝ ██║██████╔╝         ██║   ╚██████╔╝       ██║     ██████╔╝██║     ',
  '╚═╝     ╚═╝╚═════╝          ╚═╝    ╚═════╝        ╚═╝     ╚═════╝ ╚═╝     ',
];

const COMPACT_WORDMARK = '  m d - t o - p d f  ';

// ---------------------------------------------------------------------------
// Gradient stops for the wordmark (left -> right)
// ---------------------------------------------------------------------------

type RGB = [number, number, number];

const WORDMARK_STOPS: RGB[] = [
  [201, 100, 66],   // terracotta
  [217, 119, 87],   // coral
  [198, 142, 92],   // warm amber (bridge)
  [107, 122, 90],   // olive
  [90, 122, 138],   // warm teal
];

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface BannerOptions {
  /** Force plain text output (no color, no art). Useful for CI or --no-banner. */
  noColor?: boolean;
  /** Force the compact layout even on wide terminals. */
  compact?: boolean;
  /** Terminal width override (defaults to process.stdout.columns). */
  width?: number;
}

/** Render the full welcome banner to a single string. */
export function renderBanner(opts: BannerOptions = {}): string {
  const width = opts.width ?? (process.stdout.columns || 100);
  const plain = Boolean(opts.noColor) || !chalk.supportsColor;
  const compact = Boolean(opts.compact) || width < 90;

  const paint = (s: string, rgb: RGB): string =>
    plain ? s : chalk.rgb(rgb[0], rgb[1], rgb[2])(s);

  if (compact) return renderCompact(paint, plain);

  const iconWidth = 10;
  const gap = '    ';
  const iconLines = renderIcon(paint);
  const wordmarkLines = renderWordmark(paint);

  // Pad the icon to match the 6-line wordmark height (prepend a blank row).
  const topPad = Math.max(0, wordmarkLines.length - iconLines.length);
  const paddedIcon: string[] = [];
  for (let i = 0; i < topPad; i++) paddedIcon.push(' '.repeat(iconWidth));
  paddedIcon.push(...iconLines);

  const body: string[] = [];
  for (let i = 0; i < wordmarkLines.length; i++) {
    const left = paddedIcon[i] ?? ' '.repeat(iconWidth);
    const right = wordmarkLines[i];
    body.push('  ' + left + gap + right);
  }

  // Eyebrow sits above the wordmark, centered within the wordmark column
  // so it reads as a caption for the MD-TO-PDF mark.
  const wordmarkWidth = wordmarkLines[0]?.length ?? 0;
  const wordmarkLeftPad = 2 + iconWidth + gap.length;
  const eyebrowLine = renderEyebrow(plain, wordmarkLeftPad, wordmarkWidth);

  return [
    '',
    eyebrowLine,
    '',
    ...body,
    '',
    ...renderTaglineLines(paint, plain),
    '',
  ].join('\n');
}

/** Short one-liner used post-convert. */
export function renderTagline(): string {
  return chalk.hex('#c96442')('  awesome-md-to-pdf ') + chalk.hex('#87867f')('· editorial markdown to PDF · themed by any DESIGN.md');
}

// ---------------------------------------------------------------------------
// Internal renderers
// ---------------------------------------------------------------------------

function renderCompact(paint: Paint, plain: boolean): string {
  const lines: string[] = [];
  lines.push('');
  lines.push('  ' + gradientWord('\u2726 A W E S O M E \u2726', plain));
  lines.push('');
  lines.push('  ' + paint('\u2726', FACE.T) + paint('\u2727', FACE.R) + paint('\u2726', FACE.L) + '  ' + gradientWord(COMPACT_WORDMARK.trim(), plain));
  lines.push('');
  lines.push(...renderTaglineLines(paint, plain));
  lines.push('');
  return lines.join('\n');
}

function renderIcon(paint: Paint): string[] {
  // 6-row isometric 4-point starburst. Each cell is placed in one of four
  // regions:
  //   H = outline   (deep terracotta)
  //   T = top face  (light coral)
  //   L = left body (terracotta)
  //   R = right body (warm sand)
  //   . = whitespace
  //
  // Rendering the regions in a structured way (rather than hand-typing
  // escape codes per character) keeps the geometry obvious and easy to
  // tweak. The shape is a diamond star that tapers to points at top and
  // bottom, widest across rows 3-4 where the left and right facets meet
  // along a central top-face ridge.
  const geometry: string[] = [
    '....HH....',
    '...HTTH...',
    'HLLLTTRRRH',
    'HLLLTTRRRH',
    '...HTTH...',
    '....HH....',
  ];

  const glyphs: Record<string, string> = {
    H: '█',
    T: '█',
    L: '█',
    R: '█',
    '.': ' ',
  };

  const colorOf: Record<string, RGB | null> = {
    H: FACE.H,
    T: FACE.T,
    L: FACE.L,
    R: FACE.R,
    '.': null,
  };

  return geometry.map((row) =>
    [...row]
      .map((cell) => {
        const glyph = glyphs[cell] ?? ' ';
        const color = colorOf[cell];
        return color ? paint(glyph, color) : glyph;
      })
      .join('')
  );
}

function renderWordmark(paint: Paint): string[] {
  return WORDMARK.map((line) => gradientWord(line, false));
}

function renderEyebrow(plain: boolean, leftPad: number, columnWidth: number): string {
  // Letter-spaced "AWESOME" flanked by starburst glyphs, painted with the
  // same WORDMARK_STOPS gradient as the block letters below so the whole
  // banner reads as one coordinated mark.
  const text = '\u2726  A W E S O M E  \u2726';
  const visibleLen = [...text].length;
  const pad = Math.max(0, Math.floor((columnWidth - visibleLen) / 2));
  return ' '.repeat(leftPad + pad) + gradientWord(text, plain);
}

function renderTaglineLines(paint: Paint, plain: boolean): string[] {
  void paint;
  const muted = (s: string) => (plain ? s : chalk.hex('#87867f')(s));
  const em = (s: string) => (plain ? s : chalk.hex('#c96442')(s));
  // Body uses the terminal's default foreground (no hex) so the tagline is
  // legible on both light and dark terminals. See src/tty-colors.ts for
  // the project-wide rule.
  const body = (s: string) => s;
  const link = (s: string) => (plain ? s : chalk.hex('#5a7a8a')(s));

  return [
    '  ' + em('The editorial markdown-to-PDF tool') + muted('  ·  themed by any DESIGN.md'),
    '',
    '  ' + muted('▸') + ' ' + body('Browse designs at  ') + link('https://getdesign.md'),
    '  ' + muted('▸') + ' ' + body('Quick convert:     ') + muted('awesome-md-to-pdf ') + body('<dir> --mode light --toc --cover'),
    '  ' + muted('▸') + ' ' + body('Chat mode: type  ') + em('/help') + body('  for commands'),
  ];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type Paint = (s: string, rgb: RGB) => string;

function gradientWord(line: string, plain: boolean): string {
  const chars = [...line];
  const visibleLen = chars.length;
  if (visibleLen === 0) return '';
  if (plain) return line;

  const out: string[] = [];
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i];
    if (ch === ' ') {
      out.push(ch);
      continue;
    }
    const t = visibleLen === 1 ? 0 : i / (visibleLen - 1);
    const c = interpolateStops(WORDMARK_STOPS, t);
    out.push(chalk.rgb(c[0], c[1], c[2])(ch));
  }
  return out.join('');
}

function interpolateStops(stops: RGB[], t: number): RGB {
  if (stops.length === 1) return stops[0];
  const clamped = Math.max(0, Math.min(1, t));
  const scaled = clamped * (stops.length - 1);
  const idx = Math.floor(scaled);
  const frac = scaled - idx;
  const a = stops[idx];
  const b = stops[Math.min(stops.length - 1, idx + 1)];
  return [
    Math.round(a[0] + (b[0] - a[0]) * frac),
    Math.round(a[1] + (b[1] - a[1]) * frac),
    Math.round(a[2] + (b[2] - a[2]) * frac),
  ];
}

