import { Fragment } from 'react';
import type { BooleanOptionKey, ExportOptions } from '@shared/messages';
import { ArchiveIcon, BracesIcon, CodeIcon, DocumentIcon, StackIcon, TreeIcon } from './icons';

interface OutputSelectionProps {
  options: ExportOptions;
  onChange: (options: ExportOptions) => void;
}

type OutputKey = Exclude<BooleanOptionKey, 'zip'>;

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
        key: 'cssFile',
        title: 'tokens.css',
        description: 'CSS custom properties, with a [data-theme] block for each mode',
        icon: CodeIcon,
      },
    ],
  },
  {
    title: 'Components',
    items: [
      {
        key: 'componentsJson',
        title: 'components.json',
        description:
          'Layer trees, variant differences, roles and the tokens each component uses, for code generators and AI tools',
        icon: TreeIcon,
      },
    ],
  },
];

const COMPONENT_SUBOPTIONS: Array<{
  key:
    | 'includeText'
    | 'includeVariantDiffs'
    | 'includeInstanceInternals'
    | 'includeVectorShapes'
    | 'includeImages';
  label: string;
}> = [
  { key: 'includeText', label: 'Include text content' },
  { key: 'includeVariantDiffs', label: 'Include variant differences' },
  {
    key: 'includeInstanceInternals',
    label: 'Include layers inside nested instances (slower, larger)',
  },
  { key: 'includeVectorShapes', label: 'Include vector shapes (so icons can be drawn)' },
  { key: 'includeImages', label: 'Export pictures behind image fills (larger)' },
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
  const toggle = (key: BooleanOptionKey) => {
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
              <Fragment key={item.key}>
                <OptionCard
                  checked={options[item.key]}
                  onToggle={() => toggle(item.key)}
                  title={item.title}
                  description={item.description}
                  icon={<item.icon />}
                />
                {item.key === 'componentsJson' && options.componentsJson && (
                  <div className="dmd-suboptions">
                    {COMPONENT_SUBOPTIONS.map((sub) => (
                      <label className="dmd-suboption" key={sub.key}>
                        <input
                          type="checkbox"
                          checked={options[sub.key]}
                          onChange={() => toggle(sub.key)}
                        />
                        <span>{sub.label}</span>
                      </label>
                    ))}
                    <label className="dmd-suboption">
                      <span>Split into one file per component</span>
                      <select
                        value={options.splitComponentsJson}
                        onChange={(e) =>
                          onChange({
                            ...options,
                            splitComponentsJson: e.target.value === 'always' ? 'always' : 'auto',
                          })
                        }
                      >
                        <option value="auto">Only above 20 MB</option>
                        <option value="always">Always</option>
                      </select>
                    </label>
                    <p className="dmd-suboption-note">
                      This file includes text content, layer names and design values from your Figma
                      file. Nothing leaves the plugin; the file is only saved where you download it.
                    </p>
                  </div>
                )}
              </Fragment>
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
