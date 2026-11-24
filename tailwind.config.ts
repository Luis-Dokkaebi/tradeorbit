import type { Config } from 'tailwindcss';

/**
 * Every visual value maps to a token in design/tokens.css (D-02).
 * Default Tailwind colours, spacing and font sizes are replaced, not extended,
 * so a class like `bg-blue-500` or `p-7.5` simply does not exist.
 */
const space = Object.fromEntries([1, 2, 3, 4, 5, 6, 7, 8].map((n) => [String(n), `var(--space-${n})`]));

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    colors: {
      transparent: 'transparent',
      current: 'currentColor',
      paper: { DEFAULT: 'var(--color-paper)', 2: 'var(--color-paper-2)', 3: 'var(--color-paper-3)' },
      ink: { DEFAULT: 'var(--color-ink)', 2: 'var(--color-ink-2)', 3: 'var(--color-ink-3)' },
      rule: { DEFAULT: 'var(--color-rule)', strong: 'var(--color-rule-strong)' },
      decision: { DEFAULT: 'var(--color-decision)', soft: 'var(--color-decision-soft)' },
      sim: { DEFAULT: 'var(--color-sim)', soft: 'var(--color-sim-soft)' },
      ok: { DEFAULT: 'var(--color-ok)', soft: 'var(--color-ok-soft)' },
      wait: { DEFAULT: 'var(--color-wait)', soft: 'var(--color-wait-soft)' },
      'on-ink': 'var(--color-on-ink)',
    },
    spacing: { 0: '0', px: '1px', ...space },
    fontFamily: { display: 'var(--font-display)', body: 'var(--font-body)', mono: 'var(--font-mono)' },
    fontSize: {
      xs: 'var(--text-xs)', sm: 'var(--text-sm)', base: 'var(--text-base)', lg: 'var(--text-lg)',
      xl: 'var(--text-xl)', '2xl': 'var(--text-2xl)', display: 'var(--text-display)',
    },
    borderRadius: { none: '0', DEFAULT: 'var(--radius)', full: '9999px' },
    borderWidth: { 0: '0', DEFAULT: 'var(--rule-width)', 2: '2px' },
    screens: { sm: '640px', md: '900px', lg: '1180px', xl: '1360px' },
    extend: { maxWidth: { shell: 'var(--shell-max)' } },
  },
  plugins: [],
} satisfies Config;
