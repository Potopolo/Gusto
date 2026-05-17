import type { Config } from 'tailwindcss';
import forms from '@tailwindcss/forms';

/**
 * Gusto DA — palette per `da-colors/Gusto-DA.pdf`:
 *   PRIMARY  brand identity green       #2E563B
 *   DARK     mode background            #172B1E
 *   SECONDARY mint (surfaces, accents)  #90C8A2
 *   ACTION   primary CTAs (pink)        #E5A5C8
 *   ACTION-2 secondary CTAs (gray)      #414447
 *   NEUTRAL  light bg / cards           #F9EDE5
 *   NEUTRAL  dark text                  #1A1F2C
 *   SCALE    light→heavy (food coding)  #72AD43 / #F7A720 / #ED6325 / #642714
 */
export default {
  content: ['./src/**/*.{html,js,svelte,ts}'],
  theme: {
    extend: {
      colors: {
        gusto: {
          green: {
            DEFAULT: '#2E563B',
            50: '#EAF1ED',
            100: '#CBDAD0',
            200: '#9FBAA9',
            700: '#244530',
            900: '#172B1E' // DARK MODE bg
          },
          mint: {
            DEFAULT: '#90C8A2',
            100: '#C5E0CE',
            700: '#5A9F73'
          },
          pink: {
            DEFAULT: '#E5A5C8',
            50: '#FBEEF4',
            100: '#F5D7E5',
            200: '#EFBFD5',
            700: '#B86E94',
            900: '#7C3F62'
          },
          gray: {
            DEFAULT: '#414447',
            900: '#1A1F2C'
          },
          cream: '#F9EDE5',
          scale: {
            green: '#72AD43',
            yellow: '#F7A720',
            orange: '#ED6325',
            brown: '#642714'
          }
        }
      },
      fontFamily: {
        sans: ['Quicksand', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['"DM Serif Display"', '"Playfair Display"', 'ui-serif', 'Georgia', 'serif']
      }
    }
  },
  plugins: [forms]
} satisfies Config;
