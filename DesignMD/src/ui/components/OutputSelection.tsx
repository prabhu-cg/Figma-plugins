import type { ExportOptions } from '@shared/messages';
import {
  ArchiveIcon,
  BracesIcon,
  CodeIcon,
  DocumentIcon,
  HashIcon,
  SassIcon,
  StackIcon,
  WindIcon,
} from './icons';

interface OutputSelectionProps {
  options: ExportOptions;
  onChange: (options: ExportOptions) => void;
}

type OutputKey = keyof Omit<ExportOptions, 'zip'>;

interface OutputItem {
  key: OutputKey;
  title: string;
  description: string;
  icon: (props: { className?: string }) => JSX.Element;
}

const OUTPUT_GROUPS: Array<{ title: string; items: OutputItem[] }> = [
  {
    title: 'Documentation',
    items: [
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
    ],
  },
  {
    title: 'Tokens and code',
    items: [
      {
        key: 'tokensJson',
        title: 'tokens.json',
        description: 'Nested W3C-style design tokens with modes and usage',
        icon: BracesIcon,
      },
      {
        key: 'cssTokensJson',
        title: 'css-tokens.json',
        description: 'CSS custom-property-ready export, e.g. --color-primary-500',
        icon: HashIcon,
      },
      {
        key: 'cssFile',
        title: 'tokens.css',
        description: 'CSS custom properties, with a [data-theme] block for each mode',
        icon: CodeIcon,
      },
      {
        key: 'scssFile',
        title: '_tokens.scss',
        description: 'Sass variables plus a $modes map',
        icon: SassIcon,
      },
      {
        key: 'tailwindPreset',
        title: 'tailwind.tokens.js',
        description: 'Tailwind preset that points at the CSS variables (pair with tokens.css)',
        icon: WindIcon,
      },
    ],
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
      {OUTPUT_GROUPS.map((group) => (
        <div className="dmd-option-group" key={group.title}>
          <h3 className="dmd-group-title">{group.title}</h3>
          <div className="dmd-option-list">
            {group.items.map((item) => (
              <OptionCard
                key={item.key}
                checked={options[item.key]}
                onToggle={() => toggle(item.key)}
                title={item.title}
                description={item.description}
                icon={<item.icon />}
              />
            ))}
          </div>
        </div>
      ))}
      <div className="dmd-option-list">
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
