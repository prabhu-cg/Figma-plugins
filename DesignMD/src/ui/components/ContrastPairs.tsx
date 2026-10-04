import { useId, useMemo, useState } from 'react';
import type { ContrastPairSpec, DesignSystem } from '@shared/types';
import { computeDefinedPairs, listColorTokenNames } from '../../plugin/generators/contrast';

interface ContrastPairsProps {
  designSystem: DesignSystem;
  pairs: ContrastPairSpec[];
  onChange: (pairs: ContrastPairSpec[]) => void;
}

const samePair = (a: ContrastPairSpec, b: ContrastPairSpec) =>
  a.foreground === b.foreground && a.background === b.background;

function describeResult(result: ReturnType<typeof computeDefinedPairs>[number]): string {
  if (result.status === 'missing') return 'Token not found';
  if (result.status === 'translucent') return 'Translucent — not checked';
  const ratio = `${result.ratio!.toFixed(2)}:1`;
  if (result.passesAANormal) return `${ratio} · passes AA`;
  if (result.passesAALarge) return `${ratio} · large text only`;
  return `${ratio} · fails AA`;
}

export function ContrastPairs({ designSystem, pairs, onChange }: ContrastPairsProps) {
  const names = useMemo(() => listColorTokenNames(designSystem), [designSystem]);
  const results = useMemo(() => computeDefinedPairs(designSystem, pairs), [designSystem, pairs]);
  const [foreground, setForeground] = useState('');
  const [background, setBackground] = useState('');
  const id = useId();

  if (names.length < 2) return null;

  const candidate: ContrastPairSpec = { foreground, background };
  const canAdd =
    foreground !== '' &&
    background !== '' &&
    foreground !== background &&
    !pairs.some((p) => samePair(p, candidate));

  const add = () => {
    if (!canAdd) return;
    onChange([...pairs, candidate]);
    setForeground('');
    setBackground('');
  };

  return (
    <section className="dmd-section">
      <h2 className="dmd-section-title">Contrast pairs</h2>
      <p className="dmd-section-subtitle">
        Pairs are inferred from token names. Add the ones you care about to have them checked in
        every color mode.
      </p>

      <div className="dmd-pair-form">
        <label className="dmd-field" htmlFor={`${id}-fg`}>
          <span>Text</span>
          <select
            id={`${id}-fg`}
            value={foreground}
            onChange={(e) => setForeground(e.target.value)}
          >
            <option value="">Choose a color</option>
            {names.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <label className="dmd-field" htmlFor={`${id}-bg`}>
          <span>Background</span>
          <select
            id={`${id}-bg`}
            value={background}
            onChange={(e) => setBackground(e.target.value)}
          >
            <option value="">Choose a color</option>
            {names.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className="dmd-text-btn" onClick={add} disabled={!canAdd}>
          Add pair
        </button>
      </div>

      {pairs.length > 0 && (
        <ul className="dmd-pair-list">
          {pairs.map((pair, index) => (
            <li className="dmd-pair-row" key={`${pair.foreground}|${pair.background}`}>
              <span className="dmd-pair-names">
                <span className="dmd-pair-name">{pair.foreground}</span>
                <span className="dmd-pair-on"> on </span>
                <span className="dmd-pair-name">{pair.background}</span>
                <span className="dmd-pair-result">{describeResult(results[index])}</span>
              </span>
              <button
                type="button"
                className="dmd-btn-icon"
                aria-label={`Remove pair ${pair.foreground} on ${pair.background}`}
                onClick={() => onChange(pairs.filter((_, i) => i !== index))}
              >
                <span aria-hidden="true">×</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
