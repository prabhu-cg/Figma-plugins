import type { ExportOptions } from '@shared/messages';
import { ArchiveIcon, BracesIcon, DocumentIcon, HashIcon, StackIcon } from './icons';

interface OutputSelectionProps {
  options: ExportOptions;
  onChange: (options: ExportOptions) => void;
}

const OUTPUT_ITEMS: Array<{
  key: keyof Omit<ExportOptions, 'zip'>;
  title: string;
  description: string;
  icon: (props: { className?: string }) => JSX.Element;
}> = [
  {
    key: 'designMd',
    title: 'design.md',
    description: 'Overview, tokens, and component index in one semantic Markdown file',
    icon: DocumentIcon,
  },
  {
    key: 'componentDocs',
    title: 'Component docs',
    description: 'One Markdown file per component — variants, properties, token references',
    icon: StackIcon,
  },
  {
    key: 'tokensJson',
    title: 'tokens.json',
    description: 'Normalized, nested token export preserving your variable hierarchy',
    icon: BracesIcon,
  },
  {
    key: 'cssTokensJson',
    title: 'css-tokens.json',
    description: 'CSS custom-property-ready export, e.g. --color-primary-500',
    icon: HashIcon,
  },
];

interface OptionCardProps {
  checked: boolean;
  onToggle: () => void;
  title: string;
  description: string;
  icon: JSX.Element;
}

function OptionCard({ checked, onToggle, title, description, icon }: OptionCardProps) {
  return (
    <label className={`dmd-option-card${checked ? ' is-checked' : ''}`}>
      <span className="dmd-option-icon">{icon}</span>
      <span className="dmd-option-body">
        <span className="dmd-option-title">{title}</span>
        <span className="dmd-option-description">{description}</span>
      </span>
      <input
        type="checkbox"
        className="dmd-option-checkbox"
        checked={checked}
        onChange={onToggle}
      />
    </label>
  );
}

export function OutputSelection({ options, onChange }: OutputSelectionProps) {
  const toggle = (key: keyof ExportOptions) => {
    onChange({ ...options, [key]: !options[key] });
  };

  return (
    <section className="dmd-section">
      <h2 className="dmd-section-title">Choose export outputs</h2>
      <p className="dmd-section-subtitle">Select which files to generate from your design system</p>
      <div className="dmd-option-list">
        {OUTPUT_ITEMS.map((item) => (
          <OptionCard
            key={item.key}
            checked={options[item.key]}
            onToggle={() => toggle(item.key)}
            title={item.title}
            description={item.description}
            icon={<item.icon />}
          />
        ))}
        <hr className="dmd-option-divider" />
        <OptionCard
          checked={options.zip}
          onToggle={() => toggle('zip')}
          title="Export all as ZIP"
          description="Bundle selected outputs into one .zip. If unchecked, files download individually."
          icon={<ArchiveIcon />}
        />
      </div>
    </section>
  );
}
