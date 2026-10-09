import DesignCard from './DesignCard';
import { themes } from '../utils/themes';

export default function DesignGallery({ selectedTheme, onSelectTheme }) {
  return (
    <div className="design-gallery">
      <h2 className="gallery-title">Choose Your World</h2>
      <div className="gallery-scroll">
        {Object.values(themes).map((theme) => (
          <DesignCard
            key={theme.id}
            theme={theme}
            isSelected={selectedTheme === theme.id}
            onClick={() => onSelectTheme(theme.id)}
          />
        ))}
      </div>
    </div>
  );
}
