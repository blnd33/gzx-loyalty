import type { Config } from 'tailwindcss';

// GZX brand tokens — taken from the loyalty-card artwork.
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#101018',        // main background
        rail: '#171321',       // sidebar
        panel: '#22162B',      // cards / panels
        'panel-2': '#2C1D38',  // raised panel / hover
        line: 'rgba(255,255,255,0.08)',
        neon: {
          orange: '#FF6B00',
          pink: '#FF2E8B',
          purple: '#8B3DFF',
          gold: '#FFD447',
          red: '#E8264F',
        },
        muted: '#B9AFC2',
        success: '#22C55E',
        danger: '#FF5470',
      },
      fontFamily: {
        display: ['"Russo One"', 'system-ui', 'sans-serif'],
        sans: ['"Chakra Petch"', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'glow-orange': '0 0 0 1px rgba(255,107,0,.55), 0 0 18px rgba(255,107,0,.35)',
        'glow-pink': '0 0 0 1px rgba(255,46,139,.55), 0 0 18px rgba(255,46,139,.30)',
        'glow-gold': '0 0 0 1px rgba(255,212,71,.7), 0 0 24px rgba(255,212,71,.45)',
        panel: '0 1px 0 rgba(255,255,255,.04) inset, 0 12px 32px -12px rgba(0,0,0,.6)',
      },
      keyframes: {
        'punch-in': {
          '0%': { transform: 'scale(.6)', opacity: '0.2' },
          '60%': { transform: 'scale(1.08)', opacity: '1' },
          '100%': { transform: 'scale(1)' },
        },
        'reward-glow': {
          '0%,100%': { boxShadow: '0 0 0 1px rgba(255,212,71,.7), 0 0 18px rgba(255,212,71,.35)' },
          '50%': { boxShadow: '0 0 0 1px rgba(255,212,71,.9), 0 0 34px rgba(255,212,71,.6)' },
        },
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'punch-in': 'punch-in 420ms cubic-bezier(.2,.9,.3,1.2) both',
        'reward-glow': 'reward-glow 2.4s ease-in-out infinite',
        'fade-up': 'fade-up 220ms ease-out both',
      },
    },
  },
  plugins: [],
};
export default config;
