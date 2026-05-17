import type { Config } from 'tailwindcss';
import forms from '@tailwindcss/forms';

export default {
  content: ['./src/**/*.{html,js,svelte,ts}'],
  theme: {
    extend: {
      colors: {
        gusto: {
          green: {
            DEFAULT: '#2e563b',
            50: '#EAF1ED',
            100: '#CBDAD0',
            200: '#9FBAA9',
            700: '#244530',
            900: '#162A1D'
          },
          pink: {
            DEFAULT: '#e5a5c8',
            50: '#FBEEF4',
            100: '#F5D7E5',
            200: '#EFBFD5',
            700: '#B86E94',
            900: '#7C3F62'
          },
          cream: '#FAF6F1'
        }
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif']
      }
    }
  },
  plugins: [forms]
} satisfies Config;
