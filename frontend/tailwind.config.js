/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        heading: ['"Plus Jakarta Sans"', 'Inter', 'sans-serif'],
      },
      colors: {
        // NEXORA signature brand palette: Premium Indigo, Violet & Lavender
        brand: {
          50: '#f5f3ff',   // soft lavender wash
          100: '#ede9fe',  // pale lavender
          200: '#ddd6fe',  // gentle violet tint
          300: '#c4b5fd',  // soft lilac
          400: '#a78bfa',  // vibrant lavender-violet
          500: '#818cf8',  // bright indigo
          600: '#6366f1',  // NEXORA core primary indigo
          700: '#4f46e5',  // deep royal indigo
          800: '#4338ca',  // midnight indigo
          900: '#312e81',  // deep indigo twilight
          950: '#17153a',  // deep violet obsidian
        },
        violet: {
          50: '#faf5ff',
          100: '#f3e8ff',
          200: '#e9d5ff',
          300: '#d8b4fe',
          400: '#c084fc',
          500: '#a855f7',
          600: '#9333ea',
          700: '#7e22ce',
          800: '#6b21a8',
          900: '#581c87',
          950: '#3b0764',
        },
        lavender: {
          50: '#fbfaff',
          100: '#f5f2fd',
          200: '#eae4fc',
          300: '#ddd3fa',
          400: '#c5b6f7',
          500: '#aa95f4',
          600: '#8e70ee',
          700: '#754de3',
          800: '#5f35cb',
          900: '#4c29a6',
        },
        // Refined surfaces: Warm white & lavender-gray (light) -> Deep charcoal & muted violet (dark)
        slate: {
          50: '#f8f7fd',   // Warm alabaster canvas with soft lavender tint
          100: '#f1eff8',  // Soft lavender-gray surface
          200: '#e4e0f0',  // Refined border light
          300: '#cfc9e2',
          400: '#9ea1bd',
          500: '#747895',
          600: '#565a75',
          700: '#3e415b',
          800: '#23253b',  // Charcoal with violet undertone
          850: '#191b30',
          900: '#121324',
          925: '#0d0e1c',
          950: '#080914',  // Deepest charcoal
        },
        dark: {
          700: '#333556',
          750: '#262846',
          800: '#1c1e38',
          850: '#16172e',
          900: '#111122',  // Primary dark surface
          925: '#0d0e1d',
          950: '#090915',  // Dark canvas
        },
        // Semantic CSS variable tokens
        nexora: {
          canvas: 'var(--nx-bg-canvas)',
          surface: 'var(--nx-bg-surface)',
          elevated: 'var(--nx-bg-surface-elevated)',
          subtle: 'var(--nx-bg-surface-subtle)',
          border: 'var(--nx-border-default)',
          'border-subtle': 'var(--nx-border-subtle)',
        }
      },
      boxShadow: {
        'subtle': 'var(--nx-shadow-subtle)',
        'card': 'var(--nx-shadow-card)',
        'elevated': 'var(--nx-shadow-elevated)',
        'modal': 'var(--nx-shadow-popover)',
        'glow': 'var(--nx-shadow-glow)',
        'glow-violet': '0 0 25px -4px rgba(168, 85, 247, 0.35)',
        'glow-indigo': '0 0 25px -4px rgba(99, 102, 241, 0.35)',
        'ring-brand': '0 0 0 3px rgba(99, 102, 241, 0.25)',
      },
      backgroundImage: {
        'nexora-gradient': 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #a855f7 100%)',
        'nexora-subtle-glow': 'radial-gradient(circle at 50% 0%, rgba(99, 102, 241, 0.12) 0%, transparent 70%)',
        'nexora-dark-glow': 'radial-gradient(ellipse at 50% -20%, rgba(139, 92, 246, 0.15) 0%, transparent 60%)',
      },
      letterSpacing: {
        'snug': '-0.015em',
        'tight': '-0.025em',
        'tighter': '-0.035em',
      }
    },
  },
  plugins: [],
}
