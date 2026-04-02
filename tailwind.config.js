/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,ts,jsx,tsx}', './components/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans:    ['Geist', 'sans-serif'],
        mono:    ['Geist Mono', 'monospace'],
        display: ['Geist', 'sans-serif'],
      },
      colors: {
        // Black/white palette
        bg:       '#000000',
        surface:  '#0a0a0a',
        panel:    '#111111',
        card:     '#161616',
        border:   '#222222',
        'border-md': '#2a2a2a',
        'border-hi': '#333333',
        muted:    '#444444',
        dim:      '#666666',
        subtle:   '#888888',
        secondary:'#aaaaaa',
        text:     '#ffffff',
        // Accent = white on black
        accent:   '#ffffff',
        'accent-dim': '#333333',
        // Terminal colors (keep subtle, no green)
        'term-tool':   '#888888',
        'term-ok':     '#ffffff',
        'term-error':  '#ff4444',
        'term-status': '#aaaaaa',
        'term-muted':  '#555555',
      },
      borderRadius: {
        DEFAULT: '6px',
        md: '6px',
        lg: '10px',
        xl: '14px',
      },
      animation: {
        'cursor-blink': 'blink 1s step-end infinite',
        'fade-up':      'fadeUp 0.2s ease forwards',
      },
      keyframes: {
        blink:   { '0%,100%': { opacity: 1 }, '50%': { opacity: 0 } },
        fadeUp:  { from: { opacity: 0, transform: 'translateY(6px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
      },
    },
  },
  plugins: [],
}
