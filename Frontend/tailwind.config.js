/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        dark: {
          bg: '#0a0c10',
          surface: '#11141a',
          card: '#161b22',
          border: '#21262d',
          muted: '#30363d',
          hover: '#1c2128',
        },
        accent: {
          DEFAULT: '#6366f1',
          hover: '#4f46e5',
          subtle: 'rgba(99, 102, 241, 0.15)',
        },
        security: {
          DEFAULT: '#f85149',
          bg: 'rgba(248, 81, 73, 0.12)',
          border: 'rgba(248, 81, 73, 0.3)',
        },
        performance: {
          DEFAULT: '#e3b341',
          bg: 'rgba(227, 179, 65, 0.12)',
          border: 'rgba(227, 179, 65, 0.3)',
        },
        style: {
          DEFAULT: '#3fb950',
          bg: 'rgba(63, 185, 80, 0.12)',
          border: 'rgba(63, 185, 80, 0.3)',
        },
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
    },
  },
  plugins: [],
}

