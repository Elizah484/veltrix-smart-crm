import Icon from './Icon';
import { useTheme } from '../context/ThemeContext';

/** Sun/moon switch. Shows the icon of the theme you will get when you click. */
export default function ThemeToggle() {
  const { theme, toggle } = useTheme();
  const next = theme === 'light' ? 'dark' : 'light';
  return (
    <button type="button" className="icon-btn theme-toggle" onClick={toggle} aria-label={'Switch to ' + next + ' theme'} title={'Switch to ' + next + ' theme'}>
      <Icon name={theme === 'light' ? 'moon' : 'sun'} />
    </button>
  );
}
